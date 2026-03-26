import crypto from "node:crypto";

const appointments = new Map();
const NOTE_FIELDS = ["hpi", "ros", "exam", "assessment", "plan"];
const NOTE_EXTRA_FIELDS = ["freeTextAdditions"];

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const nowIso = () => new Date().toISOString();

const normalizeNoteValue = (value) => String(value || "").trim();
const mergeProviderAdditions = (content = {}) =>
  [
    normalizeNoteValue(content?.additionalProviderNotes),
    normalizeNoteValue(content?.freeTextAdditions),
  ]
    .filter(Boolean)
    .join("\n\n");

const normalizeNoteContent = (content = {}) => ({
  sections: {
    hpi: normalizeNoteValue(content?.sections?.hpi),
    ros: normalizeNoteValue(content?.sections?.ros),
    exam: normalizeNoteValue(content?.sections?.exam),
    assessment: normalizeNoteValue(content?.sections?.assessment),
    plan: normalizeNoteValue(content?.sections?.plan),
  },
  additionalProviderNotes: "",
  freeTextAdditions: mergeProviderAdditions(content),
});

const emptyNoteContent = () => normalizeNoteContent({});

const getFieldPathValue = (content, key) => {
  if (NOTE_FIELDS.includes(key)) return normalizeNoteValue(content?.sections?.[key]);
  if (NOTE_EXTRA_FIELDS.includes(key)) return normalizeNoteValue(content?.[key]);
  return "";
};

const buildInitialSourceMetadata = ({ actorId = "ai-assistant", actorRole = "system" } = {}) => {
  const at = nowIso();
  const fields = {};
  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    fields[key] = {
      sourceType: "ai_generated",
      createdBy: actorId,
      updatedBy: actorId,
      actorRole,
      createdAt: at,
      updatedAt: at,
    };
  }
  return { fields };
};

const deriveSourceMetadata = ({
  previousContent,
  nextContent,
  previousMetadata,
  actorId,
  actorRole,
}) => {
  const at = nowIso();
  const nextMetadata = {
    fields: { ...(previousMetadata?.fields || {}) },
  };

  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    const before = getFieldPathValue(previousContent, key);
    const after = getFieldPathValue(nextContent, key);
    const prior = previousMetadata?.fields?.[key];

    if (before === after) {
      nextMetadata.fields[key] = {
        ...(prior || {
          sourceType: "ai_generated",
          createdBy: "ai-assistant",
          updatedBy: "ai-assistant",
          actorRole: "system",
          createdAt: at,
          updatedAt: at,
        }),
      };
      continue;
    }

    const sourceType = before ? "provider_edited" : "provider_added";
    nextMetadata.fields[key] = {
      sourceType,
      createdBy: prior?.createdBy || actorId,
      updatedBy: actorId,
      actorRole,
      createdAt: prior?.createdAt || at,
      updatedAt: at,
    };
  }

  return nextMetadata;
};

const computeNoteDiff = (previousContent, nextContent) => {
  const changes = [];
  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    const before = getFieldPathValue(previousContent, key);
    const after = getFieldPathValue(nextContent, key);
    if (before === after) continue;
    changes.push({
      field: key,
      before,
      after,
    });
  }
  return {
    changedFields: changes.map((item) => item.field),
    changes,
    changeCount: changes.length,
  };
};

const mapChartNotesToContent = (appointment) => {
  const linesBySection = {
    hpi: [],
    ros: [],
    exam: [],
    assessment: [],
    plan: [],
  };

  const chartNotes = Array.isArray(appointment?.liveInsights?.chartNotes)
    ? appointment.liveInsights.chartNotes
    : [];

  for (const note of chartNotes) {
    const category = String(note?.category || "").toLowerCase();
    const text = [note?.text, note?.detail].filter(Boolean).join(" ");
    if (!text) continue;

    if (category.includes("hpi") || category.includes("symptom")) {
      linesBySection.hpi.push(text);
      continue;
    }
    if (category.includes("ros")) {
      linesBySection.ros.push(text);
      continue;
    }
    if (category.includes("exam") || category.includes("physical")) {
      linesBySection.exam.push(text);
      continue;
    }
    if (category.includes("assessment")) {
      linesBySection.assessment.push(text);
      continue;
    }
    linesBySection.plan.push(text);
  }

  if (!linesBySection.hpi.length && Array.isArray(appointment?.transcriptSegments)) {
    const lastSegment = appointment.transcriptSegments[appointment.transcriptSegments.length - 1];
    const fallback = String(lastSegment?.cleanedText || lastSegment?.text || "").trim();
    if (fallback) {
      linesBySection.hpi.push(`Encounter discussion: ${fallback}`);
    }
  }

  return normalizeNoteContent({
    sections: {
      hpi: linesBySection.hpi.join("\n"),
      ros: linesBySection.ros.join("\n"),
      exam: linesBySection.exam.join("\n"),
      assessment: linesBySection.assessment.join("\n"),
      plan: linesBySection.plan.join("\n"),
    },
    freeTextAdditions: "",
  });
};

