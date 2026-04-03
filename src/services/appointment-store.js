import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const appointments = new Map();
const NOTE_FIELDS = ["hpi", "ros", "exam", "assessment", "plan"];
const NOTE_EXTRA_FIELDS = ["additionalProviderNotes", "freeTextAdditions"];
const BILLING_ACCESS_RETENTION_DAYS = 60;
const BILLING_ACCESS_RETENTION_MS = BILLING_ACCESS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const APPOINTMENTS_STORE_PATH = path.resolve(process.cwd(), "data", "appointments.json");

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const nowIso = () => new Date().toISOString();

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const splitFullName = (value = "") => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return {
      firstName: "",
      lastName: "",
    };
  }
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const normalizePatientProfile = ({
  patientProfile = {},
  patientRef = "",
  insurancePlan = "",
} = {}) => {
  const fallbackFullName = [patientProfile?.firstName, patientProfile?.lastName]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullName = String(patientProfile?.fullName || fallbackFullName || "").trim();
  const split = splitFullName(fullName);
  const firstName = String(patientProfile?.firstName || split.firstName || "").trim();
  const lastName = String(patientProfile?.lastName || split.lastName || "").trim();
  const normalizedInsurance = String(patientProfile?.insuranceInfo || insurancePlan || "").trim();

  return {
    patientRef: String(patientProfile?.patientRef || patientRef || "")
      .trim()
      .toUpperCase(),
    externalChartId: String(patientProfile?.externalChartId || "")
      .trim()
      .toUpperCase(),
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" ").trim(),
    firstName,
    lastName,
    dob: String(patientProfile?.dob || "").trim(),
    insuranceInfo: normalizedInsurance,
  };
};

const hydrateAppointmentRecord = (raw = {}) => {
  const workflow = raw?.noteWorkflow || {};
  const normalizedInsurancePlan =
    String(raw?.insurancePlan || "medicare").trim().toLowerCase() || "medicare";
  const patientProfile = normalizePatientProfile({
    patientProfile: raw?.patientProfile || {},
    patientRef: raw?.patientRef || "anonymous",
    insurancePlan: normalizedInsurancePlan,
  });
  return {
    id: String(raw?.id || crypto.randomUUID()),
    patientRef: String(raw?.patientRef || "anonymous").trim() || "anonymous",
    patientProfile,
    patientChartId: String(raw?.patientChartId || "").trim(),
    doctorRef: String(raw?.doctorRef || "").trim(),
    doctorSpecialties: ensureArray(raw?.doctorSpecialties),
    clientId: String(raw?.clientId || "default-clinic").trim().toLowerCase() || "default-clinic",
    clientName: String(raw?.clientName || "Default Clinic").trim() || "Default Clinic",
    insurancePlan: normalizedInsurancePlan,
    visitType: String(raw?.visitType || "follow-up").trim().toLowerCase() || "follow-up",
    encounterMode: String(raw?.encounterMode || "in-person").trim().toLowerCase() || "in-person",
    telehealthPlatform: String(raw?.telehealthPlatform || "").trim().toLowerCase(),
    consentGiven: Boolean(raw?.consentGiven),
    consentFormId: String(raw?.consentFormId || "").trim(),
    consentSignedAt: String(raw?.consentSignedAt || nowIso()).trim() || nowIso(),
    accessPolicy: {
      ownerRole: String(raw?.accessPolicy?.ownerRole || "doctor").trim() || "doctor",
      patientAccess: Boolean(raw?.accessPolicy?.patientAccess),
    },
    createdAt: String(raw?.createdAt || nowIso()).trim() || nowIso(),
    transcriptSegments: ensureArray(raw?.transcriptSegments),
    suggestions: ensureArray(raw?.suggestions),
    icdSuggestions: ensureArray(raw?.icdSuggestions),
    liveInsights: {
      missedBillables: ensureArray(raw?.liveInsights?.missedBillables),
      documentationGaps: ensureArray(raw?.liveInsights?.documentationGaps),
      documentationImprovements: ensureArray(raw?.liveInsights?.documentationImprovements),
      chartNotes: ensureArray(raw?.liveInsights?.chartNotes),
      realTimePrompts: ensureArray(raw?.liveInsights?.realTimePrompts),
      latency: raw?.liveInsights?.latency || {},
      lastUpdatedAt: raw?.liveInsights?.lastUpdatedAt || "",
    },
    revenueTracker: {
      baseline: Number(raw?.revenueTracker?.baseline || 0),
      compliantOpportunity: Number(raw?.revenueTracker?.compliantOpportunity || 0),
      projectedTotal: Number(raw?.revenueTracker?.projectedTotal || 0),
      payerMultiplier: Number(raw?.revenueTracker?.payerMultiplier || 1),
      currentCodesRevenue: Number(raw?.revenueTracker?.currentCodesRevenue || 0),
      suggestedCodesRevenue: Number(raw?.revenueTracker?.suggestedCodesRevenue || 0),
      earnedNow: Number(raw?.revenueTracker?.earnedNow || 0),
      projectedRevenueWithSuggestions: Number(raw?.revenueTracker?.projectedRevenueWithSuggestions || 0),
      billableCodes: ensureArray(raw?.revenueTracker?.billableCodes),
    },
    analysisState: {
      lastAiRunAt: Number(raw?.analysisState?.lastAiRunAt || 0),
    },
    recordings: ensureArray(raw?.recordings),
    noteWorkflow: {
      noteId: String(workflow?.noteId || crypto.randomUUID()),
      status: String(workflow?.status || "draft"),
      locked: Boolean(workflow?.locked),
      currentVersionId: String(workflow?.currentVersionId || ""),
      finalizedVersionId: String(workflow?.finalizedVersionId || ""),
      finalizedAt: workflow?.finalizedAt || null,
      versions: ensureArray(workflow?.versions),
      currentAnalysis: workflow?.currentAnalysis || null,
      overrideRecords: ensureArray(workflow?.overrideRecords),
      delivery: {
        ehrWriteStatus: String(
          workflow?.delivery?.ehrWriteStatus ||
            (workflow?.delivery?.ehrSentAt ? "written" : "idle")
        ).trim().toLowerCase(),
        ehrQueuedAt: workflow?.delivery?.ehrQueuedAt || null,
        ehrLastAttemptAt: workflow?.delivery?.ehrLastAttemptAt || null,
        ehrError: String(workflow?.delivery?.ehrError || "").trim(),
        ehrSentAt: workflow?.delivery?.ehrSentAt || null,
        billingSentAt: workflow?.delivery?.billingSentAt || null,
        billingAccessExpiresAt: workflow?.delivery?.billingAccessExpiresAt || null,
        billingRetentionDays: Number(
          workflow?.delivery?.billingRetentionDays || BILLING_ACCESS_RETENTION_DAYS
        ),
        ehrDestination: workflow?.delivery?.ehrDestination || "",
        ehrExternalRecordId: workflow?.delivery?.ehrExternalRecordId || "",
      },
    },
  };
};

