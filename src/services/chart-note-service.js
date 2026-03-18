import { buildEvidenceRefs } from "./evidence-service.js";

const NOTE_RULES = [
  {
    id: "blood-pressure",
    category: "Assessment",
    keywords: ["blood pressure", "hypertension", "bp", "150"],
    text: "Blood pressure follow-up and chronic management were discussed.",
    detail: "Elevated readings or treatment response were referenced in the encounter.",
  },
  {
    id: "medication-management",
    category: "Plan",
    keywords: ["medication", "adherence", "dose", "side effect", "adjust"],
    text: "Medication management was actively reviewed.",
    detail: "The conversation included current treatment, adherence, or medication changes.",
  },
  {
    id: "symptom-review",
    category: "HPI",
    keywords: ["fatigue", "tired", "weak", "pain", "cough", "shortness of breath"],
    text: "Current symptom burden and functional impact were reviewed.",
    detail: "Symptom updates relevant to today's assessment were captured in the chart note.",
  },
  {
    id: "labs",
    category: "Plan",
    keywords: ["lab", "blood test", "cbc", "thyroid", "panel"],
    text: "Diagnostic workup and testing rationale were discussed.",
    detail: "The encounter referenced evaluation steps or follow-up testing.",
  },
  {
    id: "screening",
    category: "Assessment",
    keywords: ["screening", "phq", "depression", "annual wellness", "preventive"],
    text: "Preventive or screening elements were discussed.",
    detail: "Screening or wellness content was captured for the encounter summary.",
  },
  {
    id: "tobacco",
    category: "Counseling",
    keywords: ["tobacco", "smoking", "cessation", "nicotine"],
    text: "Counseling topics related to tobacco use were discussed.",
    detail: "Behavior change counseling content was captured for charting and coding review.",
  },
];

const containsAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

export const buildChartNotes = ({ transcriptSegments = [] } = {}) => {
  const segments = Array.isArray(transcriptSegments) ? transcriptSegments : [];
  if (!segments.length) return [];

  const transcriptText = segments
    .map((segment) => String(segment?.cleanedText || segment?.text || "").toLowerCase())
    .join(" ");

  const notes = NOTE_RULES.filter((rule) => containsAny(transcriptText, rule.keywords)).map((rule) => ({
    id: rule.id,
    category: rule.category,
    text: rule.text,
    detail: rule.detail,
    evidenceRefs: buildEvidenceRefs({
      transcriptSegments: segments,
      cueTexts: rule.keywords,
      maxRefs: 2,
    }),
  }));

  if (notes.length) {
    return notes.slice(0, 6);
  }

  const latest = segments[segments.length - 1];
  return [
    {
      id: "encounter-captured",
      category: "Summary",
      text: "Encounter details are being organized into chart notes.",
      detail: "The full transcript is saved in the background and can be opened from any code recommendation.",
      evidenceRefs: latest
        ? [
            {
              segmentId: latest.id,
              source: latest.source,
              at: latest.at,
              excerpt: String(latest.cleanedText || latest.text || "").trim(),
              sequence: Number(latest.sequence || 0),
            },
          ]
        : [],
    },
  ];
};