const buildNoteVersionRecord = ({
  appointment,
  content,
  actorId,
  actorRole,
  versionType = "provider_edit",
  previousVersion = null,
  forceFinal = false,
  metadataOverride = null,
  analysisSnapshot = null,
}) => {
  const normalizedContent = normalizeNoteContent(content);
  const previousContent = normalizeNoteContent(previousVersion?.contentJson || emptyNoteContent());
  const sourceMetadata =
    metadataOverride ||
    deriveSourceMetadata({
      previousContent,
      nextContent: normalizedContent,
      previousMetadata: previousVersion?.sourceMetadata || buildInitialSourceMetadata(),
      actorId,
      actorRole,
    });

  const diff = computeNoteDiff(previousContent, normalizedContent);
  const versionNumber = Number(previousVersion?.versionNumber || 0) + 1;
  const createdAt = nowIso();

  return {
    versionId: crypto.randomUUID(),
    noteId: appointment.noteWorkflow.noteId,
    versionNumber,
    versionType,
    isFinal: Boolean(forceFinal),
    contentJson: normalizedContent,
    sourceMetadata,
    diffFromPrior: diff,
    createdBy: actorId,
    actorRole,
    createdAt,
    analysisSnapshot: analysisSnapshot || appointment.noteWorkflow.currentAnalysis || null,
  };
};

const buildAppointmentSummary = (appointment) => {
  const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];
  const finalCptCodes = billableCodes.map((item) => item.code).filter(Boolean);

  return {
    id: appointment.id,
    patientRef: appointment.patientRef,
    patientChartId: appointment.patientChartId,
    doctorRef: appointment.doctorRef,
    doctorSpecialties: Array.isArray(appointment.doctorSpecialties) ? appointment.doctorSpecialties : [],
    clientId: appointment.clientId || "default-clinic",
    clientName: appointment.clientName || "Default Clinic",
    insurancePlan: appointment.insurancePlan,
    visitType: appointment.visitType,
    encounterMode: appointment.encounterMode || "in-person",
    telehealthPlatform: appointment.telehealthPlatform || "",
    consentGiven: appointment.consentGiven,
    createdAt: appointment.createdAt,
    transcriptCount: appointment.transcriptSegments.length,
    suggestionCount: appointment.suggestions.length,
    icdSuggestionCount: appointment.icdSuggestions.length,
    projectedRevenue: roundMoney(appointment.revenueTracker?.projectedTotal || 0),
    earnedNow: roundMoney(appointment.revenueTracker?.earnedNow || 0),
    finalCptCodes,
    noteStatus: appointment.noteWorkflow?.status || "draft",
    finalizedAt: appointment.noteWorkflow?.finalizedAt || null,
    missedOpportunityCount: Array.isArray(appointment.liveInsights?.missedBillables)
      ? appointment.liveInsights.missedBillables.length
      : 0,
  };
};