const persistAppointments = () => {
  try {
    fs.mkdirSync(path.dirname(APPOINTMENTS_STORE_PATH), { recursive: true });
    const snapshot = Array.from(appointments.values());
    const payload = {
      savedAt: nowIso(),
      count: snapshot.length,
      appointments: snapshot,
    };
    fs.writeFileSync(APPOINTMENTS_STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch {}
};

const loadPersistedAppointments = () => {
  try {
    if (!fs.existsSync(APPOINTMENTS_STORE_PATH)) return;
    const raw = fs.readFileSync(APPOINTMENTS_STORE_PATH, "utf8");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : ensureArray(parsed?.appointments);
    for (const item of rows) {
      const hydrated = hydrateAppointmentRecord(item);
      appointments.set(hydrated.id, hydrated);
    }
  } catch {}
};

const seedDemoBillingAppointmentIfEmpty = () => {
  const nowMs = Date.now();
  const hasBillingReadyAppointment = Array.from(appointments.values()).some((appointment) => {
    const workflow = appointment?.noteWorkflow || {};
    if (String(workflow.status || "").toLowerCase() !== "finalized") return false;
    if (!workflow.finalizedVersionId) return false;
    const expiresAtMs = new Date(workflow?.delivery?.billingAccessExpiresAt || "").getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) return false;
    return true;
  });
  if (hasBillingReadyAppointment) return;

  const createdAt = new Date(nowMs - 65 * 60 * 1000).toISOString();
  const finalizedAt = new Date(nowMs - 24 * 60 * 1000).toISOString();
  const retentionExpiresAt = new Date(nowMs + BILLING_ACCESS_RETENTION_MS).toISOString();
  const noteId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  const suggestedCpt = [
    {
      code: "99214",
      title: "Office/outpatient visit, established patient, moderate complexity",
      confidence: 0.92,
      rationale: "Chronic condition review, medication adjustment, and moderate MDM documented.",
      mdmJustification: "Moderate complexity MDM supported by risk and management decisions.",
      evidence: "History and plan include medication adjustment and risk discussion.",
      evidenceRefs: ["seg-2", "seg-4"],
      estimatedAmount: 137.7,
    },
    {
      code: "99406",
      title: "Smoking and tobacco cessation counseling visit, intermediate",
      confidence: 0.84,
      rationale: "Counseling time and cessation advice captured in transcript.",
      mdmJustification: "Time-based counseling with explicit cessation plan was documented.",
      evidence: "Provider advised quit strategy and follow-up counseling plan.",
      evidenceRefs: ["seg-3"],
      estimatedAmount: 18.84,
    },
  ];

  const suggestedIcd = [
    {
      code: "I10",
      description: "Essential (primary) hypertension",
      confidence: 0.9,
      rationale: "Hypertension management discussed with medication titration.",
      evidence: "Blood pressure trend and treatment plan noted in visit.",
      evidenceRefs: ["seg-2", "seg-4"],
    },
    {
      code: "F17.210",
      description: "Nicotine dependence, cigarettes, uncomplicated",
      confidence: 0.82,
      rationale: "Current smoking status and cessation counseling present.",
      evidence: "Patient confirmed cigarette use and accepted cessation counseling.",
      evidenceRefs: ["seg-3"],
    },
  ];

  const analysisSnapshot = {
    model: "demo-seed",
    confidence: 0.9,
    cptCodes: suggestedCpt,
    icdCodes: suggestedIcd,
    documentationImprovements: [
      {
        text: "Continue documenting counseling minutes for cessation follow-up visits.",
      },
    ],
    justification:
      "Codes reflect chronic disease follow-up, moderate MDM, and documented cessation counseling.",
    revenueTracker: {
      baseline: 96.11,
      compliantOpportunity: 156.54,
      projectedTotal: 156.54,
      payerMultiplier: 1,
      currentCodesRevenue: 96.11,
      suggestedCodesRevenue: 156.54,
      earnedNow: 156.54,
      projectedRevenueWithSuggestions: 156.54,
      billableCodes: suggestedCpt,
    },
  };

  const seeded = hydrateAppointmentRecord({
    id: "APPT-DEMO-BILLING-001",
    patientRef: "PT-1042",
    patientProfile: {
      patientRef: "PT-1042",
      externalChartId: "EHR-0001042",
      fullName: "John Carter",
      firstName: "John",
      lastName: "Carter",
      dob: "1981-06-14",
      insuranceInfo: "Medicare",
    },
    patientChartId: "EHR-0001042",
    doctorRef: "provider1",
    doctorSpecialties: ["Internal Medicine"],
    clientId: "north-hill-clinic",
    clientName: "North Hill Clinic",
    insurancePlan: "medicare",
    visitType: "follow-up",
    encounterMode: "in-person",
    telehealthPlatform: "",
    consentGiven: true,
    consentFormId: "CONSENT-DEMO-0001",
    consentSignedAt: createdAt,
    createdAt,
    transcriptSegments: [
      {
        id: "seg-1",
        sequence: 1,
        at: new Date(nowMs - 60 * 60 * 1000).toISOString(),
        source: "demo-seed",
        rawText: "Patient reports persistent elevated blood pressure readings at home.",
        cleanedText: "Patient reports persistent elevated blood pressure readings at home.",
      },
      {
        id: "seg-2",
        sequence: 2,
        at: new Date(nowMs - 57 * 60 * 1000).toISOString(),
        source: "demo-seed",
        rawText: "Provider adjusts antihypertensive medication and reviews monitoring plan.",
        cleanedText: "Provider adjusts antihypertensive medication and reviews monitoring plan.",
      },
      {
        id: "seg-3",
        sequence: 3,
        at: new Date(nowMs - 55 * 60 * 1000).toISOString(),
        source: "demo-seed",
        rawText: "Smoking cessation counseling provided for six minutes with follow-up resources.",
        cleanedText: "Smoking cessation counseling provided for six minutes with follow-up resources.",
      },
      {
        id: "seg-4",
        sequence: 4,
        at: new Date(nowMs - 53 * 60 * 1000).toISOString(),
        source: "demo-seed",
        rawText: "Plan includes blood pressure log and return visit in four weeks.",
        cleanedText: "Plan includes blood pressure log and return visit in four weeks.",
      },
    ],
    suggestions: suggestedCpt,
    icdSuggestions: suggestedIcd,
    revenueTracker: analysisSnapshot.revenueTracker,
    recordings: [
      {
        provider: "demo-seed",
        mimeType: "audio/wav",
        location: "/assets/demo-appointment-audio.wav",
        blobName: "demo/demo-appointment-audio.wav",
        uploadedAt: new Date(nowMs - 23 * 60 * 1000).toISOString(),
        retentionDays: BILLING_ACCESS_RETENTION_DAYS,
        retentionExpiresAt,
      },
    ],
    noteWorkflow: {
      noteId,
      status: "finalized",
      locked: true,
      currentVersionId: versionId,
      finalizedVersionId: versionId,
      finalizedAt,
      versions: [
        {
          versionId,
          versionNumber: 1,
          versionType: "finalized",
          isFinal: true,
          createdBy: "provider1",
          actorRole: "provider",
          createdAt: finalizedAt,
          finalizedBy: "provider1",
          finalizedRole: "provider",
          finalizedAt,
          finalCodes: suggestedCpt.map((item) => item.code),
          finalIcdCodes: suggestedIcd.map((item) => ({
            code: item.code,
            description: item.description,
          })),
          overrideReason: "",
          analysisSnapshot,
          contentJson: {
            sections: {
              hpi: "Established patient follow-up for hypertension and tobacco use review.",
              ros: "Denies chest pain or dyspnea. Reports intermittent headaches.",
              exam: "BP elevated in clinic. Cardiopulmonary exam otherwise stable.",
              assessment:
                "1) Essential hypertension, suboptimal control. 2) Tobacco dependence.",
              plan:
                "Increase antihypertensive dose, continue home BP log, tobacco cessation counseling completed, follow-up in 4 weeks.",
            },
            additionalProviderNotes:
              "Counseling time documented. Patient agreed to cessation plan and medication adjustment.",
            freeTextAdditions:
              "Follow-up encounter finalized with medication adjustment for hypertension and smoking cessation counseling. Patient instructed on home BP monitoring and return precautions.",
          },
          diffFromPrior: {
            changeCount: 10,
          },
        },
      ],
      currentAnalysis: analysisSnapshot,
      overrideRecords: [],
      delivery: {
        ehrWriteStatus: "written",
        ehrQueuedAt: finalizedAt,
        ehrLastAttemptAt: finalizedAt,
        ehrError: "",
        ehrSentAt: finalizedAt,
        billingSentAt: finalizedAt,
        billingAccessExpiresAt: retentionExpiresAt,
        billingRetentionDays: BILLING_ACCESS_RETENTION_DAYS,
        ehrDestination: "Demo EHR",
        ehrExternalRecordId: "EHR-DEMO-0001042",
      },
    },
  });

  appointments.set(seeded.id, seeded);
  persistAppointments();
};

const normalizeNoteValue = (value) => String(value || "").trim();
const mergeProviderAdditions = (content = {}) =>
  [
    normalizeNoteValue(content?.additionalProviderNotes),
    normalizeNoteValue(content?.freeTextAdditions),
  ]
    .filter(Boolean)
    .join("\n\n");

const normalizeNoteContent = (content = {}) => ({
  sections: {
    hpi: normalizeNoteValue(content?.sections?.hpi),
    ros: normalizeNoteValue(content?.sections?.ros),
    exam: normalizeNoteValue(content?.sections?.exam),
    assessment: normalizeNoteValue(content?.sections?.assessment),
    plan: normalizeNoteValue(content?.sections?.plan),
  },
  additionalProviderNotes: normalizeNoteValue(content?.additionalProviderNotes),
  freeTextAdditions: normalizeNoteValue(content?.freeTextAdditions) || mergeProviderAdditions(content),
});

const computeBillingAccessExpiresAt = (finalizedAt, existing) => {
  const candidate = String(existing || "").trim();
  if (candidate) {
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const finalMs = new Date(finalizedAt || nowIso()).getTime();
  const base = Number.isFinite(finalMs) ? finalMs : Date.now();
  return new Date(base + BILLING_ACCESS_RETENTION_MS).toISOString();
};

const isBillingAccessExpired = (expiresAt) => {
  const parsed = new Date(String(expiresAt || "")).getTime();
  if (!Number.isFinite(parsed)) return false;
  return parsed < Date.now();
};

const emptyNoteContent = () => normalizeNoteContent({});

const getFieldPathValue = (content, key) => {
  if (NOTE_FIELDS.includes(key)) return normalizeNoteValue(content?.sections?.[key]);
  if (NOTE_EXTRA_FIELDS.includes(key)) return normalizeNoteValue(content?.[key]);
  return "";
};

const buildInitialSourceMetadata = ({ actorId = "ai-assistant", actorRole = "system" } = {}) => {
  const at = nowIso();
  const fields = {};
  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    fields[key] = {
      sourceType: "ai_generated",
      createdBy: actorId,
      updatedBy: actorId,
      actorRole,
      createdAt: at,
      updatedAt: at,
    };
  }
  return { fields };
};

const deriveSourceMetadata = ({
  previousContent,
  nextContent,
  previousMetadata,
  actorId,
  actorRole,
}) => {
  const at = nowIso();
  const nextMetadata = {
    fields: { ...(previousMetadata?.fields || {}) },
  };

  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    const before = getFieldPathValue(previousContent, key);
    const after = getFieldPathValue(nextContent, key);
    const prior = previousMetadata?.fields?.[key];

    if (before === after) {
      nextMetadata.fields[key] = {
        ...(prior || {
          sourceType: "ai_generated",
          createdBy: "ai-assistant",
          updatedBy: "ai-assistant",
          actorRole: "system",
          createdAt: at,
          updatedAt: at,
        }),
      };
      continue;
    }

    const sourceType = before ? "provider_edited" : "provider_added";
    nextMetadata.fields[key] = {
      sourceType,
      createdBy: prior?.createdBy || actorId,
      updatedBy: actorId,
      actorRole,
      createdAt: prior?.createdAt || at,
      updatedAt: at,
    };
  }

  return nextMetadata;
};

