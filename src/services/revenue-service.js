import { getCodeById, getPayerMultiplier } from "./codebook-service.js";

const roundCurrency = (value) => Number(value.toFixed(2));
const isEmCode = (code) => /^9921[3-5]$/.test(String(code || ""));

const toBillableEntry = ({
  cpt,
  payerMultiplier,
  type,
  source,
  confidence,
  evidence,
  evidenceRefs = [],
  rationale = "",
  mdmJustification = "",
}) => ({
  code: cpt.code,
  title: cpt.title,
  type,
  source,
  confidence: Number(confidence || 0),
  evidence: String(evidence || "").slice(0, 220),
  rationale: String(rationale || "").trim(),
  mdmJustification: String(mdmJustification || "").trim(),
  evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
  estimatedAmount: roundCurrency(cpt.medicareRate * payerMultiplier),
});

export const estimateRevenueTracker = ({ insurancePlan, baselineCode = "99213", suggestions = [] }) => {
  const baseline = getCodeById(baselineCode);
  const payerMultiplier = getPayerMultiplier(insurancePlan);

  const baselineRevenue = baseline ? baseline.medicareRate * payerMultiplier : 0;

  let selectedEm = baseline
    ? toBillableEntry({
        cpt: baseline,
        payerMultiplier,
        type: "baseline-em",
        source: "baseline",
        confidence: 1,
        evidence: "Baseline established patient follow-up visit.",
        rationale: "Default baseline established visit before supported upgrades are identified.",
        mdmJustification:
          "Current coded baseline based on established follow-up complexity; upgrade requires stronger MDM support.",
      })
    : null;

  const addOnCodes = new Map();

  for (const suggestion of suggestions) {
    const cpt = getCodeById(suggestion.code);
    if (!cpt) continue;

    if (suggestion.code === baselineCode) {
      continue;
    }

    if (isEmCode(suggestion.code)) {
      const candidate = toBillableEntry({
        cpt,
        payerMultiplier,
        type: "em-upgrade",
        source: suggestion.source || "transcript",
        confidence: suggestion.confidence,
        evidence: suggestion.evidence,
        evidenceRefs: suggestion.evidenceRefs,
        rationale: suggestion.rationale,
        mdmJustification: suggestion.mdmJustification,
      });

      if (!selectedEm || candidate.estimatedAmount > selectedEm.estimatedAmount) {
        selectedEm = candidate;
      }
      continue;
    }

    if (!addOnCodes.has(cpt.code)) {
      addOnCodes.set(
        cpt.code,
        toBillableEntry({
          cpt,
          payerMultiplier,
          type: "add-on",
          source: suggestion.source || "transcript",
          confidence: suggestion.confidence,
          evidence: suggestion.evidence,
          evidenceRefs: suggestion.evidenceRefs,
          rationale: suggestion.rationale,
          mdmJustification: suggestion.mdmJustification,
        })
      );
    }
  }

  const billableCodes = [];
  if (selectedEm) billableCodes.push(selectedEm);
  billableCodes.push(...Array.from(addOnCodes.values()));

  const earnedNow = billableCodes.reduce((total, item) => total + Number(item.estimatedAmount || 0), 0);
  const builtFromDetected = Math.max(0, earnedNow - baselineRevenue);
  const currentCodesRevenue = roundCurrency(baselineRevenue);
  const suggestedCodesRevenue = roundCurrency(builtFromDetected);

  return {
    baseline: roundCurrency(baselineRevenue),
    builtFromDetected: roundCurrency(builtFromDetected),
    compliantOpportunity: roundCurrency(builtFromDetected),
    currentCodesRevenue,
    suggestedCodesRevenue,
    earnedNow: roundCurrency(earnedNow),
    projectedTotal: roundCurrency(earnedNow),
    projectedRevenueWithSuggestions: roundCurrency(earnedNow),
    payerMultiplier: roundCurrency(payerMultiplier),
    baselineCode,
    billableCodes,
  };
};