export const createAppointment = ({
  patientRef,
  patientChartId = "",
  doctorRef,
  doctorSpecialties = [],
  clientId = "",
  clientName = "",
  insurancePlan,
  visitType,
  encounterMode = "in-person",
  telehealthPlatform = "",
  consentGiven,
  consentFormId,
  consentSignedAt,
}) => {
  const id = crypto.randomUUID();
  const appointment = {
    id,
    patientRef,
    patientChartId: String(patientChartId || "").trim(),
    doctorRef,
    doctorSpecialties: Array.isArray(doctorSpecialties)
      ? Array.from(new Set(doctorSpecialties.map((item) => String(item || "").trim()).filter(Boolean)))
      : [],
    clientId: String(clientId || "default-clinic").trim().toLowerCase(),
    clientName: String(clientName || "Default Clinic").trim(),
    insurancePlan: insurancePlan || "medicare",
    visitType: visitType || "follow-up",
    encounterMode: String(encounterMode || "in-person").trim().toLowerCase(),
    telehealthPlatform: String(telehealthPlatform || "").trim().toLowerCase(),
    consentGiven: Boolean(consentGiven),
    consentFormId: consentFormId || "",
    consentSignedAt: consentSignedAt || new Date().toISOString(),
    accessPolicy: {
      ownerRole: "doctor",
      patientAccess: false,
    },
    createdAt: new Date().toISOString(),
    transcriptSegments: [],
    suggestions: [],
    icdSuggestions: [],
    liveInsights: {
      missedBillables: [],
      documentationGaps: [],
      documentationImprovements: [],
      chartNotes: [],
      realTimePrompts: [],
      latency: {},
    },
    revenueTracker: {
      baseline: 0,
      compliantOpportunity: 0,
      projectedTotal: 0,
      payerMultiplier: 1,
    },
    analysisState: {
      lastAiRunAt: 0,
    },
    recordings: [],
    noteWorkflow: {
      noteId: crypto.randomUUID(),
      status: "draft",
      locked: false,
      currentVersionId: "",
      finalizedVersionId: "",
      finalizedAt: null,
      versions: [],
      currentAnalysis: null,
      overrideRecords: [],
      delivery: {
        ehrSentAt: null,
        billingSentAt: null,
      },
    },
  };
  appointments.set(id, appointment);
  return appointment;
};

export const getAppointment = (appointmentId) => appointments.get(appointmentId);

export const listAppointmentRecords = () => Array.from(appointments.values());

export const listAppointments = () =>
  listAppointmentRecords()
    .map((appointment) => buildAppointmentSummary(appointment))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const appendTranscriptSegment = (appointmentId, segment) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const entry = {
    id: segment.id || crypto.randomUUID(),
    sequence: appointment.transcriptSegments.length + 1,
    text: segment.text,
    rawText: segment.rawText ?? segment.text,
    cleanedText: segment.cleanedText ?? segment.text,
    quality: segment.quality ?? null,
    source: segment.source,
    at: new Date().toISOString(),
  };
  appointment.transcriptSegments.push(entry);
  return entry;
};

export const getTranscriptContext = (appointmentId, limit = 6) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return "";

  return appointment.transcriptSegments
    .slice(-Math.max(1, limit))
    .map((segment) => segment.cleanedText || segment.text)
    .join("\n");
};

export const addSuggestions = (appointmentId, suggestions, source) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const existingCodes = new Set(appointment.suggestions.map((item) => item.code));
  const cleanSuggestions = suggestions
    .filter((item) => item?.code && !existingCodes.has(item.code))
    .map((item) => ({
      ...item,
      source,
      createdAt: new Date().toISOString(),
    }));

  appointment.suggestions.push(...cleanSuggestions);
  return {
    appointment,
    newlyAdded: cleanSuggestions,
  };
};

export const addIcdSuggestions = (appointmentId, suggestions, source) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const existingCodes = new Set(appointment.icdSuggestions.map((item) => item.code));
  const cleanSuggestions = suggestions
    .filter((item) => item?.code && !existingCodes.has(item.code))
    .map((item) => ({
      ...item,
      source,
      createdAt: new Date().toISOString(),
    }));

  appointment.icdSuggestions.push(...cleanSuggestions);
  return {
    appointment,
    newlyAdded: cleanSuggestions,
  };
};

export const setRevenueTracker = (appointmentId, tracker) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.revenueTracker = tracker;
  return appointment;
};

export const setLiveInsights = (appointmentId, insights) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.liveInsights = {
    ...(appointment.liveInsights || {}),
    ...(insights || {}),
  };
  return appointment.liveInsights;
};

export const addRecording = (appointmentId, recordingInfo) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.recordings.push({
    ...recordingInfo,
    at: new Date().toISOString(),
  });
  return appointment;
};