const computeNoteDiff = (previousContent, nextContent) => {
  const changes = [];
  for (const key of [...NOTE_FIELDS, ...NOTE_EXTRA_FIELDS]) {
    const before = getFieldPathValue(previousContent, key);
    const after = getFieldPathValue(nextContent, key);
    if (before === after) continue;
    changes.push({
      field: key,
      before,
      after,
    });
  }
  return {
    changedFields: changes.map((item) => item.field),
    changes,
    changeCount: changes.length,
  };
};

const mapChartNotesToContent = (appointment) => {
  const linesBySection = {
    hpi: [],
    ros: [],
    exam: [],
    assessment: [],
    plan: [],
  };

  const chartNotes = Array.isArray(appointment?.liveInsights?.chartNotes)
    ? appointment.liveInsights.chartNotes
    : [];

  for (const note of chartNotes) {
    const category = String(note?.category || "").toLowerCase();
    const text = [note?.text, note?.detail].filter(Boolean).join(" ");
    if (!text) continue;

    if (category.includes("hpi") || category.includes("symptom")) {
      linesBySection.hpi.push(text);
      continue;
    }
    if (category.includes("ros")) {
      linesBySection.ros.push(text);
      continue;
    }
    if (category.includes("exam") || category.includes("physical")) {
      linesBySection.exam.push(text);
      continue;
    }
    if (category.includes("assessment")) {
      linesBySection.assessment.push(text);
      continue;
    }
    linesBySection.plan.push(text);
  }

  if (!linesBySection.hpi.length && Array.isArray(appointment?.transcriptSegments)) {
    const lastSegment = appointment.transcriptSegments[appointment.transcriptSegments.length - 1];
    const fallback = String(lastSegment?.cleanedText || lastSegment?.text || "").trim();
    if (fallback) {
      linesBySection.hpi.push(`Encounter discussion: ${fallback}`);
    }
  }

  return normalizeNoteContent({
    sections: {
      hpi: linesBySection.hpi.join("\n"),
      ros: linesBySection.ros.join("\n"),
      exam: linesBySection.exam.join("\n"),
      assessment: linesBySection.assessment.join("\n"),
      plan: linesBySection.plan.join("\n"),
    },
    freeTextAdditions: "",
  });
};

