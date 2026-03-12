import crypto from "node:crypto";

const appointments = new Map();

export const createAppointment = ({
  patientRef,
  doctorRef,
  insurancePlan,
  visitType,
  consentGiven,
  consentFormId,
  consentSignedAt,
}) => {
  const id = crypto.randomUUID();
  const appointment = {
    id,
    patientRef,
    doctorRef,
    insurancePlan: insurancePlan || "medicare",
    visitType: visitType || "follow-up",
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
  };
  appointments.set(id, appointment);
  return appointment;
};

export const getAppointment = (appointmentId) => appointments.get(appointmentId);

export const listAppointments = () =>
  Array.from(appointments.values())
    .map((appointment) => ({
      id: appointment.id,
      patientRef: appointment.patientRef,
      doctorRef: appointment.doctorRef,
      insurancePlan: appointment.insurancePlan,
      visitType: appointment.visitType,
      consentGiven: appointment.consentGiven,
      createdAt: appointment.createdAt,
      transcriptCount: appointment.transcriptSegments.length,
      suggestionCount: appointment.suggestions.length,
      icdSuggestionCount: appointment.icdSuggestions.length,
      projectedRevenue: Number(appointment.revenueTracker?.projectedTotal || 0),
      earnedNow: Number(appointment.revenueTracker?.earnedNow || 0),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const appendTranscriptSegment = (appointmentId, segment) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const entry = {
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