export const ensureNoteDraftVersion = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  if (Array.isArray(workflow.versions) && workflow.versions.length) {
    const current = workflow.versions.find((item) => item.versionId === workflow.currentVersionId);
    return current || workflow.versions[workflow.versions.length - 1] || null;
  }

  const aiContent = mapChartNotesToContent(appointment);
  const aiVersion = buildNoteVersionRecord({
    appointment,
    content: aiContent,
    actorId: "ai-assistant",
    actorRole: "system",
    versionType: "ai_original",
    previousVersion: null,
    metadataOverride: buildInitialSourceMetadata({ actorId: "ai-assistant", actorRole: "system" }),
  });

  workflow.versions = [aiVersion];
  workflow.currentVersionId = aiVersion.versionId;
  workflow.status = "draft";
  workflow.locked = false;
  return aiVersion;
};

export const getCurrentNoteVersion = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  ensureNoteDraftVersion(appointmentId);
  const workflow = appointment.noteWorkflow;
  return (
    workflow.versions.find((item) => item.versionId === workflow.currentVersionId) ||
    workflow.versions[workflow.versions.length - 1] ||
    null
  );
};

export const listNoteVersions = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return [];
  ensureNoteDraftVersion(appointmentId);
  return [...appointment.noteWorkflow.versions].sort(
    (left, right) => Number(left.versionNumber || 0) - Number(right.versionNumber || 0)
  );
};

export const setCurrentNoteAnalysis = (appointmentId, analysis) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  ensureNoteDraftVersion(appointmentId);
  appointment.noteWorkflow.currentAnalysis = {
    ...(analysis || {}),
    generatedAt: nowIso(),
  };
  return appointment.noteWorkflow.currentAnalysis;
};

export const getCurrentNoteAnalysis = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  return appointment.noteWorkflow?.currentAnalysis || null;
};

