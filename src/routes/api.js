import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { env, featureFlags } from "../config/env.js";
import {
  addOverrideRecord,
  addRecording,
  appendTranscriptSegment,
  createAppointment,
  ensureNoteDraftVersion,
  finalizeCurrentNote,
  getCurrentNoteAnalysis,
  getCurrentNoteVersion,
  getFinalizedNotePacket,
  getAppointment,
  persistAppointmentStore,
  listAppointmentRecords,
  listNoteVersions,
  listAppointments,
  setCurrentNoteAnalysis,
  setRevenueTracker,
  upsertDraftNoteVersion,
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
import {
  normalizeIncomingTranscript,
  parseAwsTranscribeMedicalPayload,
  parseTelehealthTranscriptPayload,
} from "../services/stt-service.js";
import {
  broadcastAppointmentEvent,
  subscribeToAppointmentStream,
} from "../services/streaming-service.js";
import { normalizeTranscriptSegment } from "../services/transcript-service.js";
import { buildRevenueCsv, buildRevenueReport } from "../services/reporting-service.js";
import {
  authenticateToken,
  getAuthConstants,
  getUserMfaSettings,
  loginWithPassword,
  requiresRecentMfa,
  revokeSession,
  sendLoginSmsCode,
  startUserTotpSetup,
  updateUserMfaSettings,
  verifyLogin2fa,
  verifyUserTotpSetup,
} from "../services/auth-service.js";
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
import { recalculateNoteCoding } from "../services/note-analysis-service.js";
import { getPatientChartByRef, searchPatientCharts } from "../services/patient-chart-service.js";
import { writeFinalizedNoteToEhr } from "../services/ehr-service.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const ensureAppointment = (id, response, auth = null) => {
  const appointment = getAppointment(id);
  if (!appointment) {
    response.status(404).json({ error: "Appointment not found." });
    return null;
  }
  if (auth && auth.clientId && appointment.clientId && String(auth.clientId) !== String(appointment.clientId)) {
    response.status(403).json({ error: "Appointment is outside your clinic scope." });
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

const extractSessionToken = (request) => {
  const fromQuery = String(request.query?.accessToken || "").trim();
  if (fromQuery) return fromQuery;

  const bearer = String(request.get("authorization") || "").trim();
  if (bearer.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }
  return String(request.get("x-session-token") || "").trim();
};

const requireAuth = ({ roles = [], requireFreshMfa = false } = {}) => (request, response, next) => {
  const token = extractSessionToken(request);
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const session = authenticateToken(token);
  if (!session) {
    response.status(401).json({ error: "Session expired or invalid." });
    return;
  }

  if (Array.isArray(roles) && roles.length && !roles.includes(session.role)) {
    response.status(403).json({ error: "Forbidden for this role." });
    return;
  }

  if (requireFreshMfa && !requiresRecentMfa(session, getAuthConstants().mfaFreshWindowMs)) {
    response.status(403).json({
      error: "Re-authentication required before this action.",
      code: "recent_mfa_required",
    });
    return;
  }

  request.auth = session;
  request.authToken = token;
  next();
};

const normalizeDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const splitFullName = (value = "") => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return {
      firstName: "",
      lastName: "",
    };
  }
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const toInsuranceLabel = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildPatientProfileForAppointment = ({
  chartPatient = null,
  patientRef = "",
  insurancePlan = "",
} = {}) => {
  const fullName = String(chartPatient?.fullName || "").trim();
  const split = splitFullName(fullName);
  return {
    patientRef: String(chartPatient?.patientRef || patientRef || "")
      .trim()
      .toUpperCase(),
    externalChartId: String(chartPatient?.externalChartId || "").trim().toUpperCase(),
    fullName,
    firstName: split.firstName,
    lastName: split.lastName,
    dob: String(chartPatient?.dob || "").trim(),
    insuranceInfo: toInsuranceLabel(insurancePlan),
  };
};

const filterAppointments = ({
  search = "",
  dateFrom = "",
  dateTo = "",
  clinicId = "",
} = {}) => {
  const query = String(search || "").trim().toLowerCase();
  const start = normalizeDateOrNull(dateFrom);
  const end = normalizeDateOrNull(dateTo);
  if (end) end.setHours(23, 59, 59, 999);

  return listAppointments().filter((appointment) => {
    if (clinicId && String(appointment.clientId || "") !== String(clinicId)) {
      return false;
    }

    if (query) {
      const haystack = [
        appointment.id,
        appointment.patientRef,
        appointment.patientFirstName,
        appointment.patientLastName,
        appointment.patientDob,
        appointment.patientInsuranceInfo,
        appointment.doctorRef,
        appointment.insurancePlan,
        appointment.visitType,
        appointment.clientId,
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

const buildNotePayload = ({ appointment, version, analysis, includeVersions = false }) => {
  const workflow = appointment.noteWorkflow || {};
  return {
    note: {
      noteId: workflow.noteId,
      status: workflow.status || "draft",
      locked: Boolean(workflow.locked),
      currentVersionId: workflow.currentVersionId || "",
      finalizedVersionId: workflow.finalizedVersionId || "",
      finalizedAt: workflow.finalizedAt || null,
      version: version || null,
      versions: includeVersions
        ? listNoteVersions(appointment.id).map((item) => ({
            versionId: item.versionId,
            versionNumber: item.versionNumber,
            versionType: item.versionType,
            isFinal: item.isFinal,
            createdBy: item.createdBy,
            actorRole: item.actorRole,
            createdAt: item.createdAt,
            changeCount: Number(item?.diffFromPrior?.changeCount || 0),
          }))
        : undefined,
      overrideRecords: workflow.overrideRecords || [],
      delivery: workflow.delivery || {},
    },
    codingAnalysis: analysis || null,
  };
};

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
  "/auth/login",
  withAsync(async (request, response) => {
    const username = String(request.body.username || "").trim().toLowerCase();
    const password = String(request.body.password || "");
    const clientId = String(request.body.clientId || "").trim().toLowerCase();
    if (!username || !password) {
      response.status(400).json({ error: "Username and password are required." });
      return;
    }

    const result = loginWithPassword({
      username,
      password,
      clientId,
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
    if (!result.ok) {
      fireAndForgetAudit("auth.login.failed", {
        username,
        clientId,
        reason: result.error,
        ip: request.ip,
      });
      response.status(401).json({ error: result.error || "Login failed." });
      return;
    }

    fireAndForgetAudit("auth.login.password.accepted", {
      username,
      clientId,
      ip: request.ip,
      mfaRequired: Boolean(result.mfaRequired),
    });
    if (!result.mfaRequired) {
      response.json({
        mfaRequired: false,
        token: result.token,
        expiresAt: result.expiresAt,
        mfaMethod: result.mfaMethod || "none",
        user: result.user,
      });
      return;
    }
    response.json(result.challenge);
  })
);

router.post(
  "/auth/2fa/sms/send",
  withAsync(async (request, response) => {
    const challengeId = String(request.body.challengeId || "").trim();
    if (!challengeId) {
      response.status(400).json({ error: "challengeId is required." });
      return;
    }

    const result = sendLoginSmsCode({ challengeId });
    if (!result.ok) {
      fireAndForgetAudit("auth.login.2fa.sms.failed", {
        challengeId,
        ip: request.ip,
        reason: result.error,
      });
      response.status(400).json({ error: result.error || "Unable to send SMS code." });
      return;
    }

    fireAndForgetAudit("auth.login.2fa.sms.sent", {
      challengeId,
      ip: request.ip,
      destination: result.destination,
    });
    response.json({
      ok: true,
      method: result.method,
      destination: result.destination,
      sentAt: result.sentAt,
      expiresAt: result.expiresAt,
      devCode: result.devCode,
    });
  })
);

router.post(
  "/auth/2fa/verify",
  withAsync(async (request, response) => {
    const challengeId = String(request.body.challengeId || "").trim();
    const code = String(request.body.code || "").trim();
    const method = String(request.body.method || "totp").trim().toLowerCase();
    if (!challengeId || !code) {
      response.status(400).json({ error: "challengeId and code are required." });
      return;
    }

    const result = verifyLogin2fa({
      challengeId,
      code,
      method,
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
    if (!result.ok) {
      fireAndForgetAudit("auth.login.2fa.failed", {
        challengeId,
        method,
        ip: request.ip,
        reason: result.error,
      });
      response.status(401).json({ error: result.error || "2FA verification failed." });
      return;
    }

    fireAndForgetAudit("auth.login.success", {
      userId: result.user?.id,
      username: result.user?.username,
      role: result.user?.role,
      method: result.mfaMethod,
      ip: request.ip,
    });
    response.json({
      token: result.token,
      expiresAt: result.expiresAt,
      mfaMethod: result.mfaMethod,
      user: result.user,
    });
  })
);

router.post(
  "/auth/logout",
  requireAuth(),
  withAsync(async (request, response) => {
    revokeSession(request.authToken);
    fireAndForgetAudit("auth.logout", {
      userId: request.auth.userId,
      username: request.auth.username,
      role: request.auth.role,
      sessionId: request.auth.sessionId,
      ip: request.ip,
    });
    response.json({ ok: true });
  })
);

router.get(
  "/auth/me",
  requireAuth(),
  withAsync(async (request, response) => {
    response.json({
      user: {
        id: request.auth.userId,
        username: request.auth.username,
        role: request.auth.role,
        displayName: request.auth.displayName,
        clientId: request.auth.clientId || "default-clinic",
        clientName: request.auth.clientName || "Default Clinic",
        specialties: Array.isArray(request.auth.specialties) ? request.auth.specialties : [],
      },
      session: {
        sessionId: request.auth.sessionId,
        expiresAt: request.auth.expiresAt,
        mfaMethod: request.auth.mfaMethod || "totp",
      },
    });
  })
);

router.get(
  "/patient-charts/search",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const query = String(request.query.q || "").trim();
    const limit = Number(request.query.limit || 12);
    const clinicId = String(request.auth.clientId || "").trim();
    const patients = searchPatientCharts({
      query,
      clinicId,
      limit,
    });
    response.json({
      count: patients.length,
      clinicId,
      patients,
    });
  })
);

router.get(
  "/patient-charts/:patientRef",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const patientRef = String(request.params.patientRef || "").trim().toUpperCase();
    if (!patientRef) {
      response.status(400).json({ error: "patientRef is required." });
      return;
    }

    const patient = getPatientChartByRef({
      patientRef,
      clinicId: request.auth.clientId || "",
    });
    if (!patient) {
      response.status(404).json({ error: "Patient chart not found for this clinic." });
      return;
    }

    response.json({ patient });
  })
);

router.post(
  "/appointments",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const doctorRef = String(request.auth.username || request.body.doctorRef || "").trim();
    const requestedPatientRef = String(request.body.patientRef || "").trim().toUpperCase();
    const chartPatient = requestedPatientRef
      ? getPatientChartByRef({
          patientRef: requestedPatientRef,
          clinicId: request.auth.clientId || "",
        })
      : null;
    const patientRef = chartPatient?.patientRef || requestedPatientRef || "anonymous";
    const patientChartId = String(
      chartPatient?.externalChartId || request.body.patientChartId || ""
    )
      .trim()
      .toUpperCase();
    const consentFormId = String(request.body.consentFormId || "").trim();
    const consentGiven = Boolean(request.body.consentGiven);
    const encounterMode = String(request.body.encounterMode || "in-person")
      .trim()
      .toLowerCase();
    const telehealthPlatform =
      encounterMode === "telehealth"
        ? String(request.body.telehealthPlatform || "generic").trim().toLowerCase()
        : "";
    const insurancePlan = String(request.body.insurancePlan || "medicare")
      .trim()
      .toLowerCase();
    const patientProfile = buildPatientProfileForAppointment({
      chartPatient,
      patientRef,
      insurancePlan,
    });

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
      patientProfile,
      patientChartId,
      doctorRef,
      doctorSpecialties: Array.isArray(request.auth.specialties) ? request.auth.specialties : [],
      clientId: request.auth.clientId || "default-clinic",
      clientName: request.auth.clientName || "Default Clinic",
      insurancePlan,
      visitType: request.body.visitType || "follow-up",
      encounterMode,
      telehealthPlatform,
      consentGiven,
      consentFormId,
      consentSignedAt: request.body.consentSignedAt,
    });

    fireAndForgetAudit("appointment.created", {
      appointmentId: appointment.id,
      patientRef: appointment.patientRef,
      patientProfile: appointment.patientProfile,
      patientChartId: appointment.patientChartId,
      doctorRef: appointment.doctorRef,
      doctorSpecialties: appointment.doctorSpecialties,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      insurancePlan: appointment.insurancePlan,
      encounterMode: appointment.encounterMode,
      telehealthPlatform: appointment.telehealthPlatform,
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const search = String(request.query.q || "").trim();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    let appointments = filterAppointments({
      search,
      dateFrom,
      dateTo,
      clinicId: request.auth.clientId || "",
    });
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;
    response.json({ appointment });
  })
);

router.get(
  "/appointments/:appointmentId/note",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;

    const version = ensureNoteDraftVersion(appointment.id) || getCurrentNoteVersion(appointment.id);
    if (!version) {
      response.status(500).json({ error: "Unable to initialize note draft." });
      return;
    }

    let analysis = getCurrentNoteAnalysis(appointment.id);
    if (!analysis) {
      analysis = await recalculateNoteCoding({
        appointment,
        noteContent: version.contentJson,
      });
      setCurrentNoteAnalysis(appointment.id, analysis);
      setRevenueTracker(appointment.id, analysis.revenueTracker || appointment.revenueTracker);
    }

    response.json(
      buildNotePayload({
        appointment,
        version,
        analysis,
        includeVersions: String(request.query.includeVersions || "false") === "true",
      })
    );
  })
);

router.put(
  "/appointments/:appointmentId/note",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;

    const currentVersion = ensureNoteDraftVersion(appointment.id) || getCurrentNoteVersion(appointment.id);
    if (!currentVersion) {
      response.status(500).json({ error: "Unable to load note version." });
      return;
    }

    const allowAfterFinal = String(request.body.allowAfterFinal || "false").toLowerCase() === "true";
    const content = request.body.content || currentVersion.contentJson;
    const updated = upsertDraftNoteVersion({
      appointmentId: appointment.id,
      content,
      actorId: request.auth.userId,
      actorRole: request.auth.role,
      allowAfterFinal,
    });

    if (updated?.error === "finalized-note-locked") {
      response.status(409).json({
        error: "Finalized note is read-only. Submit amendment workflow to continue.",
        code: "finalized-note-locked",
      });
      return;
    }

    const version = updated?.version || currentVersion;
    const analysis = await recalculateNoteCoding({
      appointment,
      noteContent: version.contentJson,
    });
    setCurrentNoteAnalysis(appointment.id, analysis);
    setRevenueTracker(appointment.id, analysis.revenueTracker || appointment.revenueTracker);

    const overrides = Array.isArray(request.body.overrides) ? request.body.overrides : [];
    for (const item of overrides) {
      const originalCode = String(item?.originalCode || "").trim().toUpperCase();
      const finalCode = String(item?.finalCode || "").trim().toUpperCase();
      const reason = String(item?.reason || "").trim();
      if (!originalCode || !finalCode || originalCode === finalCode) continue;
      addOverrideRecord({
        appointmentId: appointment.id,
        originalCode,
        finalCode,
        reason,
        providerId: request.auth.userId,
      });
    }

    fireAndForgetAudit("note.edited", {
      appointmentId: appointment.id,
      noteId: appointment.noteWorkflow?.noteId,
      versionId: version.versionId,
      actorId: request.auth.userId,
      actorRole: request.auth.role,
      changedFields: version?.diffFromPrior?.changedFields || [],
      overrideCount: overrides.length,
    });

    response.json(
      buildNotePayload({
        appointment,
        version,
        analysis,
        includeVersions: true,
      })
    );
  })
);

