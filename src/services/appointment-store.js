import crypto from "node:crypto";

const appointments = new Map();

export const createAppointment = ({ patientRef, insurancePlan, visitType, consentGiven }) => {
  const id = crypto.randomUUID();
  const appointment = {
    id,
    patientRef,
    insurancePlan: insurancePlan || "medicare",
    visitType: visitType || "follow-up",
    consentGiven: Boolean(consentGiven),
    createdAt: new Date().toISOString(),
    transcriptSegments: [],
    suggestions: [],
    revenueTracker: {
      baseline: 0,
      compliantOpportunity: 0,
      projectedTotal: 0,
      payerMultiplier: 1,
    },
    recordings: [],
  };
  appointments.set(id, appointment);
  return appointment;
};

export const getAppointment = (appointmentId) => appointments.get(appointmentId);

export const appendTranscriptSegment = (appointmentId, segment) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.transcriptSegments.push({
    text: segment.text,
    source: segment.source,
    at: new Date().toISOString(),
  });
  return appointment;
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

export const setRevenueTracker = (appointmentId, tracker) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.revenueTracker = tracker;
  return appointment;
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

