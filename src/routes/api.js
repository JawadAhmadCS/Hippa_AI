import express from "express";
import multer from "multer";
import { featureFlags } from "../config/env.js";
import {
  addRecording,
  addSuggestions,
  appendTranscriptSegment,
  createAppointment,
  getAppointment,
  getTranscriptContext,
  setRevenueTracker,
} from "../services/appointment-store.js";
import { writeAuditEvent } from "../services/audit-service.js";
import { getCodebookStatus, searchCodes } from "../services/codebook-service.js";
import { estimateRevenueTracker } from "../services/revenue-service.js";
import { analyzeTranscriptForSuggestions } from "../services/openai-service.js";
import { getAzureSpeechToken, uploadAppointmentAudio } from "../services/azure-service.js";
import {
  inferRuleBasedGuidance,
  inferRuleBasedSuggestions,
  normalizeAiGuidance,
  normalizeAiSuggestions,
} from "../services/suggestion-service.js";
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

    await writeAuditEvent("appointment.created", {
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

    const rawSegment = String(request.body.segment || "").trim();
    if (!rawSegment) {
      response.status(400).json({ error: "Transcript segment is required." });
      return;
    }

    const baselineCode = "99213";
    const source = request.body.source || "unknown";

    const processedSegment = await normalizeTranscriptSegment({ rawText: rawSegment, source });
    if (!processedSegment.cleanedText) {
      response.status(400).json({ error: "Transcript segment could not be processed." });
      return;
    }

    const storedSegment = appendTranscriptSegment(appointment.id, {
      text: processedSegment.cleanedText,
      rawText: processedSegment.rawText,
      cleanedText: processedSegment.cleanedText,
      quality: processedSegment.quality,
      source,
    });

    const transcriptContext = getTranscriptContext(appointment.id, 8);
    const existingCodes = new Set(appointment.suggestions.map((item) => item.code));

    const ruleSuggestions = inferRuleBasedSuggestions({
      segment: transcriptContext,
      existingCodes,
    }).filter((item) => item.code !== baselineCode);

    const mergedRule = addSuggestions(appointment.id, ruleSuggestions, "rule-engine");

    const guidanceItems = inferRuleBasedGuidance({ segment: transcriptContext });

    let aiModel = null;
    let mergedAi = { newlyAdded: [] };

    if (featureFlags.hasOpenAi) {
      const aiResult = await analyzeTranscriptForSuggestions({
        appointmentId: appointment.id,
        insurancePlan: appointment.insurancePlan,
        visitType: appointment.visitType,
        transcriptContext,
        baselineCode,
        existingCodes: appointment.suggestions.map((item) => item.code),
      });

      aiModel = aiResult.model;
      const normalizedAi = normalizeAiSuggestions(aiResult.suggestions)
        .filter((item) => item.code !== baselineCode)
        .filter((item) => Number(item.confidence || 0) >= 0.62);

      mergedAi = addSuggestions(appointment.id, normalizedAi, "openai-analysis") || { newlyAdded: [] };

      const aiGuidance = normalizeAiGuidance(aiResult.guidance);
      const existingPromptSet = new Set(guidanceItems.map((item) => item.prompt.toLowerCase()));
      for (const suggestion of aiGuidance) {
        const key = suggestion.prompt.toLowerCase();
        if (!existingPromptSet.has(key)) {
          guidanceItems.push(suggestion);
          existingPromptSet.add(key);
        }
      }
    }

    const tracker = estimateRevenueTracker({
      insurancePlan: appointment.insurancePlan,
      baselineCode,
      suggestions: appointment.suggestions,
    });
    setRevenueTracker(appointment.id, tracker);

    await writeAuditEvent("appointment.transcript.segment", {
      appointmentId: appointment.id,
      doctorRef: appointment.doctorRef,
      source,
      rawText: rawSegment,
      processedText: processedSegment.cleanedText,
      quality: processedSegment.quality,
      ruleGeneratedCodes: mergedRule?.newlyAdded?.map((item) => item.code) ?? [],
      aiGeneratedCodes: mergedAi?.newlyAdded?.map((item) => item.code) ?? [],
      guidanceCount: guidanceItems.length,
      aiModel,
    });

    response.json({
      transcriptCount: appointment.transcriptSegments.length,
      processedSegment: {
        source,
        rawText: storedSegment?.rawText ?? rawSegment,
        cleanedText: storedSegment?.cleanedText ?? processedSegment.cleanedText,
        quality: storedSegment?.quality ?? processedSegment.quality,
      },
      newlyAddedSuggestions: [
        ...(mergedRule?.newlyAdded ?? []),
        ...(mergedAi?.newlyAdded ?? []),
      ],
      allSuggestions: appointment.suggestions,
      guidance: {
        items: guidanceItems.slice(0, 6),
      },
      revenueTracker: appointment.revenueTracker,
      analysis: {
        model: aiModel,
        mode: featureFlags.hasOpenAi ? "rule-engine+openai" : "rule-engine-only",
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
    await writeAuditEvent("appointment.audio.uploaded", {
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
        transcriptCleanupConfigured: featureFlags.hasOpenAi,
        azureSpeechConfigured: featureFlags.hasAzureSpeech,
        azureBlobConfigured: featureFlags.hasAzureBlobStorage,
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