router.post(
  "/appointments/:appointmentId/note/recalculate",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;

    const current = ensureNoteDraftVersion(appointment.id) || getCurrentNoteVersion(appointment.id);
    if (!current) {
      response.status(500).json({ error: "Unable to load note version." });
      return;
    }

    const content = request.body.content || current.contentJson;
    const analysis = await recalculateNoteCoding({
      appointment,
      noteContent: content,
    });
    setCurrentNoteAnalysis(appointment.id, analysis);
    setRevenueTracker(appointment.id, analysis.revenueTracker || appointment.revenueTracker);
    response.json({ codingAnalysis: analysis });
  })
);

router.post(
  "/appointments/:appointmentId/note/finalize",
  requireAuth({ roles: ["provider", "admin"], requireFreshMfa: true }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;

    const current = ensureNoteDraftVersion(appointment.id) || getCurrentNoteVersion(appointment.id);
    if (!current) {
      response.status(500).json({ error: "Unable to load note version." });
      return;
    }

    const finalCodes = Array.isArray(request.body.finalCodes)
      ? request.body.finalCodes.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
      : null;
    const overrideReason = String(request.body.overrideReason || "").trim();
    const overrides = Array.isArray(request.body.overrides) ? request.body.overrides : [];
    for (const item of overrides) {
      const originalCode = String(item?.originalCode || "").trim().toUpperCase();
      const finalCode = String(item?.finalCode || "").trim().toUpperCase();
      const reason = String(item?.reason || overrideReason || "").trim();
      if (!finalCode) continue;
      addOverrideRecord({
        appointmentId: appointment.id,
        originalCode,
        finalCode,
        reason,
        providerId: request.auth.userId,
      });
    }

    const result = finalizeCurrentNote({
      appointmentId: appointment.id,
      actorId: request.auth.userId,
      actorRole: request.auth.role,
      overrideReason,
      finalCodes,
    });
    if (!result) {
      response.status(500).json({ error: "Unable to finalize note." });
      return;
    }

    const finalizedPacket = getFinalizedNotePacket(appointment.id);
    let ehrWrite = null;
    if (finalizedPacket) {
      ehrWrite = await writeFinalizedNoteToEhr({
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        doctorRef: appointment.doctorRef,
        patientRef: appointment.patientRef,
        patientChartId: appointment.patientChartId,
        finalVersion: finalizedPacket.finalVersion,
        codingAnalysis: finalizedPacket.codingAnalysis,
      }).catch(() => null);
    }
    if (ehrWrite) {
      appointment.noteWorkflow.delivery = {
        ...(appointment.noteWorkflow?.delivery || {}),
        ehrSentAt: ehrWrite.writtenAt,
        ehrDestination: ehrWrite.destination,
        ehrExternalRecordId: ehrWrite.externalRecordId,
      };
      result.delivery = {
        ...(result.delivery || {}),
        ...appointment.noteWorkflow.delivery,
      };
      persistAppointmentStore();
    }

    broadcastAppointmentEvent(appointment.id, "note.finalized", {
      appointmentId: appointment.id,
      noteId: appointment.noteWorkflow?.noteId,
      finalizedAt: result.version?.finalizedAt || new Date().toISOString(),
      versionId: result.version?.versionId,
      actorId: request.auth.userId,
      actorRole: request.auth.role,
    });

    fireAndForgetAudit("note.finalized", {
      appointmentId: appointment.id,
      noteId: appointment.noteWorkflow?.noteId,
      versionId: result.version?.versionId,
      actorId: request.auth.userId,
      actorRole: request.auth.role,
      finalCodes: result.version?.finalCodes || [],
      overrideReason,
      overrideCount: overrides.length,
      delivery: result.delivery,
      ehrWrite,
    });

    response.json(
      buildNotePayload({
        appointment,
        version: result.version,
        analysis: getCurrentNoteAnalysis(appointment.id),
        includeVersions: true,
      })
    );
  })
);

