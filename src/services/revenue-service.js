import { getCodeById, getPayerMultiplier } from "./codebook-service.js";

const roundCurrency = (value) => Number(value.toFixed(2));

export const estimateRevenueTracker = ({ insurancePlan, baselineCode = "99213", suggestions = [] }) => {
  const baseline = getCodeById(baselineCode);
  const payerMultiplier = getPayerMultiplier(insurancePlan);

  const baselineRevenue = baseline ? baseline.medicareRate * payerMultiplier : 0;

  const compliantOpportunity = suggestions.reduce((sum, suggestion) => {
    const cpt = getCodeById(suggestion.code);
    if (!cpt) return sum;
    return sum + cpt.medicareRate * payerMultiplier;
  }, 0);

  return {
    baseline: roundCurrency(baselineRevenue),
    compliantOpportunity: roundCurrency(compliantOpportunity),
    projectedTotal: roundCurrency(baselineRevenue + compliantOpportunity),
    payerMultiplier: roundCurrency(payerMultiplier),
  };
};

