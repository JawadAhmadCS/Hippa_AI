import fs from "node:fs";
import path from "node:path";

const PATIENT_CHARTS_FILE = path.resolve(process.cwd(), "data", "patient-charts.json");
let cachedCharts = null;

const defaultCharts = () => ({
  charts: [
    {
      patientRef: "PT-1042",
      externalChartId: "EHR-0001042",
      fullName: "John Carter",
      dob: "1981-06-14",
      lastVisitAt: "2026-03-20T10:15:00.000Z",
      clinicId: "north-hill-clinic",
    },
    {
      patientRef: "PT-2210",
      externalChartId: "EHR-0002210",
      fullName: "Maria Reed",
      dob: "1975-11-03",
      lastVisitAt: "2026-03-22T13:40:00.000Z",
      clinicId: "north-hill-clinic",
    },
    {
      patientRef: "PT-7788",
      externalChartId: "EHR-0007788",
      fullName: "Ava Thompson",
      dob: "2012-01-27",
      lastVisitAt: "2026-03-21T08:30:00.000Z",
      clinicId: "city-general-hospital",
    },
  ],
});

const sanitize = (value) => String(value || "").trim();

const ensureDataFile = () => {
  const dir = path.dirname(PATIENT_CHARTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PATIENT_CHARTS_FILE)) {
    fs.writeFileSync(PATIENT_CHARTS_FILE, `${JSON.stringify(defaultCharts(), null, 2)}\n`, "utf8");
  }
};

const normalizeChart = (chart = {}) => ({
  patientRef: sanitize(chart.patientRef).toUpperCase(),
  externalChartId: sanitize(chart.externalChartId).toUpperCase(),
  fullName: sanitize(chart.fullName),
  dob: sanitize(chart.dob),
  lastVisitAt: sanitize(chart.lastVisitAt),
  clinicId: sanitize(chart.clinicId || "default-clinic").toLowerCase(),
});

const readCharts = () => {
  if (cachedCharts) return cachedCharts;
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(PATIENT_CHARTS_FILE, "utf8"));
    const charts = Array.isArray(parsed?.charts) ? parsed.charts.map((item) => normalizeChart(item)) : [];
    cachedCharts = charts;
    return cachedCharts;
  } catch {
    cachedCharts = defaultCharts().charts.map((item) => normalizeChart(item));
    return cachedCharts;
  }
};

const inClinicScope = (chart, clinicId) => {
  const normalizedClinic = sanitize(clinicId).toLowerCase();
  if (!normalizedClinic) return true;
  return String(chart?.clinicId || "").toLowerCase() === normalizedClinic;
};

export const searchPatientCharts = ({ query = "", clinicId = "", limit = 12 } = {}) => {
  const normalized = sanitize(query).toLowerCase();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 50));

  return readCharts()
    .filter((chart) => inClinicScope(chart, clinicId))
    .filter((chart) => {
      if (!normalized) return true;
      const haystack = [chart.patientRef, chart.externalChartId, chart.fullName, chart.dob]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((left, right) => String(right.lastVisitAt).localeCompare(String(left.lastVisitAt)))
    .slice(0, safeLimit);
};

export const getPatientChartByRef = ({ patientRef = "", clinicId = "" } = {}) => {
  const normalizedRef = sanitize(patientRef).toUpperCase();
  if (!normalizedRef) return null;

  return (
    readCharts().find(
      (chart) =>
        inClinicScope(chart, clinicId) && String(chart.patientRef || "").toUpperCase() === normalizedRef
    ) || null
  );
};