router.get(
  "/appointments/:appointmentId/note/versions",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;
    const versions = listNoteVersions(appointment.id);
    response.json({
      appointmentId: appointment.id,
      noteId: appointment.noteWorkflow?.noteId,
      status: appointment.noteWorkflow?.status,
      versions,
    });
  })
);

router.get(
  "/billing/queue",
  requireAuth({ roles: ["billing", "admin"] }),
  withAsync(async (request, response) => {
    const queue = listAppointmentRecords()
      .filter((item) =>
        request.auth.clientId ? String(item.clientId || "") === String(request.auth.clientId) : true
      )
      .map((item) => getFinalizedNotePacket(item.id))
      .filter(Boolean)
      .filter((packet) => !packet.billingAccessExpired)
      .map((packet) => ({
        appointmentId: packet.appointmentId,
        appointmentTime: packet.appointmentTime || null,
        patientRef: packet.patientRef,
        patientProfile: packet.patientProfile || {},
        patientChartId: packet.patientChartId,
        doctorRef: packet.doctorRef,
        encounterMode: packet.encounterMode,
        telehealthPlatform: packet.telehealthPlatform,
        noteId: packet.noteId,
        finalizedAt: packet.finalizedAt,
        expectedRevenueFromAppointment: Number(packet.expectedRevenueFromAppointment || 0),
        mergedRevenue: packet.mergedRevenue || null,
        billingAccessExpiresAt: packet.billingAccessExpiresAt,
        approvedCodes: packet.approvedCodes || [],
        confidence: packet.codingAnalysis?.confidence || 0,
      }));
    response.json({ count: queue.length, queue });
  })
);

