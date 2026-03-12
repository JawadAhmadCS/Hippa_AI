import express from "express";
import multer from "multer";
import { env, featureFlags } from "../config/env.js";
import {
  addRecording,
  appendTranscriptSegment,
  createAppointment,
  getAppointment,
} from "../services/appointment-store.js";
import { writeAuditEvent } from "../services/audit-service.js";
import { getCodebookStatus, searchCodes } from "../services/codebook-service.js";
import { runLiveAnalysisPipeline } from "../services/live-analysis-service.js";
import { getAzureSpeechToken, uploadAppointmentAudio } from "../services/azure-service.js";
import { normalizeIncomingTranscript, parseAwsTranscribeMedicalPayload } from "../services/stt-service.js";
import {
  broadcastAppointmentEvent,
  subscribeToAppointmentStream,
} from "../services/streaming-service.js";
import { normalizeTranscriptSegment } from "../services/transcript-service.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const ensureAppointment = (id, response) => {
  const appointment = getAppointment(id);
  if (!appointment) {
    response.status(404).json({ error: "Appointment not found." });
    return null;
  }
  return appointment;
};

const withAsync = (handler) => async (request, response) => {
  try {
    await handler(request, response);
  } catch (error) {
    response.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
};

const fireAndForgetAudit = (eventType, payload) => {
  writeAuditEvent(eventType, payload).catch(() => {});
};

const buildTranscriptResponse = ({ appointment, processedSegment, pipelineResult }) => ({
  transcriptCount: appointment.transcriptSegments.length,
  processedSegment: {
    source: processedSegment.source,
    rawText: processedSegment.rawText,
    cleanedText: processedSegment.cleanedText,
    quality: processedSegment.quality,
  },
  newlyAddedSuggestions: pipelineResult.suggestions.newlyAdded,
  allSuggestions: pipelineResult.suggestions.all,
  icdSuggestions: pipelineResult.icdSuggestions,
  guidance: {
    items: pipelineResult.guidanceItems.slice(0, 6),
  },
  missedBillables: pipelineResult.missedBillables,
  documentation: {
    gaps: pipelineResult.documentationGaps,
    improvements: pipelineResult.documentationImprovements,
  },
  revenueTracker: pipelineResult.revenueTracker,
  analysis: pipelineResult.analysis,
  outputs: {
    cptSuggestions: pipelineResult.suggestions.all,
    icdSuggestions: pipelineResult.icdSuggestions.all,
    missedBillables: pipelineResult.missedBillables,
    documentationGaps: pipelineResult.documentationGaps,
    documentationImprovements: pipelineResult.documentationImprovements,
    realTimePrompts: pipelineResult.guidanceItems,
    reimbursement: pipelineResult.revenueTracker,
  },
});

const processTranscriptSegment = async ({ appointment, rawSegment, source }) => {
  const baselineCode = "99213";
  const processedSegment = await normalizeTranscriptSegment({ rawText: rawSegment, source });
  if (!processedSegment.cleanedText) {
    throw new Error("Transcript segment could not be processed.");
  }

  const storedSegment = appendTranscriptSegment(appointment.id, {
    text: processedSegment.cleanedText,
    rawText: processedSegment.rawText,
    cleanedText: processedSegment.cleanedText,
    quality: processedSegment.quality,
    source,
  });

  const acceptedPayload = {
    appointmentId: appointment.id,
    transcriptCount: appointment.transcriptSegments.length,
    segment: {
      source,
      rawText: storedSegment?.rawText ?? processedSegment.rawText,
      cleanedText: storedSegment?.cleanedText ?? processedSegment.cleanedText,
      quality: storedSegment?.quality ?? processedSegment.quality,
    },
    at: new Date().toISOString(),
  };
  broadcastAppointmentEvent(appointment.id, "transcript.accepted", acceptedPayload);

  const pipelineResult = await runLiveAnalysisPipeline({
    appointment,
    latestSegment: processedSegment.cleanedText,
    baselineCode,
  });

  const payload = buildTranscriptResponse({
    appointment,
    processedSegment: {
      source,
      rawText: storedSegment?.rawText ?? rawSegment,
      cleanedText: storedSegment?.cleanedText ?? processedSegment.cleanedText,
      quality: storedSegment?.quality ?? processedSegment.quality,
    },
    pipelineResult,
  });

  broadcastAppointmentEvent(appointment.id, "analysis.update", {
    ...payload,
    appointmentId: appointment.id,
    at: new Date().toISOString(),
  });

  const newlyAddedCpt = payload.newlyAddedSuggestions || [];
  const newlyAddedIcd = payload.icdSuggestions?.newlyAdded || [];
  fireAndForgetAudit("appointment.transcript.segment", {
    appointmentId: appointment.id,
    doctorRef: appointment.doctorRef,
    source,
    rawText: rawSegment,
    processedText: processedSegment.cleanedText,
    quality: processedSegment.quality,
    ruleGeneratedCodes: newlyAddedCpt
      .filter((item) => item.source === "rule-engine")
      .map((item) => item.code),
    aiGeneratedCodes: newlyAddedCpt
      .filter((item) => item.source === "openai-analysis")
      .map((item) => item.code),
    icdCodesAdded: newlyAddedIcd.map((item) => item.code),
    missedBillablesCount: payload.missedBillables.length,
    documentationGapCount: payload.documentation.gaps.length,
    guidanceCount: payload.guidance.items.length,
    aiModel: payload.analysis?.model,
    aiSkipReason: payload.analysis?.skipReason,
    latency: payload.analysis?.latency,
  });

  return payload;
};

router.get("/health", (_request, response) => {
  response.json({ ok: true, at: new Date().toISOString() });
});

router.post(
  "/appointments",
  withAsync(async (request, response) => {
    const doctorRef = String(request.body.doctorRef || "").trim();
    const patientRef = String(request.body.patientRef || "anonymous").trim();
    const consentFormId = String(request.body.consentFormId || "").trim();
    const consentGiven = Boolean(request.body.consentGiven);

    if (!doctorRef) {
      response.status(400).json({ error: "Doctor reference is required." });
      return;
    }

    if (!consentGiven || !consentFormId) {
      response.status(400).json({
        error: "Intake consent form must be signed before encounter recording.",
      });
      return;
    }

    const appointment = createAppointment({
      patientRef,
      doctorRef,
      insurancePlan: request.body.insurancePlan || "medicare",
      visitType: request.body.visitType || "follow-up",
      consentGiven,
      consentFormId,
      consentSignedAt: request.body.consentSignedAt,
    });

    fireAndForgetAudit("appointment.created", {
      appointmentId: appointment.id,
      patientRef: appointment.patientRef,
      doctorRef: appointment.doctorRef,
      insurancePlan: appointment.insurancePlan,
      consentGiven: appointment.consentGiven,
      consentFormId: appointment.consentFormId,
      consentSignedAt: appointment.consentSignedAt,
      accessPolicy: appointment.accessPolicy,
    });

    response.status(201).json({ appointment });
  })
);

router.get(
  "/appointments/:appointmentId",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;
    response.json({ appointment });
  })
);

