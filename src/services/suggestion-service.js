import { getCodeById } from "./codebook-service.js";
import { mergeEvidenceRefs } from "./evidence-service.js";

const RULES = [
  {
    id: "smoking-cessation",
    code: "99406",
    keywords: ["smoking", "tobacco", "cessation"],
    rationale: "Counseling for tobacco cessation documented in conversation.",
    specialties: ["family medicine", "internal medicine", "pulmonology", "cardiology"],
  },
  {
    id: "depression-screening",
    code: "G0444",
    keywords: ["depression", "phq", "screening"],
    rationale: "Depression screening discussed; document validated tool and score.",
    specialties: ["family medicine", "internal medicine", "psychiatry", "pediatrics"],
  },
  {
    id: "awv-subsequent",
    code: "G0439",
    keywords: ["annual wellness", "preventive", "medicare wellness"],
    rationale: "Elements of Medicare annual wellness visit appear present.",
    specialties: ["family medicine", "internal medicine", "geriatrics"],
  },
  {
    id: "advance-care-planning",
    code: "99497",
    keywords: ["advance directive", "goals of care", "care planning"],
    rationale: "Advance care planning conversation appears to be present.",
    specialties: ["family medicine", "internal medicine", "geriatrics", "oncology"],
  },
  {
    id: "chronic-care-management",
    code: "99490",
    keywords: ["chronic care", "care coordination", "20 minutes"],
    rationale: "Chronic care management criteria may be met if monthly requirements are documented.",
    specialties: ["family medicine", "internal medicine", "cardiology", "endocrinology"],
  },
  {
    id: "ecg-routine",
    code: "93000",
    keywords: ["ecg", "ekg", "electrocardiogram"],
    rationale: "ECG discussion indicates potential billable diagnostic tracing.",
    specialties: ["cardiology", "internal medicine", "family medicine", "emergency medicine"],
  },
  {
    id: "moderate-mdm-medication-management",
    code: "99214",
    keywords: ["blood pressure", "medication", "adjust", "hypertension"],
    rationale: "Medication management with chronic condition follow-up suggests moderate MDM.",
    minHits: 3,
    specialties: ["family medicine", "internal medicine", "cardiology"],
  },
];

const clampConfidence = (value) => Math.max(0, Math.min(0.98, Number(value) || 0));
const clampPriority = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "medium";
};

const normalizeSpecialtyKey = (value) => String(value || "").trim().toLowerCase();

const buildMdmJustification = ({ code, rationale = "", evidence = "", documentationNeeded = "" }) => {
  const normalizedCode = String(code || "").toUpperCase().trim();
  const combined = [rationale, evidence, documentationNeeded].map((item) => String(item || "").toLowerCase()).join(" ");

  if (/^9921[3-5]$/.test(normalizedCode)) {
    if (combined.includes("medication") || combined.includes("risk") || combined.includes("chronic")) {
      return "MDM supports E/M selection through chronic condition assessment, treatment risk, and active management complexity.";
    }
    if (combined.includes("data") || combined.includes("review")) {
      return "MDM supports E/M selection through documented data review, assessment complexity, and care planning decisions.";
    }
    return "MDM support required: document problems addressed, data reviewed, and risk of management for this E/M level.";
  }

  return "MDM context supports medical necessity when linked to assessed problems, documented decision-making, and plan details.";
};

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
    mdmJustification: buildMdmJustification({
      code: cpt.code,
      rationale,
      evidence: evidenceText,
      documentationNeeded: cpt.documentationNeeded,
    }),
    confidence: clampConfidence(baseConfidence),
  };
};

const ICD_RULES = [
  {
    code: "I10",
    description: "Essential (primary) hypertension",
    keywords: ["hypertension", "blood pressure", "bp", "150"],
    rationale: "Encounter discussion indicates chronic blood pressure management.",
  },
  {
    code: "R53.83",
    description: "Other fatigue",
    keywords: ["fatigue", "tired", "weak"],
    rationale: "Patient fatigue symptoms were discussed.",
  },
  {
    code: "Z72.0",
    description: "Tobacco use",
    keywords: ["tobacco", "smoking", "nicotine"],
    rationale: "Tobacco use or counseling language appears in transcript.",
  },
  {
    code: "F32.A",
    description: "Depression, unspecified",
    keywords: ["depression", "phq", "sad", "low mood"],
    rationale: "Depression screening or symptoms were discussed.",
  },
  {
    code: "R03.0",
    description: "Elevated blood-pressure reading, without diagnosis of hypertension",
    keywords: ["elevated blood pressure", "high reading", "blood pressure"],
    rationale: "Encounter includes elevated blood pressure discussion and follow-up.",
  },
];