router.get(
  "/billing/appointments/:appointmentId/final",
  requireAuth({ roles: ["billing", "admin"] }),
  withAsync(async (request, response) => {
    const packet = getFinalizedNotePacket(request.params.appointmentId);
    if (!packet) {
      response.status(404).json({ error: "No finalized note available for billing." });
      return;
    }
    if (packet.billingAccessExpired) {
      response.status(410).json({
        error: "Finalized note exceeded the 60-day billing portal retention window.",
        billingAccessExpiresAt: packet.billingAccessExpiresAt,
      });
      return;
    }
    if (
      request.auth.clientId &&
      packet.clientId &&
      String(request.auth.clientId) !== String(packet.clientId)
    ) {
      response.status(403).json({ error: "Appointment is outside your clinic scope." });
      return;
    }
    response.json(packet);
  })
);

router.get(
  "/appointments/:appointmentId/transcript.pdf",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const granularity = String(request.query.granularity || "daily").trim().toLowerCase();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    const report = buildRevenueReport({
      granularity,
      dateFrom,
      dateTo,
      clinicId: request.auth.clientId || "",
    });
    response.json(report);
  })
);

router.get(
  "/reports/revenue/export.csv",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const granularity = String(request.query.granularity || "daily").trim().toLowerCase();
    const dateFrom = String(request.query.dateFrom || "").trim();
    const dateTo = String(request.query.dateTo || "").trim();
    const report = buildRevenueReport({
      granularity,
      dateFrom,
      dateTo,
      clinicId: request.auth.clientId || "",
    });
    const csv = buildRevenueCsv({ report });
    const fileName = `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.send(csv);
  })
);

router.get(
  "/appointments/:appointmentId/stream",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (_request, response) => {
    const token = await getAzureSpeechToken();
    response.json(token);
  })
);

router.post(
  "/appointments/:appointmentId/transcript",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
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
  "/appointments/:appointmentId/transcript/telehealth",
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;

    if (!appointment.consentGiven) {
      response.status(403).json({ error: "Consent is required before recording/transcription." });
      return;
    }

    const parsed = parseTelehealthTranscriptPayload(request.body || {});
    if (!parsed.segments.length) {
      response.status(202).json({
        accepted: false,
        reason: "no-usable-telehealth-segments",
        stt: { provider: parsed.provider, platform: parsed.platform, segmentsReceived: 0 },
      });
      return;
    }

    const finalSegments = parsed.segments.filter((item) => !item.isPartial);
    if (!finalSegments.length) {
      const latestPartial = parsed.segments[parsed.segments.length - 1] || null;
      broadcastAppointmentEvent(appointment.id, "transcript.partial", {
        appointmentId: appointment.id,
        provider: parsed.provider,
        partialText: latestPartial?.text || "",
        at: new Date().toISOString(),
      });

      response.status(202).json({
        accepted: false,
        partial: true,
        reason: "telehealth-partial-only",
        stt: {
          provider: parsed.provider,
          platform: parsed.platform,
          segmentsReceived: parsed.segments.length,
        },
      });
      return;
    }

    const mergedText = finalSegments
      .map((segment) =>
        segment.speaker ? `${segment.speaker}: ${segment.text}` : String(segment.text || "")
      )
      .filter(Boolean)
      .join(" ");
    const source = parsed.provider;

    const payload = await processTranscriptSegment({
      appointment,
      rawSegment: mergedText,
      source,
    });

    response.json({
      ...payload,
      stt: {
        provider: parsed.provider,
        platform: parsed.platform,
        segmentsReceived: parsed.segments.length,
        processedFinalSegments: finalSegments.length,
      },
    });
  })
);

router.post(
  "/appointments/:appointmentId/audio",
  requireAuth({ roles: ["provider", "admin"] }),
  upload.single("audio"),
  withAsync(async (request, response) => {
    const appointment = ensureAppointment(request.params.appointmentId, response, request.auth);
    if (!appointment) return;
    if (!request.file) {
      response.status(400).json({ error: "Audio file is required." });
      return;
    }

    const hipaaSettings = getHipaaSettings();
    const retentionFromHipaa = Number(hipaaSettings?.dataRetentionDays || 0);
    const retentionDays = Number.isFinite(retentionFromHipaa) && retentionFromHipaa > 0
      ? Math.floor(retentionFromHipaa)
      : env.recordingRetentionDays;

    const uploaded = await uploadAppointmentAudio({
      appointmentId: appointment.id,
      buffer: request.file.buffer,
      mimeType: request.file.mimetype,
      fileName: request.file.originalname,
      retentionDays,
    });

    addRecording(appointment.id, uploaded);
    fireAndForgetAudit("appointment.audio.uploaded", {
      appointmentId: appointment.id,
      doctorRef: appointment.doctorRef,
      provider: uploaded.provider,
      mimeType: uploaded.mimeType,
      blobName: uploaded.blobName,
      retentionDays: uploaded.retentionDays,
      retentionExpiresAt: uploaded.retentionExpiresAt,
    });

    response.status(201).json({ recording: uploaded });
  })
);

router.get(
  "/codebook",
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (request, response) => {
    const results = searchCodes(request.query.q || "");
    response.json({ results });
  })
);

router.get(
  "/settings/general",
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["provider", "admin"] }),
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
  "/settings/security/2fa",
  requireAuth(),
  withAsync(async (request, response) => {
    const result = getUserMfaSettings({ userId: request.auth.userId });
    if (!result.ok) {
      response.status(404).json({ error: result.error || "Unable to load 2FA settings." });
      return;
    }
    response.json({
      settings: result.settings,
      user: result.user,
    });
  })
);

router.put(
  "/settings/security/2fa",
  requireAuth(),
  withAsync(async (request, response) => {
    const payload = request.body || {};
    const result = updateUserMfaSettings({
      userId: request.auth.userId,
      mfaEnabled: typeof payload.mfaEnabled === "boolean" ? payload.mfaEnabled : undefined,
      sms2faEnabled: typeof payload.sms2faEnabled === "boolean" ? payload.sms2faEnabled : undefined,
    });
    if (!result.ok) {
      response.status(400).json({ error: result.error || "Unable to update 2FA settings." });
      return;
    }
    fireAndForgetAudit("settings.security.2fa.updated", {
      userId: request.auth.userId,
      username: request.auth.username,
      role: request.auth.role,
      mfaEnabled: result.settings?.mfaEnabled,
      sms2faEnabled: result.settings?.sms2faEnabled,
      at: new Date().toISOString(),
    });
    response.json({
      settings: result.settings,
      user: result.user,
    });
  })
);

router.post(
  "/settings/security/2fa/setup",
  requireAuth(),
  withAsync(async (request, response) => {
    const result = startUserTotpSetup({ userId: request.auth.userId });
    if (!result.ok) {
      response.status(400).json({ error: result.error || "Unable to start authenticator setup." });
      return;
    }
    fireAndForgetAudit("settings.security.2fa.setup.started", {
      userId: request.auth.userId,
      username: request.auth.username,
      role: request.auth.role,
      at: new Date().toISOString(),
    });
    response.json({
      setup: result.setup,
      settings: result.settings,
      user: result.user,
    });
  })
);

router.post(
  "/settings/security/2fa/verify",
  requireAuth(),
  withAsync(async (request, response) => {
    const code = String(request.body.code || "").trim();
    if (!code) {
      response.status(400).json({ error: "2FA code is required." });
      return;
    }
    const result = verifyUserTotpSetup({
      userId: request.auth.userId,
      code,
      enableMfa: true,
    });
    if (!result.ok) {
      response.status(400).json({ error: result.error || "Unable to verify authenticator setup." });
      return;
    }
    fireAndForgetAudit("settings.security.2fa.setup.verified", {
      userId: request.auth.userId,
      username: request.auth.username,
      role: request.auth.role,
      at: new Date().toISOString(),
    });
    response.json({
      settings: result.settings,
      user: result.user,
    });
  })
);

router.get(
  "/preferences",
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["provider", "admin"] }),
  withAsync(async (_request, response) => {
    response.json({
      extensions: getCodebookExtensions(),
    });
  })
);

router.put(
  "/codebook/extensions",
  requireAuth({ roles: ["provider", "admin"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
  requireAuth({ roles: ["admin", "provider"] }),
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
        telehealthTranscriptIngestion: true,
        realtimeStreamingConfigured: true,
        ehrWritebackOnFinalize: true,
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
        "Finalized chart notes are written to a mock EHR adapter with external record IDs.",
        "Final coding should always be reviewed by certified billing/coding staff.",
      ],
    });
  })
);

export default router;

