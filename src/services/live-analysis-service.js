import { env, featureFlags } from "../config/env.js";
import {
  addIcdSuggestions,
  addSuggestions,
  getTranscriptContext,
  setLiveInsights,
  setRevenueTracker,
} from "./appointment-store.js";
import { buildChartNotes } from "./chart-note-service.js";
import { attachEvidenceRefsToItems } from "./evidence-service.js";
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

const countWords = (text) =>
  String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const uniqueBy = (items, keySelector) => {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keySelector(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
};

const mergeGuidance = (ruleGuidance, aiGuidance) =>
  uniqueBy([...(ruleGuidance || []), ...(aiGuidance || [])], (item) =>
    String(item?.prompt || "").toLowerCase().trim()
  );

const mergeDocumentationGaps = (ruleItems, aiItems) =>
  uniqueBy([...(ruleItems || []), ...(aiItems || [])], (item) =>
    String(item?.gap || "").toLowerCase().trim()
  );

const mergeMissedBillables = (ruleItems, aiItems) =>
  uniqueBy([...(ruleItems || []), ...(aiItems || [])], (item) => {
    const code = String(item?.potentialCode || "").toUpperCase().trim();
    const component = String(item?.component || "").toLowerCase().trim();
    return `${code}|${component}`;
  });

export const runLiveAnalysisPipeline = async ({
  appointment,
  latestSegment,
  baselineCode = "99213",
}) => {
  const startedAt = Date.now();
  const transcriptContext = getTranscriptContext(appointment.id, env.aiContextWindowSegments);
  const transcriptSegments = appointment.transcriptSegments;
  const existingCodes = new Set(appointment.suggestions.map((item) => item.code));
  const existingIcd = new Set(appointment.icdSuggestions.map((item) => item.code));

  const ruleSuggestions = attachEvidenceRefsToItems(
    inferRuleBasedSuggestions({
      segment: transcriptContext,
      existingCodes,
      doctorSpecialties: appointment.doctorSpecialties || [],
    }).filter((item) => item.code !== baselineCode),
    {
      transcriptSegments,
      cueSelector: (item) => [item.evidence, item.rationale, item.documentationNeeded, item.title, item.code],
    }
  );
  const mergedRuleSuggestions = addSuggestions(appointment.id, ruleSuggestions, "rule-engine") || {
    newlyAdded: [],
  };

  const ruleIcdSuggestions = attachEvidenceRefsToItems(
    inferRuleBasedIcdSuggestions({
      segment: transcriptContext,
      existingIcd,
    }),
    {
      transcriptSegments,
      cueSelector: (item) => [item.evidence, item.rationale, item.description, item.code],
    }
  );
  const mergedRuleIcd = addIcdSuggestions(appointment.id, ruleIcdSuggestions, "rule-engine") || {
    newlyAdded: [],
  };

  const ruleGuidance = attachEvidenceRefsToItems(inferRuleBasedGuidance({ segment: transcriptContext }), {
    transcriptSegments,
    cueSelector: (item) => [item.prompt, item.rationale, item.evidence],
  });
  const ruleMissedBillables = attachEvidenceRefsToItems(
    detectRuleBasedMissedBillables({
      segment: transcriptContext,
      suggestions: appointment.suggestions,
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
  const ruleDocumentationGaps = attachEvidenceRefsToItems(
    detectRuleBasedDocumentationGaps({ segment: transcriptContext }),
    {
      transcriptSegments,
      cueSelector: (item) => [item.gap, item.impact, item.recommendedPrompt, item.evidence],
    }
  );

  let aiModel = null;
  let aiSkipReason = null;
  let aiLatencyMs = null;
  let mergedAiSuggestions = { newlyAdded: [] };
  let mergedAiIcd = { newlyAdded: [] };
  let aiGuidance = [];
  let aiMissedBillables = [];
  let aiDocumentationGaps = [];

  if (featureFlags.hasOpenAi) {
    const segmentWordCount = countWords(latestSegment);
    const now = Date.now();
    const lastAiRunAt = Number(appointment.analysisState?.lastAiRunAt || 0);
    const enoughWords = segmentWordCount >= env.aiMinWordsForAnalysis;
    const enoughTime = now - lastAiRunAt >= env.aiMinIntervalMs;

    if (!enoughWords) {
      aiSkipReason = "segment-too-short";
    } else if (!enoughTime) {
      aiSkipReason = "throttled";
    } else {
      appointment.analysisState = {
        ...(appointment.analysisState || {}),
        lastAiRunAt: now,
      };

      const aiStart = Date.now();
      try {
        const aiResult = await analyzeTranscriptForSuggestions({
          appointmentId: appointment.id,
          insurancePlan: appointment.insurancePlan,
          visitType: appointment.visitType,
          doctorSpecialties: appointment.doctorSpecialties || [],
          transcriptContext,
          latestSegment,
          baselineCode,
          existingCodes: appointment.suggestions.map((item) => item.code),
        });
        aiLatencyMs = Date.now() - aiStart;
        aiModel = aiResult.model;

        const normalizedAiSuggestions = attachEvidenceRefsToItems(
          normalizeAiSuggestions(aiResult.cptSuggestions)
            .filter((item) => item.code !== baselineCode)
            .filter((item) => Number(item.confidence || 0) >= 0.62),
          {
            transcriptSegments,
            cueSelector: (item) => [
              item.evidence,
              item.rationale,
              item.documentationNeeded,
              item.title,
              item.code,
            ],
          }
        );

        mergedAiSuggestions = addSuggestions(
          appointment.id,
          normalizedAiSuggestions,
          "openai-analysis"
        ) || { newlyAdded: [] };

        const normalizedIcd = attachEvidenceRefsToItems(
          normalizeAiIcdSuggestions(aiResult.icdSuggestions).filter(
            (item) => Number(item.confidence || 0) >= 0.45
          ),
          {
            transcriptSegments,
            cueSelector: (item) => [item.evidence, item.rationale, item.description, item.code],
          }
        );
        mergedAiIcd = addIcdSuggestions(appointment.id, normalizedIcd, "openai-analysis") || {
          newlyAdded: [],
        };

        aiGuidance = attachEvidenceRefsToItems(normalizeAiGuidance(aiResult.realTimePrompts), {
          transcriptSegments,
          cueSelector: (item) => [item.evidence, item.prompt, item.rationale],
        });
        aiMissedBillables = attachEvidenceRefsToItems(
          normalizeAiMissedBillables(aiResult.missedBillables),
          {
            transcriptSegments,
            cueSelector: (item) => [
              item.evidence,
              item.component,
              item.reason,
              item.nextPrompt,
              item.potentialCode,
            ],
          }
        );
        aiDocumentationGaps = attachEvidenceRefsToItems(
          normalizeAiDocumentationGaps(aiResult.documentationGaps),
          {
            transcriptSegments,
            cueSelector: (item) => [item.evidence, item.gap, item.impact, item.recommendedPrompt],
          }
        );
      } catch (error) {
        aiSkipReason = error?.message === "OpenAI analysis timed out." ? "openai-timeout" : "openai-error";
      }
    }
  }

  const guidanceItems = mergeGuidance(ruleGuidance, aiGuidance).slice(0, 8);
  const missedBillables = mergeMissedBillables(ruleMissedBillables, aiMissedBillables).slice(0, 8);
  const documentationGaps = mergeDocumentationGaps(
    ruleDocumentationGaps,
    aiDocumentationGaps
  ).slice(0, 8);

  const documentationImprovements = buildDocumentationImprovements({
    guidance: guidanceItems,
    documentationGaps,
    missedBillables,
  });
  const chartNotes = buildChartNotes({
    transcriptSegments,
  });

  const tracker = estimateRevenueTracker({
    insurancePlan: appointment.insurancePlan,
    baselineCode,
    suggestions: appointment.suggestions,
  });
  setRevenueTracker(appointment.id, tracker);

  const latency = {
    pipelineMs: Date.now() - startedAt,
    aiMs: aiLatencyMs,
    targetMs: env.aiTargetLatencyMs,
    withinTarget:
      typeof aiLatencyMs === "number" ? aiLatencyMs <= env.aiTargetLatencyMs : aiSkipReason !== null,
  };

  setLiveInsights(appointment.id, {
    missedBillables,
    documentationGaps,
    documentationImprovements,
    chartNotes,
    realTimePrompts: guidanceItems,
    latency,
    lastUpdatedAt: new Date().toISOString(),
  });

  const analysisMode = featureFlags.hasOpenAi
    ? aiModel
      ? "rule-engine+openai"
      : "rule-engine-throttled"
    : "rule-engine-only";

  return {
    transcriptContext,
    suggestions: {
      newlyAdded: [...mergedRuleSuggestions.newlyAdded, ...mergedAiSuggestions.newlyAdded],
      all: appointment.suggestions,
    },
    icdSuggestions: {
      newlyAdded: [...mergedRuleIcd.newlyAdded, ...mergedAiIcd.newlyAdded],
      all: appointment.icdSuggestions,
    },
    missedBillables,
    documentationGaps,
    documentationImprovements,
    chartNotes,
    guidanceItems,
    revenueTracker: appointment.revenueTracker,
    analysis: {
      model: aiModel,
      mode: analysisMode,
      skipReason: aiSkipReason,
      latency,
    },
  };
};
