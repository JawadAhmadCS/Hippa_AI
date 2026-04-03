import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(process.cwd(), "data", "platform-config.json");

const defaultConfig = () => ({
  general: {
    practiceName: "Demo Medical Practice",
    npiNumber: "",
    address: "",
    timezone: "UTC",
    language: "en",
    emailBillingAlerts: false,
    billingAlertEmail: "",
    apiKeys: {
      azureSpeechConfigured: false,
      azureTranscribeConfigured: false,
    },
  },
  preferencesByDoctor: {
    default: {
      aiAggressiveness: "conservative",
      autoSuggestEnabled: true,
      defaultVisitType: "follow-up",
      transcriptDisplayLanguage: "en",
      keyboardShortcutsEnabled: true,
      dashboardLayout: "standard",
    },
  },
  codebookExtensions: {
    favoriteCodesByDoctor: {},
    payerFeeSchedules: {
      medicare: {},
      commercial: {},
      medicaid: {},
      "self-pay": {},
    },
    insurancePlans: {
      medicare: {
        key: "medicare",
        name: "Medicare",
        cptCodes: [],
        icdCodes: [],
        reimbursementMultiplier: 1,
      },
      commercial: {
        key: "commercial",
        name: "Commercial",
        cptCodes: [],
        icdCodes: [],
        reimbursementMultiplier: 1.34,
      },
      medicaid: {
        key: "medicaid",
        name: "Medicaid",
        cptCodes: [],
        icdCodes: [],
        reimbursementMultiplier: 0.81,
      },
      "self-pay": {
        key: "self-pay",
        name: "Self Pay",
        cptCodes: [],
        icdCodes: [],
        reimbursementMultiplier: 0.58,
      },
    },
    customRules: [],
    bundlingRules: [],
  },
  hipaa: {
    consentTemplates: [
      {
        id: "default-consent",
        name: "Standard Intake Consent",
        content:
          "I consent to clinical recording and AI-assisted documentation/coding for treatment and billing.",
        updatedAt: new Date().toISOString(),
      },
    ],
    dataRetentionDays: 60,
    roleAccess: {
      attendingDoctor: ["read_all", "write_all", "export"],
      nurse: ["read_transcript", "add_notes"],
      billingStaff: ["read_codes", "read_revenue", "export"],
    },
    phiMasking: {
      maskPatientReferenceInUi: false,
      maskTranscriptInExports: false,
    },
    baaDocuments: [],
    encryptionStatus: {
      atRest: "configured-via-provider",
      inTransit: "tls",
      keyRotationEnabled: false,
    },
  },
  productionReadiness: {
    requiredBaaVendors: ["openai", "azure", "hosting", "logging"],
    vendorBaas: {
      openai: { status: "pending", owner: "", signedAt: "", renewalAt: "", notes: "" },
      azure: { status: "pending", owner: "", signedAt: "", renewalAt: "", notes: "" },
      hosting: { status: "pending", owner: "", signedAt: "", renewalAt: "", notes: "" },
      logging: { status: "pending", owner: "", signedAt: "", renewalAt: "", notes: "" },
    },
    legalReview: {
      status: "pending",
      reviewedBy: "",
      reviewedAt: "",
      nextReviewAt: "",
      notes: "",
    },
    complianceReview: {
      status: "pending",
      reviewedBy: "",
      reviewedAt: "",
      notes: "",
      coderReviewWorkflowEnabled: true,
    },
    securityHardening: {
      iamRbacEnabled: false,
      ssoEnabled: false,
      mfaEnforced: false,
      encryptionAtRestEnabled: true,
      encryptionInTransitEnabled: true,
      keyRotationEnabled: false,
      immutableAuditExportEnabled: false,
      vulnerabilityScanCompleted: false,
      penetrationTestCompleted: false,
    },
    goLive: {
      approved: false,
      approvedBy: "",
      approvedAt: "",
      notes: "",
    },
  },
});

