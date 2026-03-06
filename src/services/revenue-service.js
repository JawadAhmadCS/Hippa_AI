import { getCodeById, getPayerMultiplier } from "./codebook-service.js";

const roundCurrency = (value) => Number(value.toFixed(2));
const isEmCode = (code) => /^9921[3-5]$/.test(String(code || ""));

export const estimateRevenueTracker = ({ insurancePlan, baselineCode = "99213", suggestions = [] }) => {
  const baseline = getCodeById(baselineCode);
  const payerMultiplier = getPayerMultiplier(insurancePlan);

  const baselineRevenue = baseline ? baseline.medicareRate * payerMultiplier : 0;

  let nonEmOpportunity = 0;
  let bestEmRevenue = baselineRevenue;

  for (const suggestion of suggestions) {
    const cpt = getCodeById(suggestion.code);
    if (!cpt) continue;

    const codeRevenue = cpt.medicareRate * payerMultiplier;

    if (suggestion.code === baselineCode) {
      continue;
    }

    if (isEmCode(suggestion.code)) {
      if (codeRevenue > bestEmRevenue) {
        bestEmRevenue = codeRevenue;
      }
      continue;
    }

    nonEmOpportunity += codeRevenue;
  }

  const emUpgradeOpportunity = Math.max(0, bestEmRevenue - baselineRevenue);
  const compliantOpportunity = nonEmOpportunity + emUpgradeOpportunity;

  return {
    baseline: roundCurrency(baselineRevenue),
    compliantOpportunity: roundCurrency(compliantOpportunity),
    projectedTotal: roundCurrency(baselineRevenue + compliantOpportunity),
    payerMultiplier: roundCurrency(payerMultiplier),
  };
};