router.get(
  "/appointments/:appointmentId/stream",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    const unsubscribe = subscribeToAppointmentStream(appointment.id, response);
    response.write(
      `event: connected\ndata: ${JSON.stringify({
        appointmentId: appointment.id,
        at: new Date().toISOString(),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      response.write(`event: ping\ndata: {"at":"${new Date().toISOString()}"}\n\n`);
    }, 15000);

    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  })
);

router.get(
  "/azure/speech-token",
  withAsync(async (_request, response) => {
    const token = await getAzureSpeechToken();
    response.json(token);
  })
);

router.post(
  "/appointments/:appointmentId/transcript",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    if (!appointment.consentGiven) {
      response.status(403).json({ error: "Consent is required before recording/transcription." });
      return;
    }

    const normalized = normalizeIncomingTranscript(request.body);
    if (!normalized.segment) {
      response.status(400).json({ error: "Transcript segment is required." });
      return;
    }

    const payload = await processTranscriptSegment({
      appointment,
      rawSegment: normalized.segment,
      source: normalized.source,
    });
    response.json(payload);
  })
);

router.post(
  "/appointments/:appointmentId/transcript/aws-transcribe",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    if (!appointment.consentGiven) {
      response.status(403).json({ error: "Consent is required before recording/transcription." });
      return;
    }

    const parsed = parseAwsTranscribeMedicalPayload(request.body || {});
    if (!parsed.segments.length) {
      response.status(202).json({
        accepted: false,
        reason: "no-usable-aws-segments",
        stt: { provider: parsed.provider, segmentsReceived: 0 },
      });
      return;
    }

    const finalSegments = parsed.segments.filter((item) => !item.isPartial);
    if (!finalSegments.length) {
      broadcastAppointmentEvent(appointment.id, "transcript.partial", {
        appointmentId: appointment.id,
        provider: parsed.provider,
        partialText: parsed.segments[parsed.segments.length - 1]?.text || "",
        at: new Date().toISOString(),
      });

      response.status(202).json({
        accepted: false,
        partial: true,
        reason: "aws-partial-only",
        stt: {
          provider: parsed.provider,
          segmentsReceived: parsed.segments.length,
        },
      });
      return;
    }

    const processAllFinal =
      String(request.query.processAllFinal || request.body.processAllFinal || "false")
        .trim()
        .toLowerCase() === "true";

    const selected = processAllFinal ? finalSegments : [finalSegments[finalSegments.length - 1]];
    let latestPayload = null;

    for (const segment of selected) {
      latestPayload = await processTranscriptSegment({
        appointment,
        rawSegment: segment.text,
        source: parsed.provider,
      });
    }

    response.json({
      ...(latestPayload || {}),
      stt: {
        provider: parsed.provider,
        segmentsReceived: parsed.segments.length,
        processedFinalSegments: selected.length,
      },
    });
  })
);

router.post(
  "/appointments/:appointmentId/audio",
  upload.single("audio"),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;
    if (!request.file) {
      response.status(400).json({ error: "Audio file is required." });
      return;
    }

    const uploaded = await uploadAppointmentAudio({
      appointmentId: appointment.id,
      buffer: request.file.buffer,
      mimeType: request.file.mimetype,
      fileName: request.file.originalname,
    });

    addRecording(appointment.id, uploaded);
    fireAndForgetAudit("appointment.audio.uploaded", {
      appointmentId: appointment.id,
      doctorRef: appointment.doctorRef,
      provider: uploaded.provider,
      mimeType: uploaded.mimeType,
      blobName: uploaded.blobName,
    });

    response.status(201).json({ recording: uploaded });
  })
);

router.get(
  "/codes/search",
  withAsync(async (request, response) => {
    const results = searchCodes(request.query.q || "");
    response.json({ results });
  })
);

router.get(
  "/compliance/status",
  withAsync(async (_request, response) => {
    response.json({
      codebook: getCodebookStatus(),
      integrations: {
        openAiAnalysisConfigured: featureFlags.hasOpenAi,
        transcriptCleanupConfigured: true,
        transcriptCleanupAiEnabled: featureFlags.hasOpenAi && env.enableAiTranscriptCleanup,
        azureSpeechConfigured: featureFlags.hasAzureSpeech,
        azureBlobConfigured: featureFlags.hasAzureBlobStorage,
        awsTranscribeMedicalIngestion: true,
        realtimeStreamingConfigured: true,
      },
      latencyTargets: {
        aiTargetMs: env.aiTargetLatencyMs,
        aiRequestTimeoutMs: env.aiRequestTimeoutMs,
      },
      accessModel: {
        primaryUser: "doctor",
        patientPortalAccess: false,
        consentRequiredAtIntake: true,
      },
      notes: [
        "Prototype enforces intake consent gate before transcription capture.",
        "Audit trail uses hash chaining and PHI-redacted payloads.",
        "Final coding should always be reviewed by certified billing/coding staff.",
      ],
    });
  })
);

export default router;