const buildNoteVersionRecord = ({
  appointment,
  content,
  actorId,
  actorRole,
  versionType = "provider_edit",
  previousVersion = null,
  forceFinal = false,
  metadataOverride = null,
  analysisSnapshot = null,
}) => {
  const normalizedContent = normalizeNoteContent(content);
  const previousContent = normalizeNoteContent(previousVersion?.contentJson || emptyNoteContent());
  const sourceMetadata =
    metadataOverride ||
    deriveSourceMetadata({
      previousContent,
      nextContent: normalizedContent,
      previousMetadata: previousVersion?.sourceMetadata || buildInitialSourceMetadata(),
      actorId,
      actorRole,
    });

  const diff = computeNoteDiff(previousContent, normalizedContent);
  const versionNumber = Number(previousVersion?.versionNumber || 0) + 1;
  const createdAt = nowIso();

  return {
    versionId: crypto.randomUUID(),
    noteId: appointment.noteWorkflow.noteId,
    versionNumber,
    versionType,
    isFinal: Boolean(forceFinal),
    contentJson: normalizedContent,
    sourceMetadata,
    diffFromPrior: diff,
    createdBy: actorId,
    actorRole,
    createdAt,
    analysisSnapshot: analysisSnapshot || appointment.noteWorkflow.currentAnalysis || null,
  };
};

