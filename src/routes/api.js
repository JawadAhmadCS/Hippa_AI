import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { env, featureFlags } from "../config/env.js";
import {
  addRecording,
  appendTranscriptSegment,
  createAppointment,
  getAppointment,
  listAppointments,
} from "../services/appointment-store.js";
import { listAuditEvents, writeAuditEvent } from "../services/audit-service.js";
import {
  getCodebookSnapshot,
  getCodebookStatus,
  searchCodes,
  updateCodeById,
} from "../services/codebook-service.js";
import { buildTranscriptPdfBuffer } from "../services/pdf-service.js";
import { runLiveAnalysisPipeline } from "../services/live-analysis-service.js";
import { getAzureSpeechToken, uploadAppointmentAudio } from "../services/azure-service.js";
import { normalizeIncomingTranscript, parseAwsTranscribeMedicalPayload } from "../services/stt-service.js";
import {
  broadcastAppointmentEvent,
  subscribeToAppointmentStream,
} from "../services/streaming-service.js";
import { normalizeTranscriptSegment } from "../services/transcript-service.js";
import { buildRevenueCsv, buildRevenueReport } from "../services/reporting-service.js";
import {
  addBaaDocument,
  getCodebookExtensions,
  getDoctorPreferences,
  getGeneralSettings,
  getHipaaSettings,
  getProductionReadinessSettings,
  updateCodebookExtensions,
  updateDoctorPreferences,
  updateGeneralSettings,
  updateHipaaSettings,
  updateProductionReadinessSettings,
} from "../services/platform-config-service.js";
import { buildProductionReadinessStatus } from "../services/production-readiness-service.js";

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

const normalizeDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const filterAppointments = ({
  search = "",
  dateFrom = "",
  dateTo = "",
} = {}) => {
  const query = String(search || "").trim().toLowerCase();
  const start = normalizeDateOrNull(dateFrom);
  const end = normalizeDateOrNull(dateTo);
  if (end) end.setHours(23, 59, 59, 999);

  return listAppointments().filter((appointment) => {
    if (query) {
      const haystack = [
        appointment.id,
        appointment.patientRef,
        appointment.doctorRef,
        appointment.insurancePlan,
        appointment.visitType,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    const created = normalizeDateOrNull(appointment.createdAt);
    if (!created) return false;
    if (start && created < start) return false;
    if (end && created > end) return false;

    return true;
  });
};

const buildTranscriptExportLines = (appointment) => {
  const lines = [
    `Encounter ID: ${appointment.id}`,
    `Doctor: ${appointment.doctorRef || "-"}`,
    `Patient Reference: ${appointment.patientRef || "-"}`,
    `Date: ${appointment.createdAt || "-"}`,
    "",
    "Transcript",
    "----------",
  ];

  const transcript = Array.isArray(appointment.transcriptSegments)
    ? appointment.transcriptSegments
    : [];
  for (const segment of transcript) {
    const at = segment.at ? new Date(segment.at).toLocaleString() : "";
    const source = segment.source || "transcript";
    const text = segment.cleanedText || segment.text || "";
    lines.push(`[${at}] ${source}: ${text}`);
  }

  lines.push("");
  lines.push("Final Billed CPT Codes");
  lines.push("----------------------");
  const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];

  if (!billableCodes.length) {
    lines.push("No billable codes recorded.");
  } else {
    for (const code of billableCodes) {
      const amount = Number(code.estimatedAmount || 0).toFixed(2);
      lines.push(`${code.code || "-"} - ${code.title || ""} ($${amount})`);
    }
  }

  lines.push("");
  lines.push(`Projected Revenue: $${Number(appointment.revenueTracker?.projectedTotal || 0).toFixed(2)}`);
  lines.push(`Earned Now: $${Number(appointment.revenueTracker?.earnedNow || 0).toFixed(2)}`);

  return lines;
};

const buildTranscriptResponse = ({ appointment, processedSegment, pipelineResult }) => ({
  transcriptCount: appointment.transcriptSegments.length,
  processedSegment: {
    id: processedSegment.id,
    sequence: processedSegment.sequence,
    at: processedSegment.at,
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
  chartNotes: pipelineResult.chartNotes,
  revenueTracker: pipelineResult.revenueTracker,
  analysis: pipelineResult.analysis,
  outputs: {
    cptSuggestions: pipelineResult.suggestions.all,
    icdSuggestions: pipelineResult.icdSuggestions.all,
    missedBillables: pipelineResult.missedBillables,
    documentationGaps: pipelineResult.documentationGaps,
    documentationImprovements: pipelineResult.documentationImprovements,
    chartNotes: pipelineResult.chartNotes,
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
      id: storedSegment?.id ?? processedSegment.id,
      sequence: storedSegment?.sequence ?? 0,
      at: storedSegment?.at ?? new Date().toISOString(),
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
      id: storedSegment?.id,
      sequence: storedSegment?.sequence,
      at: storedSegment?.at,
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
  "/appointments",
  withAsync(async (request, response) => {
    const search = String(request.query.q || "").trim();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    const appointments = filterAppointments({ search, dateFrom, dateTo });

    response.json({
      appointments,
      filters: {
        q: search,
        dateFrom,
        dateTo,
      },
    });
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
  "/appointments/:appointmentId/transcript.pdf",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    const lines = buildTranscriptExportLines(appointment);
    const pdf = buildTranscriptPdfBuffer({
      title: `Encounter Transcript - ${appointment.id}`,
      lines,
    });

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${appointment.id}-transcript.pdf"`
    );
    response.send(pdf);
  })
);

router.get(
  "/appointments/:appointmentId/audit",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    const limit = Number(request.query.limit || 200);
    const events = listAuditEvents({
      appointmentId: appointment.id,
      limit,
    });

    response.json({
      appointmentId: appointment.id,
      count: events.length,
      events,
    });
  })
);

router.get(
  "/reports/revenue",
  withAsync(async (request, response) => {
    const granularity = String(request.query.granularity || "daily").trim().toLowerCase();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    const report = buildRevenueReport({ granularity, dateFrom, dateTo });
    response.json(report);
  })
);

router.get(
  "/reports/revenue/export.csv",
  withAsync(async (request, response) => {
    const granularity = String(request.query.granularity || "daily").trim().toLowerCase();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    const report = buildRevenueReport({ granularity, dateFrom, dateTo });
    const csv = buildRevenueCsv({ report });
    const fileName = `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.send(csv);
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
  "/codebook",
  withAsync(async (_request, response) => {
    const snapshot = getCodebookSnapshot();
    response.json({
      codebook: snapshot,
      status: getCodebookStatus(),
    });
  })
);

router.put(
  "/codebook/codes/:code",
  withAsync(async (request, response) => {
    const code = String(request.params.code || "").toUpperCase().trim();
    if (!code) {
      response.status(400).json({ error: "Code is required." });
      return;
    }

    const updated = updateCodeById(code, {
      title: request.body.title,
      medicareRate: request.body.medicareRate,
      documentationNeeded: request.body.documentationNeeded,
      complianceNotes: request.body.complianceNotes,
    });

    if (!updated) {
      response.status(404).json({ error: "Code not found in codebook." });
      return;
    }

    fireAndForgetAudit("codebook.code.updated", {
      code,
      fieldsUpdated: Object.keys(request.body || {}),
      at: new Date().toISOString(),
    });

    response.json({
      code: updated,
      status: getCodebookStatus(),
    });
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
  "/settings/general",
  withAsync(async (_request, response) => {
    const settings = getGeneralSettings();
    response.json({
      settings,
      integrations: {
        azureSpeechConfigured: featureFlags.hasAzureSpeech,
        azureBlobConfigured: featureFlags.hasAzureBlobStorage,
        openAiConfigured: featureFlags.hasOpenAi,
      },
    });
  })
);

router.put(
  "/settings/general",
  withAsync(async (request, response) => {
    const settings = updateGeneralSettings(request.body || {});
    fireAndForgetAudit("settings.general.updated", {
      fieldsUpdated: Object.keys(request.body || {}),
      at: new Date().toISOString(),
    });
    response.json({ settings });
  })
);

router.get(
  "/preferences",
  withAsync(async (request, response) => {
    const doctorRef = String(request.query.doctorRef || "default").trim() || "default";
    response.json({
      doctorRef,
      preferences: getDoctorPreferences(doctorRef),
    });
  })
);

router.put(
  "/preferences",
  withAsync(async (request, response) => {
    const doctorRef = String(request.body.doctorRef || request.query.doctorRef || "default").trim() || "default";
    const preferences = updateDoctorPreferences(doctorRef, request.body || {});
    fireAndForgetAudit("preferences.updated", {
      doctorRef,
      fieldsUpdated: Object.keys(request.body || {}),
      at: new Date().toISOString(),
    });
    response.json({ doctorRef, preferences });
  })
);

router.get(
  "/codebook/extensions",
  withAsync(async (_request, response) => {
    response.json({
      extensions: getCodebookExtensions(),
    });
  })
);

router.put(
  "/codebook/extensions",
  withAsync(async (request, response) => {
    const extensions = updateCodebookExtensions(request.body || {});
    fireAndForgetAudit("codebook.extensions.updated", {
      fieldsUpdated: Object.keys(request.body || {}),
      at: new Date().toISOString(),
    });
    response.json({ extensions });
  })
);

router.get(
  "/audit/events",
  withAsync(async (request, response) => {
    const appointmentId = String(request.query.appointmentId || "").trim();
    const doctorRef = String(request.query.doctorRef || "").trim();
    const since = String(request.query.since || "").trim();
    const limit = Number(request.query.limit || 200);
    const events = listAuditEvents({
      appointmentId,
      doctorRef,
      since,
      limit,
    });
    response.json({
      count: events.length,
      events,
    });
  })
);

router.get(
  "/hipaa/settings",
  withAsync(async (_request, response) => {
    const hipaa = getHipaaSettings();
    const recentAudit = listAuditEvents({ limit: 100 });
    response.json({
      hipaa: {
        ...hipaa,
        encryptionStatus: {
          ...hipaa.encryptionStatus,
          openAiConfigured: featureFlags.hasOpenAi,
          azureSpeechConfigured: featureFlags.hasAzureSpeech,
          azureBlobConfigured: featureFlags.hasAzureBlobStorage,
          auditHashChainEnabled: true,
        },
      },
      recentAudit,
    });
  })
);

router.put(
  "/hipaa/settings",
  withAsync(async (request, response) => {
    const hipaa = updateHipaaSettings(request.body || {});
    fireAndForgetAudit("hipaa.settings.updated", {
      fieldsUpdated: Object.keys(request.body || {}),
      at: new Date().toISOString(),
    });
    response.json({ hipaa });
  })
);

router.post(
  "/hipaa/baa-documents",
  upload.single("document"),
  withAsync(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: "Document file is required." });
      return;
    }

    const uploadDir = path.resolve(process.cwd(), "data", "baa-documents");
    await fs.mkdir(uploadDir, { recursive: true });
    const safeName = String(request.file.originalname || "baa-document")
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .slice(0, 180);
    const fileName = `${Date.now()}-${safeName}`;
    const fullPath = path.join(uploadDir, fileName);
    await fs.writeFile(fullPath, request.file.buffer);

    const uploadedBy = String(request.body.uploadedBy || "system").trim() || "system";
    const vendor = String(request.body.vendor || "unknown").trim().toLowerCase() || "unknown";
    const agreementType = String(request.body.agreementType || "BAA").trim() || "BAA";
    const result = addBaaDocument({
      name: request.file.originalname || fileName,
      path: fullPath,
      uploadedBy,
      vendor,
      agreementType,
    });

    fireAndForgetAudit("hipaa.baa.uploaded", {
      name: result.entry.name,
      uploadedBy,
      vendor: result.entry.vendor,
      agreementType: result.entry.agreementType,
      at: result.entry.uploadedAt,
    });

    response.status(201).json({
      document: result.entry,
      hipaa: result.hipaa,
    });
  })
);

router.get(
  "/production/readiness",
  withAsync(async (_request, response) => {
    const settings = getProductionReadinessSettings();
    const status = buildProductionReadinessStatus();
    response.json({
      settings,
      status,
    });
  })
);

router.put(
  "/production/readiness",
  withAsync(async (request, response) => {
    const settings = updateProductionReadinessSettings(request.body || {});
    const status = buildProductionReadinessStatus();

    fireAndForgetAudit("production.readiness.updated", {
      fieldsUpdated: Object.keys(request.body || {}),
      statusScore: status.summary.score,
      blockers: status.summary.blockerCount,
      at: new Date().toISOString(),
    });

    response.json({
      settings,
      status,
    });
  })
);

router.get(
  "/compliance/status",
  withAsync(async (_request, response) => {
    const readiness = buildProductionReadinessStatus();
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
      productionReadiness: {
        readyForProduction: readiness.readyForProduction,
        score: readiness.summary.score,
        blockerCount: readiness.summary.blockerCount,
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
