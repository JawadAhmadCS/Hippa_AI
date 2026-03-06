import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

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

export const getPayerMultiplier = (insurancePlan) => {
  const payer = String(insurancePlan || "medicare").toLowerCase();
  const codebook = getCodebook();
  return codebook.payerMultipliers[payer] ?? codebook.payerMultipliers.medicare ?? 1;
};

export const getCodeById = (code) => {
  const normalizedCode = String(code || "").toUpperCase().trim();
  return getCodebook().codes.find((item) => item.code === normalizedCode) || null;
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