const buildAppointmentSummary = (appointment) => {
  const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];
  const finalCptCodes = billableCodes.map((item) => item.code).filter(Boolean);
  const patientProfile = normalizePatientProfile({
    patientProfile: appointment.patientProfile || {},
    patientRef: appointment.patientRef,
    insurancePlan: appointment.insurancePlan,
  });

  return {
    id: appointment.id,
    patientRef: appointment.patientRef,
    patientProfile,
    patientFirstName: patientProfile.firstName,
    patientLastName: patientProfile.lastName,
    patientDob: patientProfile.dob,
    patientInsuranceInfo: patientProfile.insuranceInfo,
    patientChartId: appointment.patientChartId,
    doctorRef: appointment.doctorRef,
    doctorSpecialties: Array.isArray(appointment.doctorSpecialties) ? appointment.doctorSpecialties : [],
    clientId: appointment.clientId || "default-clinic",
    clientName: appointment.clientName || "Default Clinic",
    insurancePlan: appointment.insurancePlan,
    visitType: appointment.visitType,
    encounterMode: appointment.encounterMode || "in-person",
    telehealthPlatform: appointment.telehealthPlatform || "",
    consentGiven: appointment.consentGiven,
    createdAt: appointment.createdAt,
    transcriptCount: appointment.transcriptSegments.length,
    suggestionCount: appointment.suggestions.length,
    icdSuggestionCount: appointment.icdSuggestions.length,
    projectedRevenue: roundMoney(appointment.revenueTracker?.projectedTotal || 0),
    earnedNow: roundMoney(appointment.revenueTracker?.earnedNow || 0),
    finalCptCodes,
    noteStatus: appointment.noteWorkflow?.status || "draft",
    finalizedAt: appointment.noteWorkflow?.finalizedAt || null,
    noteDeliveryStatus: String(appointment.noteWorkflow?.delivery?.ehrWriteStatus || "idle")
      .trim()
      .toLowerCase(),
    noteDeliveryError: String(appointment.noteWorkflow?.delivery?.ehrError || "").trim(),
    ehrSentAt: appointment.noteWorkflow?.delivery?.ehrSentAt || null,
    missedOpportunityCount: Array.isArray(appointment.liveInsights?.missedBillables)
      ? appointment.liveInsights.missedBillables.length
      : 0,
  };
};

loadPersistedAppointments();
seedDemoBillingAppointmentIfEmpty();

export const createAppointment = ({
  patientRef,
  patientProfile = {},
  patientChartId = "",
  doctorRef,
  doctorSpecialties = [],
  clientId = "",
  clientName = "",
  insurancePlan,
  visitType,
  encounterMode = "in-person",
  telehealthPlatform = "",
  consentGiven,
  consentFormId,
  consentSignedAt,
}) => {
  const id = crypto.randomUUID();
  const normalizedInsurancePlan = String(insurancePlan || "medicare").trim().toLowerCase() || "medicare";
  const normalizedPatientProfile = normalizePatientProfile({
    patientProfile,
    patientRef,
    insurancePlan: normalizedInsurancePlan,
  });
  const appointment = {
    id,
    patientRef,
    patientProfile: normalizedPatientProfile,
    patientChartId: String(patientChartId || "").trim(),
    doctorRef,
    doctorSpecialties: Array.isArray(doctorSpecialties)
      ? Array.from(new Set(doctorSpecialties.map((item) => String(item || "").trim()).filter(Boolean)))
      : [],
    clientId: String(clientId || "default-clinic").trim().toLowerCase(),
    clientName: String(clientName || "Default Clinic").trim(),
    insurancePlan: normalizedInsurancePlan,
    visitType: visitType || "follow-up",
    encounterMode: String(encounterMode || "in-person").trim().toLowerCase(),
    telehealthPlatform: String(telehealthPlatform || "").trim().toLowerCase(),
    consentGiven: Boolean(consentGiven),
    consentFormId: consentFormId || "",
    consentSignedAt: consentSignedAt || new Date().toISOString(),
    accessPolicy: {
      ownerRole: "doctor",
      patientAccess: false,
    },
    createdAt: new Date().toISOString(),
    transcriptSegments: [],
    suggestions: [],
    icdSuggestions: [],
    liveInsights: {
      missedBillables: [],
      documentationGaps: [],
      documentationImprovements: [],
      chartNotes: [],
      realTimePrompts: [],
      latency: {},
    },
    revenueTracker: {
      baseline: 0,
      compliantOpportunity: 0,
      projectedTotal: 0,
      payerMultiplier: 1,
    },
    analysisState: {
      lastAiRunAt: 0,
    },
    recordings: [],
    noteWorkflow: {
      noteId: crypto.randomUUID(),
      status: "draft",
      locked: false,
      currentVersionId: "",
      finalizedVersionId: "",
      finalizedAt: null,
      versions: [],
      currentAnalysis: null,
      overrideRecords: [],
      delivery: {
        ehrWriteStatus: "idle",
        ehrQueuedAt: null,
        ehrLastAttemptAt: null,
        ehrError: "",
        ehrSentAt: null,
        billingSentAt: null,
        billingAccessExpiresAt: null,
        billingRetentionDays: BILLING_ACCESS_RETENTION_DAYS,
        ehrDestination: "",
        ehrExternalRecordId: "",
      },
    },
  };
  appointments.set(id, appointment);
  persistAppointments();
  return appointment;
};

export const getAppointment = (appointmentId) => appointments.get(appointmentId);

export const persistAppointmentStore = () => {
  persistAppointments();
};

export const listAppointmentRecords = () => Array.from(appointments.values());

