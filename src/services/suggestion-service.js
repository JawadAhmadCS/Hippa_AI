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
  {
    id: "moderate-mdm-medication-management",
    code: "99214",
    keywords: ["blood pressure", "medication", "adjust", "hypertension"],
    rationale: "Medication management with chronic condition follow-up suggests moderate MDM.",
    minHits: 3,
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
    evidence: evidenceText.slice(0, 240),
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
    const threshold = Number(rule.minHits) || 2;
    return hits >= threshold;
  })
    .filter((rule) => !existingCodes.has(rule.code))
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
      const confidence = 0.55 + hits * 0.11;
      return makeSuggestion(rule.code, rule.rationale, segment, confidence);
    })
    .filter(Boolean);
};

export const normalizeAiSuggestions = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const code = String(item?.code || "").toUpperCase().trim();
      const cpt = getCodeById(code);
      if (!cpt) return null;
      return {
        code: cpt.code,
        title: cpt.title,
        rationale: String(item?.rationale || "AI assistant recommendation."),
        evidence: String(item?.evidence || ""),
        documentationNeeded: String(item?.documentationNeeded || cpt.documentationNeeded),
        complianceNotes: cpt.complianceNotes,
        confidence: clampConfidence(item?.confidence ?? 0.55),
      };
    })
    .filter(Boolean);
};

const containsAny = (text, terms) => terms.some((term) => text.includes(term));

export const inferRuleBasedGuidance = ({ segment }) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];

  const guidance = [];

  if (containsAny(text, ["blood pressure", "hypertension", "150", "medication"])) {
    guidance.push({
      prompt: "Ask for home blood pressure readings from the last 7 days and confirm the trend.",
      rationale: "Objective blood pressure trend documentation supports safe medication adjustment.",
      priority: "high",
    });
    guidance.push({
      prompt: "Verify medication adherence and possible side effects explicitly.",
      rationale: "Adherence and side-effect review are critical in hypertension follow-up MDM.",
      priority: "high",
    });
  }

  if (containsAny(text, ["tired", "fatigue", "weak"])) {
    guidance.push({
      prompt: "Quantify fatigue duration, severity, and functional impact.",
      rationale: "Detailed symptom characterization supports differential assessment and medical necessity.",
      priority: "medium",
    });
  }

  if (containsAny(text, ["blood test", "lab", "cbc", "thyroid"])) {
    guidance.push({
      prompt: "Document a clear clinical indication before ordering laboratory tests.",
      rationale: "Medical necessity documentation is important for billing and compliance.",
      priority: "medium",
    });
  }

  if (!guidance.length) {
    guidance.push({
      prompt: "Clarify symptom onset, duration, and progression for the chief complaint.",
      rationale: "Structured HPI documentation improves coding accuracy.",
      priority: "low",
    });
  }

  const seen = new Set();
  return guidance.filter((item) => {
    const key = item.prompt.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeAiGuidance = (items) => {
  if (!Array.isArray(items)) return [];

  const allowedPriorities = new Set(["high", "medium", "low"]);
  return items
    .map((item) => {
      const prompt = String(item?.prompt || "").trim();
      const rationale = String(item?.rationale || "").trim();
      const rawPriority = String(item?.priority || "medium").toLowerCase().trim();
      const priority = allowedPriorities.has(rawPriority) ? rawPriority : "medium";
      if (!prompt) return null;
      return { prompt, rationale, priority };
    })
    .filter(Boolean);
};