export const upsertDraftNoteVersion = ({
  appointmentId,
  content,
  actorId = "provider",
  actorRole = "provider",
  allowAfterFinal = false,
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  const current = getCurrentNoteVersion(appointmentId);
  if (!current) return null;

  if (workflow.locked && !allowAfterFinal) {
    return {
      error: "finalized-note-locked",
      appointment,
      currentVersion: current,
    };
  }

  const nextContent = normalizeNoteContent(content || current.contentJson);
  const diff = computeNoteDiff(current.contentJson, nextContent);
  if (!diff.changeCount) {
    return {
      appointment,
      version: current,
      unchanged: true,
    };
  }

  const nextVersion = buildNoteVersionRecord({
    appointment,
    content: nextContent,
    actorId,
    actorRole,
    versionType: workflow.locked ? "amendment" : "provider_edit",
    previousVersion: current,
  });

  const wasLocked = Boolean(workflow.locked);
  workflow.versions.push(nextVersion);
  workflow.currentVersionId = nextVersion.versionId;
  workflow.status = wasLocked ? "amended" : "draft";
  workflow.locked = false;
  if (!wasLocked) {
    workflow.finalizedVersionId = "";
    workflow.finalizedAt = null;
  }
  return {
    appointment,
    version: nextVersion,
    unchanged: false,
  };
};

export const finalizeCurrentNote = ({
  appointmentId,
  actorId = "provider",
  actorRole = "provider",
  overrideReason = "",
  finalCodes = null,
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  const current = getCurrentNoteVersion(appointmentId);
  if (!current) return null;
  const fallbackCodes = Array.isArray(workflow.currentAnalysis?.cptCodes)
    ? workflow.currentAnalysis.cptCodes.map((item) => String(item?.code || "").trim().toUpperCase())
    : Array.isArray(appointment.revenueTracker?.billableCodes)
      ? appointment.revenueTracker.billableCodes
          .map((item) => String(item?.code || "").trim().toUpperCase())
          .filter(Boolean)
      : [];
  const normalizedFinalCodes = Array.isArray(finalCodes)
    ? finalCodes.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : fallbackCodes.filter(Boolean);

  const finalizedVersion = {
    ...current,
    isFinal: true,
    versionType: current.versionType === "ai_original" ? "finalized_ai_draft" : "finalized",
    finalizedBy: actorId,
    finalizedRole: actorRole,
    finalizedAt: nowIso(),
    finalCodes: normalizedFinalCodes,
    overrideReason: normalizeNoteValue(overrideReason),
  };

  const index = workflow.versions.findIndex((item) => item.versionId === current.versionId);
  if (index >= 0) {
    workflow.versions.splice(index, 1, finalizedVersion);
  } else {
    workflow.versions.push(finalizedVersion);
  }

  workflow.currentVersionId = finalizedVersion.versionId;
  workflow.finalizedVersionId = finalizedVersion.versionId;
  workflow.finalizedAt = finalizedVersion.finalizedAt;
  workflow.status = "finalized";
  workflow.locked = true;
  workflow.delivery = {
    ...(workflow.delivery || {}),
    ehrSentAt: nowIso(),
    billingSentAt: nowIso(),
  };
  return {
    appointment,
    version: finalizedVersion,
    delivery: workflow.delivery,
  };
};

export const getFinalizedNotePacket = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  if (!workflow || workflow.status !== "finalized" || !workflow.finalizedVersionId) return null;

  const finalVersion = workflow.versions.find((item) => item.versionId === workflow.finalizedVersionId);
  if (!finalVersion) return null;

  const approvedCodes = (
    finalVersion.finalCodes ||
    workflow.currentAnalysis?.cptCodes ||
    (appointment.revenueTracker?.billableCodes || []).map((item) => item.code)
  )
    .map((item) => (typeof item === "string" ? item : String(item?.code || "")))
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);

  const analysisCodes = Array.isArray(workflow.currentAnalysis?.cptCodes)
    ? workflow.currentAnalysis.cptCodes
    : [];
  const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];
  const codeEvidence = approvedCodes.map((code) => {
    const analysisMatch =
      analysisCodes.find((item) => String(item?.code || "").toUpperCase() === code) || null;
    const billableMatch =
      billableCodes.find((item) => String(item?.code || "").toUpperCase() === code) || null;

    return {
      code,
      title: analysisMatch?.title || billableMatch?.title || "",
      confidence: Number(analysisMatch?.confidence ?? billableMatch?.confidence ?? 0),
      rationale: String(analysisMatch?.rationale || billableMatch?.rationale || "").trim(),
      mdmJustification: String(
        analysisMatch?.mdmJustification || billableMatch?.mdmJustification || ""
      ).trim(),
      evidence: String(analysisMatch?.evidence || billableMatch?.evidence || "").trim(),
      evidenceRefs: Array.isArray(analysisMatch?.evidenceRefs)
        ? analysisMatch.evidenceRefs
        : Array.isArray(billableMatch?.evidenceRefs)
          ? billableMatch.evidenceRefs
          : [],
      estimatedAmount: Number(billableMatch?.estimatedAmount || 0),
    };
  });

  return {
    appointmentId: appointment.id,
    patientRef: appointment.patientRef,
    patientChartId: appointment.patientChartId || "",
    doctorRef: appointment.doctorRef,
    doctorSpecialties: Array.isArray(appointment.doctorSpecialties) ? appointment.doctorSpecialties : [],
    clientId: appointment.clientId || "default-clinic",
    clientName: appointment.clientName || "Default Clinic",
    encounterMode: appointment.encounterMode || "in-person",
    telehealthPlatform: appointment.telehealthPlatform || "",
    noteId: workflow.noteId,
    noteStatus: workflow.status,
    finalizedAt: workflow.finalizedAt,
    finalVersion,
    approvedCodes,
    codeEvidence,
    codingAnalysis: workflow.currentAnalysis || null,
    transcriptSegments: Array.isArray(appointment.transcriptSegments)
      ? appointment.transcriptSegments.map((segment) => ({
          id: segment.id,
          sequence: segment.sequence,
          at: segment.at,
          source: segment.source,
          cleanedText: segment.cleanedText || segment.text || "",
        }))
      : [],
  };
};

export const addOverrideRecord = ({
  appointmentId,
  originalCode = "",
  finalCode = "",
  reason = "",
  providerId = "",
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const record = {
    overrideId: crypto.randomUUID(),
    versionId: appointment.noteWorkflow?.currentVersionId || "",
    originalCode: String(originalCode || "").trim().toUpperCase(),
    finalCode: String(finalCode || "").trim().toUpperCase(),
    reason: String(reason || "").trim(),
    providerId: String(providerId || "").trim(),
    timestamp: nowIso(),
  };

  const existing = Array.isArray(appointment.noteWorkflow?.overrideRecords)
    ? appointment.noteWorkflow.overrideRecords
    : [];
  appointment.noteWorkflow.overrideRecords = [record, ...existing].slice(0, 300);
  return record;
};