export const listAppointments = () =>
  listAppointmentRecords()
    .map((appointment) => buildAppointmentSummary(appointment))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const appendTranscriptSegment = (appointmentId, segment) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const entry = {
    id: segment.id || crypto.randomUUID(),
    sequence: appointment.transcriptSegments.length + 1,
    text: segment.text,
    rawText: segment.rawText ?? segment.text,
    cleanedText: segment.cleanedText ?? segment.text,
    quality: segment.quality ?? null,
    source: segment.source,
    at: new Date().toISOString(),
  };
  appointment.transcriptSegments.push(entry);
  persistAppointments();
  return entry;
};

export const getTranscriptContext = (appointmentId, limit = 6) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return "";

  return appointment.transcriptSegments
    .slice(-Math.max(1, limit))
    .map((segment) => segment.cleanedText || segment.text)
    .join("\n");
};

export const addSuggestions = (appointmentId, suggestions, source) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const existingCodes = new Set(appointment.suggestions.map((item) => item.code));
  const cleanSuggestions = suggestions
    .filter((item) => item?.code && !existingCodes.has(item.code))
    .map((item) => ({
      ...item,
      source,
      createdAt: new Date().toISOString(),
    }));

  appointment.suggestions.push(...cleanSuggestions);
  if (cleanSuggestions.length) {
    persistAppointments();
  }
  return {
    appointment,
    newlyAdded: cleanSuggestions,
  };
};

export const addIcdSuggestions = (appointmentId, suggestions, source) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const existingCodes = new Set(appointment.icdSuggestions.map((item) => item.code));
  const cleanSuggestions = suggestions
    .filter((item) => item?.code && !existingCodes.has(item.code))
    .map((item) => ({
      ...item,
      source,
      createdAt: new Date().toISOString(),
    }));

  appointment.icdSuggestions.push(...cleanSuggestions);
  if (cleanSuggestions.length) {
    persistAppointments();
  }
  return {
    appointment,
    newlyAdded: cleanSuggestions,
  };
};

export const setRevenueTracker = (appointmentId, tracker) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.revenueTracker = tracker;
  persistAppointments();
  return appointment;
};

export const setLiveInsights = (appointmentId, insights) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.liveInsights = {
    ...(appointment.liveInsights || {}),
    ...(insights || {}),
  };
  persistAppointments();
  return appointment.liveInsights;
};

export const addRecording = (appointmentId, recordingInfo) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  appointment.recordings.push({
    ...recordingInfo,
    at: new Date().toISOString(),
  });
  persistAppointments();
  return appointment;
};

export const ensureNoteDraftVersion = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  if (Array.isArray(workflow.versions) && workflow.versions.length) {
    const current = workflow.versions.find((item) => item.versionId === workflow.currentVersionId);
    return current || workflow.versions[workflow.versions.length - 1] || null;
  }

  const aiContent = mapChartNotesToContent(appointment);
  const aiVersion = buildNoteVersionRecord({
    appointment,
    content: aiContent,
    actorId: "ai-assistant",
    actorRole: "system",
    versionType: "ai_original",
    previousVersion: null,
    metadataOverride: buildInitialSourceMetadata({ actorId: "ai-assistant", actorRole: "system" }),
  });

  workflow.versions = [aiVersion];
  workflow.currentVersionId = aiVersion.versionId;
  workflow.status = "draft";
  workflow.locked = false;
  persistAppointments();
  return aiVersion;
};

export const getCurrentNoteVersion = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  ensureNoteDraftVersion(appointmentId);
  const workflow = appointment.noteWorkflow;
  return (
    workflow.versions.find((item) => item.versionId === workflow.currentVersionId) ||
    workflow.versions[workflow.versions.length - 1] ||
    null
  );
};

export const listNoteVersions = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return [];
  ensureNoteDraftVersion(appointmentId);
  return [...appointment.noteWorkflow.versions].sort(
    (left, right) => Number(left.versionNumber || 0) - Number(right.versionNumber || 0)
  );
};

export const setCurrentNoteAnalysis = (appointmentId, analysis) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  ensureNoteDraftVersion(appointmentId);
  appointment.noteWorkflow.currentAnalysis = {
    ...(analysis || {}),
    generatedAt: nowIso(),
  };
  persistAppointments();
  return appointment.noteWorkflow.currentAnalysis;
};

export const getCurrentNoteAnalysis = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  return appointment.noteWorkflow?.currentAnalysis || null;
};