export const inferRuleBasedSuggestions = ({ segment, existingCodes, doctorSpecialties = [] }) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];
  const specialtySet = new Set((doctorSpecialties || []).map((item) => normalizeSpecialtyKey(item)));

  return RULES.filter((rule) => {
    if (Array.isArray(rule.specialties) && rule.specialties.length) {
      const supported = rule.specialties.some((specialty) =>
        specialtySet.has(normalizeSpecialtyKey(specialty))
      );
      if (!supported && specialtySet.size > 0) return false;
    }
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

export const inferRuleBasedIcdSuggestions = ({ segment, existingIcd = new Set() }) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];

  return ICD_RULES.filter((rule) => {
    const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
    return hits >= 2 || (hits >= 1 && rule.code === "I10");
  })
    .filter((rule) => !existingIcd.has(rule.code))
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => text.includes(keyword)).length;
      return {
        code: rule.code,
        description: rule.description,
        rationale: rule.rationale,
        confidence: clampConfidence(0.5 + hits * 0.16),
        evidence: String(segment || "").slice(0, 240),
      };
    });
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
        mdmJustification: String(item?.mdmJustification || "").trim() || buildMdmJustification({
          code: cpt.code,
          rationale: item?.rationale,
          evidence: item?.evidence,
          documentationNeeded: item?.documentationNeeded || cpt.documentationNeeded,
        }),
        confidence: clampConfidence(item?.confidence ?? 0.55),
      };
    })
    .filter(Boolean);
};

const isValidIcdCode = (code) => /^[A-TV-Z][0-9][0-9AB](\.[0-9A-TV-Z]{1,4})?$/.test(code);

export const normalizeAiIcdSuggestions = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const code = String(item?.code || "").toUpperCase().trim();
      if (!isValidIcdCode(code)) return null;
      return {
        code,
        description: String(item?.description || "ICD-10 diagnosis suggestion"),
        rationale: String(item?.rationale || "AI diagnosis suggestion from transcript evidence."),
        confidence: clampConfidence(item?.confidence ?? 0.5),
        evidence: String(item?.evidence || ""),
      };
    })
    .filter(Boolean);
};

export const normalizeAiMissedBillables = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const component = String(item?.component || "").trim();
      const potentialCode = String(item?.potentialCode || "").toUpperCase().trim();
      const reason = String(item?.reason || "").trim();
      const nextPrompt = String(item?.nextPrompt || "").trim();
      const evidence = String(item?.evidence || "").trim();
      if (!component || !potentialCode || !reason || !nextPrompt) return null;
      return {
        component,
        potentialCode,
        reason,
        nextPrompt,
        evidence,
        confidence: clampConfidence(item?.confidence ?? 0.55),
      };
    })
    .filter(Boolean);
};

export const normalizeAiDocumentationGaps = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const gap = String(item?.gap || "").trim();
      const impact = String(item?.impact || "").trim();
      const recommendedPrompt = String(item?.recommendedPrompt || "").trim();
      const evidence = String(item?.evidence || "").trim();
      if (!gap || !recommendedPrompt) return null;
      return {
        gap,
        impact,
        severity: clampPriority(item?.severity),
        recommendedPrompt,
        evidence,
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
      const evidence = String(item?.evidence || "").trim();
      const rawPriority = String(item?.priority || "medium").toLowerCase().trim();
      const priority = allowedPriorities.has(rawPriority) ? rawPriority : "medium";
      if (!prompt) return null;
      return { prompt, rationale, priority, evidence };
    })
    .filter(Boolean);
};

const keywordCoverage = (text, terms) => terms.filter((term) => text.includes(term)).length;

export const detectRuleBasedMissedBillables = ({
  segment,
  suggestions = [],
  baselineCode = "99213",
}) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];

  const presentCodes = new Set(
    suggestions.map((item) => String(item?.code || "").toUpperCase().trim()).filter(Boolean)
  );

  const missed = [];
  const maybePush = (item) => {
    if (!item || presentCodes.has(item.potentialCode)) return;
    missed.push(item);
  };

  if (keywordCoverage(text, ["tobacco", "smoking", "cessation"]) >= 2) {
    maybePush({
      component: "Tobacco cessation counseling duration may be undocumented",
      potentialCode: "99406",
      reason: "Counseling language appears, but billable counseling time/details may be missing.",
      nextPrompt: "Document tobacco counseling duration and key counseling points.",
      confidence: 0.72,
    });
  }

  if (keywordCoverage(text, ["depression", "phq", "screening"]) >= 2) {
    maybePush({
      component: "Depression screening score may be missing",
      potentialCode: "G0444",
      reason: "Screening discussion exists but validated tool and score may not be documented.",
      nextPrompt: "Record the validated screening instrument and numeric score.",
      confidence: 0.7,
    });
  }

  if (keywordCoverage(text, ["ecg", "ekg", "electrocardiogram"]) >= 1) {
    maybePush({
      component: "ECG interpretation/report completeness",
      potentialCode: "93000",
      reason: "ECG mention appears; full interpretation/report may be required for billing.",
      nextPrompt: "Ensure ECG tracing, interpretation, and signed report are documented.",
      confidence: 0.66,
    });
  }

  if (keywordCoverage(text, ["blood pressure", "medication", "adjust", "hypertension"]) >= 3) {
    const emPresent = presentCodes.has("99214");
    if (!emPresent && baselineCode !== "99214") {
      maybePush({
        component: "Moderate MDM criteria may not be fully documented",
        potentialCode: "99214",
        reason: "Medication management complexity suggests possible E/M upgrade if criteria are met.",
        nextPrompt: "Document risk, data reviewed, and management complexity clearly.",
        confidence: 0.64,
      });
    }
  }

  return missed.slice(0, 5);
};