let cached = null;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const readConfig = () => {
  if (cached) return cached;

  if (!fs.existsSync(configPath)) {
    const seed = defaultConfig();
    fs.writeFileSync(configPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    cached = seed;
    return cached;
  }

  try {
    cached = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    cached = defaultConfig();
  }

  return cached;
};

const writeConfig = (nextConfig) => {
  cached = nextConfig;
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
};

const updateRoot = (mutator) => {
  const current = readConfig();
  const next = deepClone(current);
  mutator(next);
  writeConfig(next);
  return next;
};

const sanitizeString = (value) => String(value ?? "").trim();

const sanitizeBoolean = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const sanitizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeDateIso = (value, fallback = "") => {
  const normalized = sanitizeString(value);
  if (!normalized) return fallback;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
};

const normalizeReviewStatus = (value, fallback = "pending") => {
  const normalized = sanitizeString(value).toLowerCase();
  if (["pending", "in_progress", "completed", "blocked"].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

export const getPlatformConfig = () => deepClone(readConfig());

export const getGeneralSettings = () => deepClone(readConfig().general || defaultConfig().general);

export const updateGeneralSettings = (patch = {}) => {
  const updated = updateRoot((config) => {
    const current = config.general || defaultConfig().general;
    config.general = {
      ...current,
      practiceName: sanitizeString(
        patch.practiceName ?? current.practiceName ?? defaultConfig().general.practiceName
      ),
      npiNumber: sanitizeString(patch.npiNumber ?? current.npiNumber),
      address: sanitizeString(patch.address ?? current.address),
      timezone: sanitizeString(patch.timezone ?? current.timezone),
      language: sanitizeString(patch.language ?? current.language),
      emailBillingAlerts: sanitizeBoolean(patch.emailBillingAlerts, current.emailBillingAlerts),
      billingAlertEmail: sanitizeString(patch.billingAlertEmail ?? current.billingAlertEmail),
      apiKeys: {
        ...current.apiKeys,
        azureSpeechConfigured: sanitizeBoolean(
          patch.apiKeys?.azureSpeechConfigured,
          current.apiKeys?.azureSpeechConfigured
        ),
        azureTranscribeConfigured: sanitizeBoolean(
          patch.apiKeys?.azureTranscribeConfigured,
          current.apiKeys?.azureTranscribeConfigured
        ),
      },
    };
  });
  return deepClone(updated.general);
};

export const getDoctorPreferences = (doctorRef = "default") => {
  const config = readConfig();
  const normalized = sanitizeString(doctorRef || "default") || "default";
  const defaults = defaultConfig().preferencesByDoctor.default;
  return deepClone({
    ...defaults,
    ...(config.preferencesByDoctor?.default || {}),
    ...(config.preferencesByDoctor?.[normalized] || {}),
  });
};

export const updateDoctorPreferences = (doctorRef = "default", patch = {}) => {
  const normalized = sanitizeString(doctorRef || "default") || "default";
  const updated = updateRoot((config) => {
    if (!config.preferencesByDoctor) {
      config.preferencesByDoctor = {};
    }
    const base = getDoctorPreferences(normalized);
    config.preferencesByDoctor[normalized] = {
      ...base,
      aiAggressiveness: sanitizeString(patch.aiAggressiveness ?? base.aiAggressiveness),
      autoSuggestEnabled: sanitizeBoolean(patch.autoSuggestEnabled, base.autoSuggestEnabled),
      defaultVisitType: sanitizeString(patch.defaultVisitType ?? base.defaultVisitType),
      transcriptDisplayLanguage: sanitizeString(
        patch.transcriptDisplayLanguage ?? base.transcriptDisplayLanguage
      ),
      keyboardShortcutsEnabled: sanitizeBoolean(
        patch.keyboardShortcutsEnabled,
        base.keyboardShortcutsEnabled
      ),
      dashboardLayout: sanitizeString(patch.dashboardLayout ?? base.dashboardLayout),
    };
  });
  return deepClone(updated.preferencesByDoctor[normalized]);
};

const sanitizeCustomRule = (rule = {}) => ({
  id: sanitizeString(rule.id) || crypto.randomUUID(),
  trigger: sanitizeString(rule.trigger),
  suggestedCode: sanitizeString(rule.suggestedCode).toUpperCase(),
  note: sanitizeString(rule.note),
  updatedAt: new Date().toISOString(),
});

const sanitizeBundlingRule = (rule = {}) => ({
  id: sanitizeString(rule.id) || crypto.randomUUID(),
  primaryCode: sanitizeString(rule.primaryCode).toUpperCase(),
  blockedWithCode: sanitizeString(rule.blockedWithCode).toUpperCase(),
  reason: sanitizeString(rule.reason),
  updatedAt: new Date().toISOString(),
});

const sanitizeInsurancePlanKey = (value = "") =>
  sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");

const sanitizeCodeList = (values = [], matcher = () => true) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => sanitizeString(item).toUpperCase())
        .filter((code) => code && matcher(code))
    )
  );

