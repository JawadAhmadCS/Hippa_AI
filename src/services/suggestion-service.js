import { getCodeById } from "./codebook-service.js";

const RULES = [
  {
    id: "smoking-cessation",
    code: "99406",
    keywords: ["smoking", "tobacco", "cessation"],
    rationale: "Counseling for tobacco cessation documented in conversation.",
  },
  {
    id: "depression-screening",
    code: "G0444",
    keywords: ["depression", "phq", "screening"],
    rationale: "Depression screening discussed; document validated tool and score.",
  },
  {
    id: "awv-subsequent",
    code: "G0439",
    keywords: ["annual wellness", "preventive", "medicare wellness"],
    rationale: "Elements of Medicare annual wellness visit appear present.",
  },
  {
    id: "advance-care-planning",
    code: "99497",
    keywords: ["advance directive", "goals of care", "care planning"],
    rationale: "Advance care planning conversation appears to be present.",
  },
  {
    id: "chronic-care-management",
    code: "99490",
    keywords: ["chronic care", "care coordination", "20 minutes"],
    rationale: "Chronic care management criteria may be met if monthly requirements are documented.",
  },
  {
    id: "ecg-routine",
    code: "93000",
    keywords: ["ecg", "ekg", "electrocardiogram"],
    rationale: "ECG discussion indicates potential billable diagnostic tracing.",
  },
];

const clampConfidence = (value) => Math.max(0, Math.min(0.98, Number(value) || 0));

const makeSuggestion = (code, rationale, evidenceText, baseConfidence = 0.64) => {
  const cpt = getCodeById(code);
  if (!cpt) return null;
  return {
    code: cpt.code,
    title: cpt.title,
    rationale,
    evidence: evidenceText.slice(0, 220),
    documentationNeeded: cpt.documentationNeeded,
    complianceNotes: cpt.complianceNotes,
    confidence: clampConfidence(baseConfidence),
  };
};

export const inferRuleBasedSuggestions = ({ segment, existingCodes }) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];

  return RULES.filter((rule) => {
    const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
    return hits >= 2;
  })
    .filter((rule) => !existingCodes.has(rule.code))
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
      const confidence = 0.58 + hits * 0.12;
      return makeSuggestion(rule.code, rule.rationale, segment, confidence);
    })
    .filter(Boolean);
};

export const normalizeRealtimeSuggestions = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const code = String(item?.code || "").toUpperCase().trim();
      const cpt = getCodeById(code);
      if (!cpt) return null;
      return {
        code: cpt.code,
        title: cpt.title,
        rationale: String(item?.rationale || "Realtime assistant recommendation."),
        evidence: String(item?.evidence || ""),
        documentationNeeded: String(item?.documentationNeeded || cpt.documentationNeeded),
        complianceNotes: cpt.complianceNotes,
        confidence: clampConfidence(item?.confidence ?? 0.55),
      };
    })
    .filter(Boolean);
};

