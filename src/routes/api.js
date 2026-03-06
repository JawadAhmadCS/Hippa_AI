import express from "express";
import multer from "multer";
import { featureFlags } from "../config/env.js";
import {
  addRecording,
  addSuggestions,
  appendTranscriptSegment,
  createAppointment,
  getAppointment,
  setRevenueTracker,
} from "../services/appointment-store.js";
import { writeAuditEvent } from "../services/audit-service.js";
import { getCodebookStatus, searchCodes } from "../services/codebook-service.js";
import { estimateRevenueTracker } from "../services/revenue-service.js";
import { createRealtimeSession } from "../services/openai-service.js";
import { getAzureSpeechToken, uploadAppointmentAudio } from "../services/azure-service.js";
import { inferRuleBasedSuggestions, normalizeRealtimeSuggestions } from "../services/suggestion-service.js";

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
    const appointment = createAppointment({
      patientRef: request.body.patientRef || "anonymous",
      insurancePlan: request.body.insurancePlan || "medicare",
      visitType: request.body.visitType || "follow-up",
      consentGiven: request.body.consentGiven,
    });

    await writeAuditEvent("appointment.created", {
      appointmentId: appointment.id,
      patientRef: appointment.patientRef,
      insurancePlan: appointment.insurancePlan,
      consentGiven: appointment.consentGiven,
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

router.post(
  "/realtime/session",
  withAsync(async (request, response) => {
    if (!featureFlags.hasOpenAi) {
      response.status(503).json({
        error: "OpenAI key is not configured.",
      });
      return;
    }

    const appointmentId = request.body.appointmentId || "unknown-appointment";
    const insurancePlan = request.body.insurancePlan || "medicare";

    const session = await createRealtimeSession({ appointmentId, insurancePlan });
    await writeAuditEvent("realtime.session.created", {
      appointmentId,
      insurancePlan,
      sessionId: session?.id,
    });

    response.json({
      sessionId: session.id,
      model: session.model,
      clientSecret: session?.client_secret?.value ?? null,
      expiresAt: session?.expires_at ?? null,
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

    const segment = String(request.body.segment || "").trim();
    if (!segment) {
      response.status(400).json({ error: "Transcript segment is required." });
      return;
    }

    appendTranscriptSegment(appointment.id, {
      text: segment,
      source: request.body.source || "unknown",
    });

    const existingCodes = new Set(appointment.suggestions.map((item) => item.code));
    const suggestions = inferRuleBasedSuggestions({ segment, existingCodes });
    const merged = addSuggestions(appointment.id, suggestions, "rule-engine");

    const tracker = estimateRevenueTracker({
      insurancePlan: appointment.insurancePlan,
      baselineCode: "99213",
      suggestions: appointment.suggestions,
    });
    setRevenueTracker(appointment.id, tracker);

    await writeAuditEvent("appointment.transcript.segment", {
      appointmentId: appointment.id,
      source: request.body.source || "unknown",
      segment,
      generatedCodes: merged?.newlyAdded?.map((item) => item.code) ?? [],
    });

    response.json({
      transcriptCount: appointment.transcriptSegments.length,
      newlyAddedSuggestions: merged?.newlyAdded ?? [],
      allSuggestions: appointment.suggestions,
      revenueTracker: appointment.revenueTracker,
    });
  })
);

router.post(
  "/appointments/:appointmentId/realtime-suggestions",
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response);
    if (!appointment) return;

    const rawSuggestions = request.body.suggestions;
    const normalized = normalizeRealtimeSuggestions(rawSuggestions);
    const merged = addSuggestions(appointment.id, normalized, "openai-realtime");

    const tracker = estimateRevenueTracker({
      insurancePlan: appointment.insurancePlan,
      baselineCode: "99213",
      suggestions: appointment.suggestions,
    });
    setRevenueTracker(appointment.id, tracker);

    await writeAuditEvent("appointment.realtime.suggestions", {
      appointmentId: appointment.id,
      acceptedCodes: merged?.newlyAdded?.map((item) => item.code) ?? [],
      countReceived: Array.isArray(rawSuggestions) ? rawSuggestions.length : 0,
    });

    response.json({
      newlyAddedSuggestions: merged?.newlyAdded ?? [],
      allSuggestions: appointment.suggestions,
      revenueTracker: appointment.revenueTracker,
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
        openAiRealtimeConfigured: featureFlags.hasOpenAi,
        azureSpeechConfigured: featureFlags.hasAzureSpeech,
        azureBlobConfigured: featureFlags.hasAzureBlobStorage,
      },
      notes: [
        "Prototype enforces consent gate before transcription capture.",
        "Audit trail uses hash chaining and PHI-redacted payloads.",
        "Final coding should always be reviewed by certified billing/coding staff.",
      ],
    });
  })
);

export default router;