export const upsertDraftNoteVersion = ({
  appointmentId,
  content,
  actorId = "provider",
  actorRole = "provider",
  allowAfterFinal = false,
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  const current = getCurrentNoteVersion(appointmentId);
  if (!current) return null;

  if (workflow.locked && !allowAfterFinal) {
    return {
      error: "finalized-note-locked",
      appointment,
      currentVersion: current,
    };
  }

  const nextContent = normalizeNoteContent(content || current.contentJson);
  const diff = computeNoteDiff(current.contentJson, nextContent);
  if (!diff.changeCount) {
    return {
      appointment,
      version: current,
      unchanged: true,
    };
  }

  const nextVersion = buildNoteVersionRecord({
    appointment,
    content: nextContent,
    actorId,
    actorRole,
    versionType: workflow.locked ? "amendment" : "provider_edit",
    previousVersion: current,
  });

  const wasLocked = Boolean(workflow.locked);
  workflow.versions.push(nextVersion);
  workflow.currentVersionId = nextVersion.versionId;
  workflow.status = wasLocked ? "amended" : "draft";
  workflow.locked = false;
  if (!wasLocked) {
    workflow.finalizedVersionId = "";
    workflow.finalizedAt = null;
  }
  persistAppointments();
  return {
    appointment,
    version: nextVersion,
    unchanged: false,
  };
};

export const finalizeCurrentNote = ({
  appointmentId,
  actorId = "provider",
  actorRole = "provider",
  overrideReason = "",
  finalCodes = null,
  finalIcdCodes = null,
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  const current = getCurrentNoteVersion(appointmentId);
  if (!current) return null;
  const fallbackCodes = Array.isArray(workflow.currentAnalysis?.cptCodes)
    ? workflow.currentAnalysis.cptCodes.map((item) => String(item?.code || "").trim().toUpperCase())
    : Array.isArray(appointment.revenueTracker?.billableCodes)
      ? appointment.revenueTracker.billableCodes
          .map((item) => String(item?.code || "").trim().toUpperCase())
          .filter(Boolean)
      : [];
  const normalizedFinalCodes = Array.isArray(finalCodes)
    ? finalCodes.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : fallbackCodes.filter(Boolean);
  const fallbackIcd = Array.isArray(workflow.currentAnalysis?.icdCodes)
    ? workflow.currentAnalysis.icdCodes.map((item) => ({
        code: String(item?.code || "").trim().toUpperCase(),
        description: String(item?.description || "").trim(),
      }))
    : [];
  const normalizedFinalIcdCodes = (
    Array.isArray(finalIcdCodes) && finalIcdCodes.length ? finalIcdCodes : fallbackIcd
  )
    .map((item) => {
      if (typeof item === "string") {
        return {
          code: String(item || "").trim().toUpperCase(),
          description: "",
        };
      }
      return {
        code: String(item?.code || "").trim().toUpperCase(),
        description: String(item?.description || "").trim(),
      };
    })
    .filter((item) => item.code);

  const finalizedVersion = {
    ...current,
    isFinal: true,
    versionType: current.versionType === "ai_original" ? "finalized_ai_draft" : "finalized",
    finalizedBy: actorId,
    finalizedRole: actorRole,
    finalizedAt: nowIso(),
    finalCodes: normalizedFinalCodes,
    finalIcdCodes: normalizedFinalIcdCodes,
    overrideReason: normalizeNoteValue(overrideReason),
  };

  const index = workflow.versions.findIndex((item) => item.versionId === current.versionId);
  if (index >= 0) {
    workflow.versions.splice(index, 1, finalizedVersion);
  } else {
    workflow.versions.push(finalizedVersion);
  }

  workflow.currentVersionId = finalizedVersion.versionId;
  workflow.finalizedVersionId = finalizedVersion.versionId;
  workflow.finalizedAt = finalizedVersion.finalizedAt;
  workflow.status = "finalized";
  workflow.locked = true;
  const billingAccessExpiresAt = computeBillingAccessExpiresAt(finalizedVersion.finalizedAt);
  const queuedAt = nowIso();
  workflow.delivery = {
    ...(workflow.delivery || {}),
    ehrWriteStatus: "queued",
    ehrQueuedAt: queuedAt,
    ehrLastAttemptAt: null,
    ehrError: "",
    ehrSentAt: null,
    ehrDestination: "",
    ehrExternalRecordId: "",
    billingSentAt: queuedAt,
    billingAccessExpiresAt,
    billingRetentionDays: BILLING_ACCESS_RETENTION_DAYS,
  };
  persistAppointments();
  return {
    appointment,
    version: finalizedVersion,
    delivery: workflow.delivery,
  };
};

export const getFinalizedNotePacket = (appointmentId) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow;
  if (!workflow || workflow.status !== "finalized" || !workflow.finalizedVersionId) return null;

  const finalVersion = workflow.versions.find((item) => item.versionId === workflow.finalizedVersionId);
  if (!finalVersion) return null;
  const analysisSnapshot = finalVersion.analysisSnapshot || workflow.currentAnalysis || null;
  const billingAccessExpiresAt = computeBillingAccessExpiresAt(
    workflow.finalizedAt || finalVersion.finalizedAt,
    workflow.delivery?.billingAccessExpiresAt
  );
  const billingAccessExpired = isBillingAccessExpired(billingAccessExpiresAt);

  const approvedCodes = (
    finalVersion.finalCodes ||
    analysisSnapshot?.cptCodes ||
    (appointment.revenueTracker?.billableCodes || []).map((item) => item.code)
  )
    .map((item) => (typeof item === "string" ? item : String(item?.code || "")))
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);

  const analysisCodes = Array.isArray(analysisSnapshot?.cptCodes)
    ? analysisSnapshot.cptCodes
    : [];
  const analysisIcdCodes = Array.isArray(analysisSnapshot?.icdCodes)
    ? analysisSnapshot.icdCodes
    : [];
  const approvedIcdCodes = (
    finalVersion.finalIcdCodes ||
    analysisIcdCodes.map((item) => ({
      code: item?.code,
      description: item?.description,
    })) ||
    []
  )
    .map((item) =>
      typeof item === "string"
        ? { code: String(item || "").trim().toUpperCase(), description: "" }
        : {
            code: String(item?.code || "").trim().toUpperCase(),
            description: String(item?.description || "").trim(),
          }
    )
    .filter((item) => item.code);
  const billableCodes = Array.isArray(appointment.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];
  const codeEvidence = approvedCodes.map((code) => {
    const analysisMatch =
      analysisCodes.find((item) => String(item?.code || "").toUpperCase() === code) || null;
    const billableMatch =
      billableCodes.find((item) => String(item?.code || "").toUpperCase() === code) || null;

    return {
      code,
      title: analysisMatch?.title || billableMatch?.title || "",
      confidence: Number(analysisMatch?.confidence ?? billableMatch?.confidence ?? 0),
      rationale: String(analysisMatch?.rationale || billableMatch?.rationale || "").trim(),
      mdmJustification: String(
        analysisMatch?.mdmJustification || billableMatch?.mdmJustification || ""
      ).trim(),
      evidence: String(analysisMatch?.evidence || billableMatch?.evidence || "").trim(),
      evidenceRefs: Array.isArray(analysisMatch?.evidenceRefs)
        ? analysisMatch.evidenceRefs
        : Array.isArray(billableMatch?.evidenceRefs)
          ? billableMatch.evidenceRefs
          : [],
      estimatedAmount: Number(billableMatch?.estimatedAmount || 0),
    };
  });
  const analysisRevenueTracker = analysisSnapshot?.revenueTracker || {};
  const currentEstimatedRevenue = roundMoney(
    analysisRevenueTracker?.earnedNow ??
      analysisRevenueTracker?.projectedTotal ??
      appointment.revenueTracker?.earnedNow ??
      appointment.revenueTracker?.projectedTotal ??
      0
  );
  const potentialEstimatedRevenue = roundMoney(
    analysisRevenueTracker?.projectedRevenueWithSuggestions ??
      analysisRevenueTracker?.projectedTotal ??
      appointment.revenueTracker?.projectedRevenueWithSuggestions ??
      appointment.revenueTracker?.projectedTotal ??
      currentEstimatedRevenue
  );
  const expectedRevenueFromAppointment = potentialEstimatedRevenue;
  const patientProfile = normalizePatientProfile({
    patientProfile: appointment.patientProfile || {},
    patientRef: appointment.patientRef,
    insurancePlan: appointment.insurancePlan,
  });

  return {
    appointmentId: appointment.id,
    appointmentTime: appointment.createdAt || null,
    patientRef: appointment.patientRef,
    patientProfile,
    insurancePlan: String(appointment.insurancePlan || "").trim().toLowerCase(),
    patientChartId: appointment.patientChartId || "",
    doctorRef: appointment.doctorRef,
    doctorSpecialties: Array.isArray(appointment.doctorSpecialties) ? appointment.doctorSpecialties : [],
    clientId: appointment.clientId || "default-clinic",
    clientName: appointment.clientName || "Default Clinic",
    encounterMode: appointment.encounterMode || "in-person",
    telehealthPlatform: appointment.telehealthPlatform || "",
    noteId: workflow.noteId,
    noteStatus: workflow.status,
    finalizedAt: workflow.finalizedAt,
    expectedRevenueFromAppointment,
    mergedRevenue: {
      currentEstimatedRevenue,
      potentialEstimatedRevenue,
    },
    billingAccessExpiresAt,
    billingAccessExpired,
    billingRetentionDays: Number(workflow.delivery?.billingRetentionDays || BILLING_ACCESS_RETENTION_DAYS),
    finalVersion,
    approvedCodes,
    recommendedCptCodes: analysisCodes,
    recommendedIcd10Codes: analysisIcdCodes,
    approvedIcdCodes,
    codeEvidence,
    codingAnalysis: analysisSnapshot,
    delivery: workflow.delivery || {},
    transcriptSegments: Array.isArray(appointment.transcriptSegments)
      ? appointment.transcriptSegments.map((segment) => ({
          id: segment.id,
          sequence: segment.sequence,
          at: segment.at,
          source: segment.source,
          cleanedText: segment.cleanedText || segment.text || "",
        }))
      : [],
    recordings: Array.isArray(appointment.recordings)
      ? appointment.recordings.map((item) => ({
          provider: String(item?.provider || "").trim(),
          mimeType: String(item?.mimeType || "").trim(),
          location: String(item?.location || item?.blobUrl || item?.blobName || "").trim(),
          retentionExpiresAt: item?.retentionExpiresAt || null,
          uploadedAt: item?.uploadedAt || item?.at || null,
        }))
      : [],
    revenueTracker: appointment.revenueTracker || null,
  };
};

