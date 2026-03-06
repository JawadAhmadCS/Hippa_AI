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

