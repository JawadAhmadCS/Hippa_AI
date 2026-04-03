import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { getCodebookExtensions } from "./platform-config-service.js";

const codebookPath = path.resolve(process.cwd(), "data", "cpt_codebook.json");
let cached = null;

const readCodebook = () => {
  const raw = fs.readFileSync(codebookPath, "utf8");
  return JSON.parse(raw);
};

const getCodebook = () => {
  if (!cached) {
    cached = readCodebook();
  }
  return cached;
};

const writeCodebook = (codebook) => {
  fs.writeFileSync(codebookPath, `${JSON.stringify(codebook, null, 2)}\n`, "utf8");
  cached = codebook;
};

export const getPayerMultiplier = (insurancePlan) => {
  const payer = String(insurancePlan || "medicare")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");
  const extensions = getCodebookExtensions() || {};
  const planMultiplier = Number(
    extensions?.insurancePlans?.[payer]?.reimbursementMultiplier
  );
  if (Number.isFinite(planMultiplier) && planMultiplier > 0) {
    return Number(planMultiplier);
  }
  const codebook = getCodebook();
  return codebook.payerMultipliers[payer] ?? codebook.payerMultipliers.medicare ?? 1;
};

export const getCodeById = (code) => {
  const normalizedCode = String(code || "").toUpperCase().trim();
  return getCodebook().codes.find((item) => item.code === normalizedCode) || null;
};

export const getCodebookSnapshot = () => {
  const codebook = getCodebook();
  return JSON.parse(JSON.stringify(codebook));
};

export const updateCodeById = (code, patch = {}) => {
  const normalizedCode = String(code || "").toUpperCase().trim();
  if (!normalizedCode) {
    throw new Error("Code is required.");
  }

  const codebook = getCodebook();
  const index = codebook.codes.findIndex((item) => item.code === normalizedCode);
  if (index === -1) {
    return null;
  }

  const current = codebook.codes[index];
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    next.title = String(patch.title || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "medicareRate")) {
    const parsed = Number(patch.medicareRate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("medicareRate must be a non-negative number.");
    }
    next.medicareRate = Number(parsed.toFixed(2));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "documentationNeeded")) {
    next.documentationNeeded = String(patch.documentationNeeded || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(patch, "complianceNotes")) {
    next.complianceNotes = String(patch.complianceNotes || "").trim();
  }

  codebook.codes[index] = next;
  codebook.meta = {
    ...(codebook.meta || {}),
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  writeCodebook(codebook);
  return next;
};

export const searchCodes = (query) => {
  const text = String(query || "").toLowerCase().trim();
  if (!text) return [];
  return getCodebook().codes
    .filter((item) => {
      return (
        item.code.toLowerCase().includes(text) ||
        item.title.toLowerCase().includes(text) ||
        item.documentationNeeded.toLowerCase().includes(text)
      );
    })
    .slice(0, 12);
};

export const getCodebookStatus = () => {
  const codebook = getCodebook();
  const updated = new Date(codebook.meta.lastUpdated);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const ageDays = Math.floor((now.getTime() - updated.getTime()) / msPerDay);
  return {
    ...codebook.meta,
    ageDays,
    stale: ageDays > env.codebookStaleDays,
    staleThresholdDays: env.codebookStaleDays,
  };
};
