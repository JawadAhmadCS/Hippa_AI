import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EHR_WRITE_LOG_PATH = path.resolve(process.cwd(), "data", "ehr-write-log.ndjson");

const ensureDirectory = async () => {
  await fs.mkdir(path.dirname(EHR_WRITE_LOG_PATH), { recursive: true });
};

export const writeFinalizedNoteToEhr = async ({
  appointmentId = "",
  clientId = "",
  doctorRef = "",
  patientRef = "",
  patientChartId = "",
  finalVersion = null,
  codingAnalysis = null,
} = {}) => {
  await ensureDirectory();

  const externalRecordId = `ehr-${crypto.randomUUID()}`;
  const writtenAt = new Date().toISOString();
  const payload = {
    id: crypto.randomUUID(),
    event: "ehr.finalized_note.write",
    at: writtenAt,
    destination: "mock-ehr-adapter",
    externalRecordId,
    appointmentId: String(appointmentId || "").trim(),
    clientId: String(clientId || "").trim(),
    doctorRef: String(doctorRef || "").trim(),
    patientRef: String(patientRef || "").trim(),
    patientChartId: String(patientChartId || "").trim(),
    noteId: String(finalVersion?.noteId || "").trim(),
    versionId: String(finalVersion?.versionId || "").trim(),
    finalCodes: Array.isArray(finalVersion?.finalCodes) ? finalVersion.finalCodes : [],
    confidence: Number(codingAnalysis?.confidence || 0),
  };

  await fs.appendFile(EHR_WRITE_LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");

  return {
    destination: payload.destination,
    externalRecordId,
    writtenAt,
    status: "written",
  };
};
