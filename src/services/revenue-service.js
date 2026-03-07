import { getCodeById, getPayerMultiplier } from "./codebook-service.js";

const roundCurrency = (value) => Number(value.toFixed(2));
const isEmCode = (code) => /^9921[3-5]$/.test(String(code || ""));

const toBillableEntry = ({ cpt, payerMultiplier, type, source, confidence, evidence }) => ({
  code: cpt.code,
  title: cpt.title,
  type,
  source,
  confidence: Number(confidence || 0),
  evidence: String(evidence || "").slice(0, 220),
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
        })
      );
    }
  }

  const billableCodes = [];
  if (selectedEm) billableCodes.push(selectedEm);
  billableCodes.push(...Array.from(addOnCodes.values()));

  const earnedNow = billableCodes.reduce((total, item) => total + Number(item.estimatedAmount || 0), 0);
  const builtFromDetected = Math.max(0, earnedNow - baselineRevenue);

  return {
    baseline: roundCurrency(baselineRevenue),
    builtFromDetected: roundCurrency(builtFromDetected),
    compliantOpportunity: roundCurrency(builtFromDetected),
    earnedNow: roundCurrency(earnedNow),
    projectedTotal: roundCurrency(earnedNow),
    payerMultiplier: roundCurrency(payerMultiplier),
    baselineCode,
    billableCodes,
  };
};
