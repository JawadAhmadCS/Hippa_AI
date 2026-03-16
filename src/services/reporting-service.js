import { listAppointmentRecords } from "./appointment-store.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const normalizeGranularity = (value) => {
  const normalized = String(value || "daily").toLowerCase();
  if (normalized === "weekly") return "weekly";
  if (normalized === "monthly") return "monthly";
  return "daily";
};

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const getYearWeek = (date) => {
  const cloned = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  cloned.setUTCDate(cloned.getUTCDate() + 4 - (cloned.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(cloned.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((cloned - yearStart) / 86400000 + 1) / 7);
  return `${cloned.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const getPeriodLabel = (date, granularity) => {
  if (granularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") {
    return getYearWeek(date);
  }
  return toIsoDate(date);
};

const formatCurrency = (value) => `$${roundMoney(value).toFixed(2)}`;

const getAppointmentRevenue = (appointment) => ({
  projected: Number(appointment.revenueTracker?.projectedTotal || 0),
  earned: Number(appointment.revenueTracker?.earnedNow || 0),
});

const mapAndSort = (map, keyName) =>
  Array.from(map.values())
    .map((item) => ({
      ...item,
      projectedRevenue: roundMoney(item.projectedRevenue),
      earnedNow: roundMoney(item.earnedNow),
    }))
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue)
    .map((item) => ({
      [keyName]: item[keyName],
      encounters: item.encounters,
      projectedRevenue: item.projectedRevenue,
      earnedNow: item.earnedNow,
    }));

export const buildRevenueReport = ({
  granularity = "daily",
  dateFrom = "",
  dateTo = "",
} = {}) => {
  const normalizedGranularity = normalizeGranularity(granularity);
  const start = normalizeDate(dateFrom);
  const end = normalizeDate(dateTo);
  if (end) end.setHours(23, 59, 59, 999);
  const all = listAppointmentRecords();

  const filtered = all.filter((appointment) => {
    const created = normalizeDate(appointment.createdAt);
    if (!created) return false;
    if (start && created < start) return false;
    if (end && created > end) return false;
    return true;
  });

  const totals = {
    encounters: filtered.length,
    consentedEncounters: 0,
    totalProjectedRevenue: 0,
    totalEarnedNow: 0,
    avgProjectedPerEncounter: 0,
  };

  const byInsuranceMap = new Map();
  const byVisitTypeMap = new Map();
  const periodMap = new Map();
  const cptFrequencyMap = new Map();
  const missedOpportunityMap = new Map();

  for (const appointment of filtered) {
    const created = normalizeDate(appointment.createdAt);
    if (!created) continue;

    const { projected, earned } = getAppointmentRevenue(appointment);
    totals.totalProjectedRevenue += projected;
    totals.totalEarnedNow += earned;
    if (appointment.consentGiven) totals.consentedEncounters += 1;

    const insuranceKey = String(appointment.insurancePlan || "unknown").toLowerCase();
    const insuranceBucket = byInsuranceMap.get(insuranceKey) || {
      insurancePlan: insuranceKey,
      encounters: 0,
      projectedRevenue: 0,
      earnedNow: 0,
    };
    insuranceBucket.encounters += 1;
    insuranceBucket.projectedRevenue += projected;
    insuranceBucket.earnedNow += earned;
    byInsuranceMap.set(insuranceKey, insuranceBucket);

    const visitKey = String(appointment.visitType || "unknown").toLowerCase();
    const visitBucket = byVisitTypeMap.get(visitKey) || {
      visitType: visitKey,
      encounters: 0,
      projectedRevenue: 0,
      earnedNow: 0,
    };
    visitBucket.encounters += 1;
    visitBucket.projectedRevenue += projected;
    visitBucket.earnedNow += earned;
    byVisitTypeMap.set(visitKey, visitBucket);

    const periodLabel = getPeriodLabel(created, normalizedGranularity);
    const periodBucket = periodMap.get(periodLabel) || {
      period: periodLabel,
      encounters: 0,
      projectedRevenue: 0,
      earnedNow: 0,
    };
    periodBucket.encounters += 1;
    periodBucket.projectedRevenue += projected;
    periodBucket.earnedNow += earned;
    periodMap.set(periodLabel, periodBucket);

    const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
      ? appointment.revenueTracker.billableCodes
      : [];
    for (const code of billableCodes) {
      const codeId = String(code.code || "").toUpperCase().trim();
      if (!codeId) continue;
      const entry = cptFrequencyMap.get(codeId) || {
        code: codeId,
        title: code.title || "",
        frequency: 0,
        projectedRevenue: 0,
      };
      entry.frequency += 1;
      entry.projectedRevenue += Number(code.estimatedAmount || 0);
      if (!entry.title && code.title) entry.title = code.title;
      cptFrequencyMap.set(codeId, entry);
    }

    const missed = Array.isArray(appointment.liveInsights?.missedBillables)
      ? appointment.liveInsights.missedBillables
      : [];
    for (const item of missed) {
      const potentialCode = String(item.potentialCode || "").toUpperCase().trim();
      if (!potentialCode) continue;
      const entry = missedOpportunityMap.get(potentialCode) || {
        potentialCode,
        component: item.component || "",
        count: 0,
      };
      entry.count += 1;
      if (!entry.component && item.component) entry.component = item.component;
      missedOpportunityMap.set(potentialCode, entry);
    }
  }

  totals.totalProjectedRevenue = roundMoney(totals.totalProjectedRevenue);
  totals.totalEarnedNow = roundMoney(totals.totalEarnedNow);
  totals.avgProjectedPerEncounter = totals.encounters
    ? roundMoney(totals.totalProjectedRevenue / totals.encounters)
    : 0;

  const byInsurance = mapAndSort(byInsuranceMap, "insurancePlan");
  const byVisitType = mapAndSort(byVisitTypeMap, "visitType");

  const trendSeries = Array.from(periodMap.values())
    .map((item) => ({
      period: item.period,
      encounters: item.encounters,
      projectedRevenue: roundMoney(item.projectedRevenue),
      earnedNow: roundMoney(item.earnedNow),
    }))
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));

  const cptFrequency = Array.from(cptFrequencyMap.values())
    .map((item) => ({
      code: item.code,
      title: item.title || "",
      frequency: item.frequency,
      projectedRevenue: roundMoney(item.projectedRevenue),
    }))
    .sort((a, b) => b.frequency - a.frequency || b.projectedRevenue - a.projectedRevenue);

  const missedOpportunity = Array.from(missedOpportunityMap.values())
    .sort((a, b) => b.count - a.count || String(a.potentialCode).localeCompare(String(b.potentialCode)));

  return {
    generatedAt: new Date().toISOString(),
    granularity: normalizedGranularity,
    totals,
    byInsurance,
    byVisitType,
    trendSeries,
    cptFrequency,
    missedOpportunity,
    recentAppointments: filtered
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((appointment) => ({
        id: appointment.id,
        createdAt: appointment.createdAt,
        doctorRef: appointment.doctorRef,
        patientRef: appointment.patientRef,
        insurancePlan: appointment.insurancePlan,
        visitType: appointment.visitType,
        projectedRevenue: roundMoney(appointment.revenueTracker?.projectedTotal || 0),
        earnedNow: roundMoney(appointment.revenueTracker?.earnedNow || 0),
      })),
  };
};

export const buildRevenueCsv = ({ report }) => {
  const lines = [];
  lines.push("Section,Key,Value");
  lines.push(`Totals,encounters,${report.totals.encounters}`);
  lines.push(`Totals,consentedEncounters,${report.totals.consentedEncounters}`);
  lines.push(`Totals,totalProjectedRevenue,${formatCurrency(report.totals.totalProjectedRevenue)}`);
  lines.push(`Totals,totalEarnedNow,${formatCurrency(report.totals.totalEarnedNow)}`);
  lines.push(
    `Totals,avgProjectedPerEncounter,${formatCurrency(report.totals.avgProjectedPerEncounter)}`
  );
  lines.push("");
  lines.push("ByInsurance,insurancePlan,encounters,projectedRevenue,earnedNow");
  for (const row of report.byInsurance || []) {
    lines.push(
      `ByInsurance,${row.insurancePlan},${row.encounters},${row.projectedRevenue},${row.earnedNow}`
    );
  }
  lines.push("");
  lines.push("ByVisitType,visitType,encounters,projectedRevenue,earnedNow");
  for (const row of report.byVisitType || []) {
    lines.push(
      `ByVisitType,${row.visitType},${row.encounters},${row.projectedRevenue},${row.earnedNow}`
    );
  }
  lines.push("");
  lines.push("CPTFrequency,code,title,frequency,projectedRevenue");
  for (const row of report.cptFrequency || []) {
    const safeTitle = String(row.title || "").replaceAll('"', '""');
    lines.push(`CPTFrequency,${row.code},"${safeTitle}",${row.frequency},${row.projectedRevenue}`);
  }
  lines.push("");
  lines.push("MissedOpportunity,potentialCode,component,count");
  for (const row of report.missedOpportunity || []) {
    const safeComponent = String(row.component || "").replaceAll('"', '""');
    lines.push(`MissedOpportunity,${row.potentialCode},"${safeComponent}",${row.count}`);
  }
  lines.push("");
  lines.push("Trend,period,encounters,projectedRevenue,earnedNow");
  for (const row of report.trendSeries || []) {
    lines.push(
      `Trend,${row.period},${row.encounters},${row.projectedRevenue},${row.earnedNow}`
    );
  }

  return `${lines.join("\n")}\n`;
};