export const addOverrideRecord = ({
  appointmentId,
  originalCode = "",
  finalCode = "",
  reason = "",
  providerId = "",
}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;

  const record = {
    overrideId: crypto.randomUUID(),
    versionId: appointment.noteWorkflow?.currentVersionId || "",
    originalCode: String(originalCode || "").trim().toUpperCase(),
    finalCode: String(finalCode || "").trim().toUpperCase(),
    reason: String(reason || "").trim(),
    providerId: String(providerId || "").trim(),
    timestamp: nowIso(),
  };

  const existing = Array.isArray(appointment.noteWorkflow?.overrideRecords)
    ? appointment.noteWorkflow.overrideRecords
    : [];
  appointment.noteWorkflow.overrideRecords = [record, ...existing].slice(0, 300);
  persistAppointments();
  return record;
};

export const updateEhrDeliveryStatus = ({
  appointmentId,
  status = "queued",
  destination = "",
  externalRecordId = "",
  error = "",
} = {}) => {
  const appointment = getAppointment(appointmentId);
  if (!appointment) return null;
  const workflow = appointment.noteWorkflow || {};
  const delivery = workflow.delivery || {};
  const normalizedStatus = String(status || "queued")
    .trim()
    .toLowerCase();
  const at = nowIso();

  const next = {
    ...delivery,
    ehrWriteStatus: normalizedStatus,
    ehrLastAttemptAt: at,
  };

  if (normalizedStatus === "queued") {
    next.ehrQueuedAt = at;
    next.ehrSentAt = null;
    next.ehrError = "";
  } else if (normalizedStatus === "writing") {
    if (!next.ehrQueuedAt) next.ehrQueuedAt = at;
    next.ehrError = "";
  } else if (normalizedStatus === "written") {
    next.ehrSentAt = at;
    next.ehrDestination = String(destination || "").trim();
    next.ehrExternalRecordId = String(externalRecordId || "").trim();
    next.ehrError = "";
  } else if (normalizedStatus === "failed") {
    next.ehrError = String(error || "EHR write failed.").trim();
    next.ehrSentAt = null;
  }

  workflow.delivery = next;
  persistAppointments();
  return workflow.delivery;
};