const sanitizeInsurancePlans = (plans = {}) => {
  const output = {};
  const applyOne = (key, value = {}) => {
    const normalizedKey = sanitizeInsurancePlanKey(key || value?.key || value?.id || value?.name);
    if (!normalizedKey) return;
    const multiplier = Number(value?.reimbursementMultiplier);
    output[normalizedKey] = {
      key: normalizedKey,
      name: sanitizeString(value?.name || value?.displayName || normalizedKey) || normalizedKey,
      cptCodes: sanitizeCodeList(value?.cptCodes || [], (code) => /^\d{5}$/.test(code)),
      icdCodes: sanitizeCodeList(value?.icdCodes || [], (code) =>
        /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code)
      ),
      reimbursementMultiplier:
        Number.isFinite(multiplier) && multiplier > 0 ? Number(multiplier.toFixed(4)) : null,
    };
  };

  if (Array.isArray(plans)) {
    plans.forEach((item) => applyOne(item?.key || item?.id || item?.name, item));
  } else if (plans && typeof plans === "object") {
    for (const [key, value] of Object.entries(plans)) {
      applyOne(key, value || {});
    }
  }

  return output;
};

export const getCodebookExtensions = () =>
  deepClone(readConfig().codebookExtensions || defaultConfig().codebookExtensions);

export const updateCodebookExtensions = (patch = {}) => {
  const updated = updateRoot((config) => {
    const current = config.codebookExtensions || defaultConfig().codebookExtensions;
    config.codebookExtensions = {
      ...current,
      favoriteCodesByDoctor:
        patch.favoriteCodesByDoctor && typeof patch.favoriteCodesByDoctor === "object"
          ? patch.favoriteCodesByDoctor
          : current.favoriteCodesByDoctor,
      payerFeeSchedules:
        patch.payerFeeSchedules && typeof patch.payerFeeSchedules === "object"
          ? patch.payerFeeSchedules
          : current.payerFeeSchedules,
      insurancePlans:
        patch.insurancePlans && typeof patch.insurancePlans === "object"
          ? sanitizeInsurancePlans(patch.insurancePlans)
          : current.insurancePlans || defaultConfig().codebookExtensions.insurancePlans,
      customRules: Array.isArray(patch.customRules)
        ? patch.customRules.map((rule) => sanitizeCustomRule(rule))
        : current.customRules,
      bundlingRules: Array.isArray(patch.bundlingRules)
        ? patch.bundlingRules.map((rule) => sanitizeBundlingRule(rule))
        : current.bundlingRules,
    };
  });

  return deepClone(updated.codebookExtensions);
};

export const getHipaaSettings = () => deepClone(readConfig().hipaa || defaultConfig().hipaa);

export const updateHipaaSettings = (patch = {}) => {
  const updated = updateRoot((config) => {
    const current = config.hipaa || defaultConfig().hipaa;
    config.hipaa = {
      ...current,
      consentTemplates: Array.isArray(patch.consentTemplates)
        ? patch.consentTemplates.map((template) => ({
            id: sanitizeString(template.id) || crypto.randomUUID(),
            name: sanitizeString(template.name),
            content: sanitizeString(template.content),
            updatedAt: new Date().toISOString(),
          }))
        : current.consentTemplates,
      dataRetentionDays:
        patch.dataRetentionDays !== undefined
          ? Math.max(1, sanitizeNumber(patch.dataRetentionDays, current.dataRetentionDays))
          : current.dataRetentionDays,
      roleAccess:
        patch.roleAccess && typeof patch.roleAccess === "object"
          ? patch.roleAccess
          : current.roleAccess,
      phiMasking:
        patch.phiMasking && typeof patch.phiMasking === "object"
          ? {
              ...current.phiMasking,
              ...patch.phiMasking,
            }
          : current.phiMasking,
      baaDocuments: Array.isArray(patch.baaDocuments)
        ? patch.baaDocuments
        : current.baaDocuments || [],
      encryptionStatus:
        patch.encryptionStatus && typeof patch.encryptionStatus === "object"
          ? {
              ...current.encryptionStatus,
              ...patch.encryptionStatus,
            }
          : current.encryptionStatus,
    };
  });
  return deepClone(updated.hipaa);
};

