import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve(process.cwd(), "data", "cpt_codebook.json");
const raw = fs.readFileSync(filePath, "utf8");
const codebook = JSON.parse(raw);

if (!Array.isArray(codebook.codes) || codebook.codes.length === 0) {
  throw new Error("Codebook is empty.");
}

const duplicateCodes = codebook.codes.reduce((acc, item) => {
  acc[item.code] = (acc[item.code] || 0) + 1;
  return acc;
}, {});

const duplicates = Object.entries(duplicateCodes)
  .filter(([, count]) => count > 1)
  .map(([code]) => code);

if (duplicates.length > 0) {
  throw new Error(`Duplicate CPT/HCPCS codes found: ${duplicates.join(", ")}`);
}

const requiredFields = ["code", "title", "medicareRate", "documentationNeeded", "complianceNotes"];
for (const item of codebook.codes) {
  for (const field of requiredFields) {
    if (!(field in item)) {
      throw new Error(`Code ${item.code || "UNKNOWN"} missing required field: ${field}`);
    }
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      version: codebook.meta?.version || "unknown",
      lastUpdated: codebook.meta?.lastUpdated || "unknown",
      count: codebook.codes.length,
    },
    null,
    2
  )
);

