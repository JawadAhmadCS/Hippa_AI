import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const logDir = path.resolve(process.cwd(), "data");
const auditFile = path.join(logDir, "audit-log.ndjson");

const ensureLogFile = () => {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  if (!fs.existsSync(auditFile)) fs.writeFileSync(auditFile, "", "utf8");
};

const getLastHash = () => {
  ensureLogFile();
  const raw = fs.readFileSync(auditFile, "utf8").trim();
  if (!raw) return "GENESIS";
  const lines = raw.split("\n");
  try {
    const last = JSON.parse(lines[lines.length - 1]);
    return last.hash || "GENESIS";
  } catch {
    return "GENESIS";
  }
};

const stripPotentialPhi = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  if (clone.patientRef) clone.patientRef = "***redacted***";
  if (clone.segment) clone.segment = "[transcript omitted]";
  if (clone.rawText) clone.rawText = "[model text omitted]";
  return clone;
};

let previousHash = getLastHash();
let writeQueue = Promise.resolve();

export const writeAuditEvent = async (eventType, payload) => {
  const record = {
    at: new Date().toISOString(),
    eventType,
    payload: stripPotentialPhi(payload),
    retentionDays: env.complianceLogRetentionDays,
    prevHash: previousHash,
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
  record.hash = hash;
  previousHash = hash;

  writeQueue = writeQueue.then(() =>
    fs.promises.appendFile(auditFile, `${JSON.stringify(record)}\n`, "utf8")
  );
  await writeQueue;
  return record;
};

export const listAuditEvents = ({
  appointmentId = "",
  doctorRef = "",
  limit = 200,
  since = "",
} = {}) => {
  ensureLogFile();
  const normalizedAppointmentId = String(appointmentId || "").trim();
  const normalizedDoctorRef = String(doctorRef || "").trim().toLowerCase();
  const sinceTs = since ? new Date(since).getTime() : null;
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 5000));

  const raw = fs.readFileSync(auditFile, "utf8").trim();
  if (!raw) {
    return [];
  }

  const records = raw
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((record) => {
      if (normalizedAppointmentId) {
        const payloadAppointmentId = String(record?.payload?.appointmentId || "").trim();
        if (payloadAppointmentId !== normalizedAppointmentId) return false;
      }

      if (normalizedDoctorRef) {
        const payloadDoctorRef = String(record?.payload?.doctorRef || "").trim().toLowerCase();
        if (payloadDoctorRef !== normalizedDoctorRef) return false;
      }

      if (sinceTs) {
        const atTs = new Date(record.at).getTime();
        if (Number.isNaN(atTs) || atTs < sinceTs) return false;
      }

      return true;
    });

  return records.slice(-safeLimit).reverse();
};