const sanitizeVendorBaaPatch = (current = {}, patch = {}) => ({
  ...current,
  status: normalizeReviewStatus(patch.status, current.status || "pending"),
  owner: sanitizeString(patch.owner ?? current.owner),
  signedAt: sanitizeDateIso(patch.signedAt, current.signedAt || ""),
  renewalAt: sanitizeDateIso(patch.renewalAt, current.renewalAt || ""),
  notes: sanitizeString(patch.notes ?? current.notes),
});

export const getProductionReadinessSettings = () =>
  deepClone(readConfig().productionReadiness || defaultConfig().productionReadiness);

export const updateProductionReadinessSettings = (patch = {}) => {
  const updated = updateRoot((config) => {
    const defaults = defaultConfig().productionReadiness;
    const current = config.productionReadiness || defaults;

    const requiredBaaVendors = Array.isArray(patch.requiredBaaVendors)
      ? patch.requiredBaaVendors
          .map((item) => sanitizeString(item).toLowerCase())
          .filter(Boolean)
      : current.requiredBaaVendors || defaults.requiredBaaVendors;

    const currentVendorBaas = current.vendorBaas || {};
    const patchVendorBaas = patch.vendorBaas && typeof patch.vendorBaas === "object" ? patch.vendorBaas : {};
    const vendorBaas = { ...currentVendorBaas };
    for (const vendor of requiredBaaVendors) {
      vendorBaas[vendor] = sanitizeVendorBaaPatch(
        currentVendorBaas[vendor] || defaults.vendorBaas[vendor] || {},
        patchVendorBaas[vendor] || {}
      );
    }

    const securityPatch =
      patch.securityHardening && typeof patch.securityHardening === "object"
        ? patch.securityHardening
        : {};
    const currentSecurity = current.securityHardening || defaults.securityHardening;

    config.productionReadiness = {
      ...current,
      requiredBaaVendors,
      vendorBaas,
      legalReview: {
        ...(current.legalReview || defaults.legalReview),
        status: normalizeReviewStatus(
          patch.legalReview?.status,
          current.legalReview?.status || defaults.legalReview.status
        ),
        reviewedBy: sanitizeString(
          patch.legalReview?.reviewedBy ??
            current.legalReview?.reviewedBy ??
            defaults.legalReview.reviewedBy
        ),
        reviewedAt: sanitizeDateIso(
          patch.legalReview?.reviewedAt,
          current.legalReview?.reviewedAt || defaults.legalReview.reviewedAt
        ),
        nextReviewAt: sanitizeDateIso(
          patch.legalReview?.nextReviewAt,
          current.legalReview?.nextReviewAt || defaults.legalReview.nextReviewAt
        ),
        notes: sanitizeString(
          patch.legalReview?.notes ?? current.legalReview?.notes ?? defaults.legalReview.notes
        ),
      },
      complianceReview: {
        ...(current.complianceReview || defaults.complianceReview),
        status: normalizeReviewStatus(
          patch.complianceReview?.status,
          current.complianceReview?.status || defaults.complianceReview.status
        ),
        reviewedBy: sanitizeString(
          patch.complianceReview?.reviewedBy ??
            current.complianceReview?.reviewedBy ??
            defaults.complianceReview.reviewedBy
        ),
        reviewedAt: sanitizeDateIso(
          patch.complianceReview?.reviewedAt,
          current.complianceReview?.reviewedAt || defaults.complianceReview.reviewedAt
        ),
        notes: sanitizeString(
          patch.complianceReview?.notes ??
            current.complianceReview?.notes ??
            defaults.complianceReview.notes
        ),
        coderReviewWorkflowEnabled: sanitizeBoolean(
          patch.complianceReview?.coderReviewWorkflowEnabled,
          current.complianceReview?.coderReviewWorkflowEnabled
        ),
      },
      securityHardening: {
        ...currentSecurity,
        iamRbacEnabled: sanitizeBoolean(
          securityPatch.iamRbacEnabled,
          currentSecurity.iamRbacEnabled
        ),
        ssoEnabled: sanitizeBoolean(securityPatch.ssoEnabled, currentSecurity.ssoEnabled),
        mfaEnforced: sanitizeBoolean(securityPatch.mfaEnforced, currentSecurity.mfaEnforced),
        encryptionAtRestEnabled: sanitizeBoolean(
          securityPatch.encryptionAtRestEnabled,
          currentSecurity.encryptionAtRestEnabled
        ),
        encryptionInTransitEnabled: sanitizeBoolean(
          securityPatch.encryptionInTransitEnabled,
          currentSecurity.encryptionInTransitEnabled
        ),
        keyRotationEnabled: sanitizeBoolean(
          securityPatch.keyRotationEnabled,
          currentSecurity.keyRotationEnabled
        ),
        immutableAuditExportEnabled: sanitizeBoolean(
          securityPatch.immutableAuditExportEnabled,
          currentSecurity.immutableAuditExportEnabled
        ),
        vulnerabilityScanCompleted: sanitizeBoolean(
          securityPatch.vulnerabilityScanCompleted,
          currentSecurity.vulnerabilityScanCompleted
        ),
        penetrationTestCompleted: sanitizeBoolean(
          securityPatch.penetrationTestCompleted,
          currentSecurity.penetrationTestCompleted
        ),
      },
      goLive: {
        ...(current.goLive || defaults.goLive),
        approved: sanitizeBoolean(
          patch.goLive?.approved,
          current.goLive?.approved ?? defaults.goLive.approved
        ),
        approvedBy: sanitizeString(
          patch.goLive?.approvedBy ?? current.goLive?.approvedBy ?? defaults.goLive.approvedBy
        ),
        approvedAt: sanitizeDateIso(
          patch.goLive?.approvedAt,
          current.goLive?.approvedAt || defaults.goLive.approvedAt
        ),
        notes: sanitizeString(
          patch.goLive?.notes ?? current.goLive?.notes ?? defaults.goLive.notes
        ),
      },
    };
  });

  return deepClone(updated.productionReadiness);
};

