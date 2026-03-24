import { featureFlags } from "../config/env.js";
import { attachEvidenceRefsToItems, mergeEvidenceRefs } from "./evidence-service.js";
import { analyzeTranscriptForSuggestions } from "./openai-service.js";
import { estimateRevenueTracker } from "./revenue-service.js";
import {
  buildDocumentationImprovements,
  detectRuleBasedDocumentationGaps,
  detectRuleBasedMissedBillables,
  inferRuleBasedGuidance,
  inferRuleBasedIcdSuggestions,
  inferRuleBasedSuggestions,
  normalizeAiDocumentationGaps,
  normalizeAiGuidance,
  normalizeAiIcdSuggestions,
  normalizeAiMissedBillables,
  normalizeAiSuggestions,
} from "./suggestion-service.js";

const uniqueBy = (items = [], keySelector) => {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = keySelector(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const clampConfidence = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const normalizeNoteForAnalysis = (noteContent = {}) => {
  const sections = noteContent?.sections || {};
  const lines = [
    `HPI: ${String(sections.hpi || "").trim()}`,
    `ROS: ${String(sections.ros || "").trim()}`,
    `Exam: ${String(sections.exam || "").trim()}`,
    `Assessment: ${String(sections.assessment || "").trim()}`,
    `Plan: ${String(sections.plan || "").trim()}`,
    `Additional Provider Notes / Clarifications: ${String(
      noteContent.additionalProviderNotes || ""
    ).trim()}`,
    `Free-text additions: ${String(noteContent.freeTextAdditions || "").trim()}`,
  ];

  return lines.filter((line) => !line.endsWith(":")).join("\n");
};

const mergeByCode = (items = []) => {
  const merged = new Map();
  for (const item of items) {
    const code = String(item?.code || "").toUpperCase().trim();
    if (!code) continue;
    const current = merged.get(code);
    if (!current) {
      merged.set(code, item);
      continue;
    }
    const mergedRefs = mergeEvidenceRefs(current.evidenceRefs, item.evidenceRefs);
    const keep = Number(item.confidence || 0) > Number(current.confidence || 0) ? item : current;
    merged.set(code, {
      ...keep,
      evidenceRefs: mergedRefs,
    });
  }
  return Array.from(merged.values());
};

const mergeGuidance = (left = [], right = []) =>
  uniqueBy([...left, ...right], (item) => String(item?.prompt || "").toLowerCase().trim());

const mergeDocGaps = (left = [], right = []) =>
  uniqueBy([...left, ...right], (item) => String(item?.gap || "").toLowerCase().trim());

const mergeMissed = (left = [], right = []) =>
  uniqueBy([...left, ...right], (item) => {
    const code = String(item?.potentialCode || "").toUpperCase().trim();
    const component = String(item?.component || "").toLowerCase().trim();
    return `${code}:${component}`;
  });

const buildRiskFlags = ({ documentationGaps = [], missedBillables = [] }) => {
  const flags = [];
  for (const gap of documentationGaps) {
    if (String(gap?.severity || "").toLowerCase() === "high") {
      flags.push(`high-gap:${gap.gap}`);
    }
  }
  for (const item of missedBillables) {
    flags.push(`missed:${item.potentialCode || "unknown"}`);
  }
  return uniqueBy(flags, (item) => item).slice(0, 12);
};

const buildJustification = ({ cptCodes = [], icdCodes = [], documentationImprovements = [] }) => {
  const codePart = cptCodes.length
    ? `CPT: ${cptCodes
        .slice(0, 4)
        .map((item) => `${item.code} (${Math.round((item.confidence || 0) * 100)}%)`)
        .join(", ")}`
    : "CPT: insufficient support";
  const icdPart = icdCodes.length
    ? `ICD: ${icdCodes.slice(0, 4).map((item) => item.code).join(", ")}`
    : "ICD: no strong suggestion";
  const promptPart = documentationImprovements.length
    ? `Documentation prompts: ${documentationImprovements.slice(0, 3).map((item) => item.text).join(" | ")}`
    : "Documentation prompts: none";
  return `${codePart}. ${icdPart}. ${promptPart}.`;
};

const averageConfidence = (cptCodes = [], icdCodes = []) => {
  const values = [...cptCodes, ...icdCodes].map((item) => clampConfidence(item?.confidence));
  if (!values.length) return 0;
  return clampConfidence(values.reduce((sum, value) => sum + value, 0) / values.length);
};

export const recalculateNoteCoding = async ({
  appointment,
  noteContent,
  baselineCode = "99213",
}) => {
  const transcriptSegments = Array.isArray(appointment?.transcriptSegments)
    ? appointment.transcriptSegments
    : [];
  const noteText = normalizeNoteForAnalysis(noteContent);

  const ruleCpt = attachEvidenceRefsToItems(
    inferRuleBasedSuggestions({
      segment: noteText,
      existingCodes: new Set(),
    }),
    {
      transcriptSegments,
      cueSelector: (item) => [item.evidence, item.rationale, item.documentationNeeded, item.title, item.code],
    }
  );

  const ruleIcd = attachEvidenceRefsToItems(
    inferRuleBasedIcdSuggestions({
      segment: noteText,
      existingIcd: new Set(),
    }),
    {
      transcriptSegments,
      cueSelector: (item) => [item.evidence, item.rationale, item.description, item.code],
    }
  );

  const ruleGuidance = attachEvidenceRefsToItems(inferRuleBasedGuidance({ segment: noteText }), {
    transcriptSegments,
    cueSelector: (item) => [item.prompt, item.rationale, item.evidence],
  });
  const ruleMissed = attachEvidenceRefsToItems(
    detectRuleBasedMissedBillables({
      segment: noteText,
      suggestions: ruleCpt,
      baselineCode,
    }),
    {
      transcriptSegments,
      cueSelector: (item) => [
        item.component,
        item.reason,
        item.nextPrompt,
        item.evidence,
        item.potentialCode,
      ],
    }
  );
  const ruleDocGaps = attachEvidenceRefsToItems(detectRuleBasedDocumentationGaps({ segment: noteText }), {
    transcriptSegments,
    cueSelector: (item) => [item.gap, item.impact, item.recommendedPrompt, item.evidence],
  });

  let aiModel = null;
  let aiCpt = [];
  let aiIcd = [];
  let aiGuidance = [];
  let aiMissed = [];
  let aiDocGaps = [];
  let analysisError = "";

  if (featureFlags.hasOpenAi && noteText.length > 8) {
    try {
      const ai = await analyzeTranscriptForSuggestions({
        appointmentId: appointment.id,
        insurancePlan: appointment.insurancePlan,
        visitType: appointment.visitType,
        transcriptContext: noteText,
        latestSegment: noteText,
        baselineCode,
        existingCodes: [],
      });
      aiModel = ai.model || null;
      aiCpt = attachEvidenceRefsToItems(normalizeAiSuggestions(ai.cptSuggestions), {
        transcriptSegments,
        cueSelector: (item) => [
          item.evidence,
          item.rationale,
          item.documentationNeeded,
          item.title,
          item.code,
        ],
      });
      aiIcd = attachEvidenceRefsToItems(normalizeAiIcdSuggestions(ai.icdSuggestions), {
        transcriptSegments,
        cueSelector: (item) => [item.evidence, item.rationale, item.description, item.code],
      });
      aiGuidance = attachEvidenceRefsToItems(normalizeAiGuidance(ai.realTimePrompts), {
        transcriptSegments,
        cueSelector: (item) => [item.evidence, item.prompt, item.rationale],
      });
      aiMissed = attachEvidenceRefsToItems(normalizeAiMissedBillables(ai.missedBillables), {
        transcriptSegments,
        cueSelector: (item) => [
          item.evidence,
          item.component,
          item.reason,
          item.nextPrompt,
          item.potentialCode,
        ],
      });
      aiDocGaps = attachEvidenceRefsToItems(normalizeAiDocumentationGaps(ai.documentationGaps), {
        transcriptSegments,
        cueSelector: (item) => [item.evidence, item.gap, item.impact, item.recommendedPrompt],
      });
    } catch (error) {
      analysisError = String(error?.message || "note-analysis-failed");
    }
  }

  const cptCodes = mergeByCode([...ruleCpt, ...aiCpt])
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0))
    .slice(0, 8);
  const icdCodes = mergeByCode([...ruleIcd, ...aiIcd])
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0))
    .slice(0, 8);

  const missedBillables = mergeMissed(ruleMissed, aiMissed).slice(0, 8);
  const documentationGaps = mergeDocGaps(ruleDocGaps, aiDocGaps).slice(0, 8);
  const realTimePrompts = mergeGuidance(ruleGuidance, aiGuidance).slice(0, 8);
  const documentationImprovements = buildDocumentationImprovements({
    guidance: realTimePrompts,
    documentationGaps,
    missedBillables,
  });

  const confidence = averageConfidence(cptCodes, icdCodes);
  const riskFlags = buildRiskFlags({ documentationGaps, missedBillables });
  const tracker = estimateRevenueTracker({
    insurancePlan: appointment.insurancePlan,
    baselineCode,
    suggestions: cptCodes,
  });

  const evidenceRefs = mergeEvidenceRefs(
    ...[...cptCodes, ...icdCodes, ...documentationImprovements].map((item) => item.evidenceRefs || [])
  );

  return {
    cptCodes,
    icdCodes,
    confidence,
    justification: buildJustification({ cptCodes, icdCodes, documentationImprovements }),
    riskFlags,
    evidenceRefs,
    documentationGaps,
    documentationImprovements,
    missedBillables,
    realTimePrompts,
    revenueTracker: tracker,
    model: aiModel,
    analysisError,
    generatedAt: new Date().toISOString(),
  };
};