export const detectRuleBasedDocumentationGaps = ({ segment }) => {
  const text = String(segment || "").toLowerCase();
  if (!text) return [];

  const gaps = [];

  if (containsAny(text, ["blood pressure", "hypertension"])) {
    if (!containsAny(text, ["home", "readings", "trend"])) {
      gaps.push({
        gap: "Home blood pressure trend is missing",
        severity: "high",
        impact: "Limits clinical justification for medication changes and follow-up intensity.",
        recommendedPrompt: "Please share home blood pressure readings from the past week.",
      });
    }
    if (!containsAny(text, ["adherence", "missed dose", "side effect"])) {
      gaps.push({
        gap: "Medication adherence and side effects are not explicit",
        severity: "high",
        impact: "Weakens MDM and safety documentation for treatment adjustment.",
        recommendedPrompt: "Have you missed doses, and any side effects from current medication?",
      });
    }
  }

  if (containsAny(text, ["blood test", "lab", "cbc", "thyroid"]) && !containsAny(text, ["because", "due to", "indication"])) {
    gaps.push({
      gap: "Clinical indication for lab order is unclear",
      severity: "medium",
      impact: "Medical necessity may not be defensible for payer review.",
      recommendedPrompt: "Document the specific symptom/risk driving each lab order.",
    });
  }

  if (containsAny(text, ["tobacco", "smoking", "cessation"]) && !containsAny(text, ["minute", "minutes"])) {
    gaps.push({
      gap: "Counseling time not documented",
      severity: "medium",
      impact: "Prevents compliant billing for time-based counseling codes.",
      recommendedPrompt: "Record counseling duration and intervention details.",
    });
  }

  return gaps.slice(0, 6);
};

export const buildDocumentationImprovements = ({
  guidance = [],
  documentationGaps = [],
  missedBillables = [],
}) => {
  const suggestions = [];
  const buildActionText = (...candidates) => {
    const combined = candidates
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

    if (containsAny(combined, ["duration", "minutes", "time-based", "counseling time", "time"])) {
      return "Document duration to support higher E/M level";
    }
    if (containsAny(combined, ["chronic", "trend", "follow-up", "progression", "home blood pressure"])) {
      return "Clarify chronicity of condition";
    }
    if (containsAny(combined, ["medication", "adherence", "side effect", "dose", "management"])) {
      return "Confirm medication management";
    }
    if (containsAny(combined, ["severity", "functional impact", "symptom"])) {
      return "Document symptom severity and impact";
    }
    if (containsAny(combined, ["lab", "medical necessity", "clinical indication", "testing"])) {
      return "Document medical necessity for ordered labs";
    }
    if (containsAny(combined, ["screening", "score", "instrument", "phq"])) {
      return "Record validated screening score";
    }
    if (containsAny(combined, ["risk", "data reviewed", "complexity", "mdm"])) {
      return "Document MDM risk and data reviewed";
    }

    return "Clarify supporting documentation";
  };
  const buildDetail = (...candidates) =>
    candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
  const pushUnique = ({ text, detail = "", priority = "medium", evidenceRefs = [], sourceType = "" }) => {
    const normalized = String(text || "").trim();
    if (!normalized) return;

    const existing = suggestions.find((item) => item.text.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      existing.evidenceRefs = mergeEvidenceRefs(existing.evidenceRefs, evidenceRefs);
      if (!existing.detail && detail) {
        existing.detail = detail;
      }
      if (existing.priority !== "high" && priority === "high") {
        existing.priority = "high";
      }
      return;
    }

    suggestions.push({
      text: normalized,
      detail: buildDetail(detail),
      priority: clampPriority(priority),
      sourceType,
      evidenceRefs: mergeEvidenceRefs(evidenceRefs),
    });
  };

  for (const gap of documentationGaps) {
    pushUnique({
      text: buildActionText(gap.gap, gap.recommendedPrompt, gap.impact, gap.evidence),
      detail: buildDetail(gap.recommendedPrompt, gap.impact, gap.gap),
      priority: gap.severity,
      sourceType: "documentation-gap",
      evidenceRefs: gap.evidenceRefs,
    });
  }
  for (const missing of missedBillables) {
    pushUnique({
      text: buildActionText(
        missing.component,
        missing.nextPrompt,
        missing.reason,
        missing.evidence,
        missing.potentialCode
      ),
      detail: buildDetail(missing.nextPrompt, missing.reason, missing.component),
      priority: "high",
      sourceType: "missed-billable",
      evidenceRefs: missing.evidenceRefs,
    });
  }
  for (const item of guidance) {
    pushUnique({
      text: buildActionText(item.prompt, item.rationale, item.evidence),
      detail: buildDetail(item.prompt, item.rationale),
      priority: item.priority,
      sourceType: "guidance",
      evidenceRefs: item.evidenceRefs,
    });
  }

  return suggestions.slice(0, 8);
};