export const addBaaDocument = (document = {}) => {
  const vendor = sanitizeString(document.vendor || "unknown").toLowerCase();
  const entry = {
    id: crypto.randomUUID(),
    name: sanitizeString(document.name),
    vendor,
    agreementType: sanitizeString(document.agreementType || "BAA"),
    path: sanitizeString(document.path),
    uploadedBy: sanitizeString(document.uploadedBy || "system"),
    uploadedAt: new Date().toISOString(),
  };

  const updated = updateRoot((config) => {
    if (!config.hipaa) {
      config.hipaa = defaultConfig().hipaa;
    }
    const existing = Array.isArray(config.hipaa.baaDocuments) ? config.hipaa.baaDocuments : [];
    config.hipaa.baaDocuments = [entry, ...existing].slice(0, 200);

    if (!config.productionReadiness) {
      config.productionReadiness = defaultConfig().productionReadiness;
    }

    const vendorBaas = config.productionReadiness.vendorBaas || {};
    const currentVendorState = vendorBaas[vendor] || { status: "pending" };
    vendorBaas[vendor] = {
      ...currentVendorState,
      status: "completed",
      signedAt: currentVendorState.signedAt || entry.uploadedAt,
    };
    config.productionReadiness.vendorBaas = vendorBaas;

    const required = Array.isArray(config.productionReadiness.requiredBaaVendors)
      ? config.productionReadiness.requiredBaaVendors
      : [];
    if (vendor !== "unknown" && !required.includes(vendor)) {
      config.productionReadiness.requiredBaaVendors = [...required, vendor];
    }
  });

  return {
    entry: deepClone(entry),
    hipaa: deepClone(updated.hipaa),
  };
};
