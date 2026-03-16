import { env, featureFlags } from "../config/env.js";
import { getCodebookStatus } from "./codebook-service.js";
import { getHipaaSettings, getProductionReadinessSettings } from "./platform-config-service.js";

const toBooleanCheck = ({ id, label, value, blockerIfFalse = true, notes = "" }) => ({
  id,
  label,
  status: value ? "pass" : blockerIfFalse ? "fail" : "warn",
  notes,
});

const toStatusCheck = ({ id, label, statusValue, notes = "" }) => {
  const normalized = String(statusValue || "pending").toLowerCase();
  if (normalized === "completed") {
    return { id, label, status: "pass", notes };
  }
  if (normalized === "in_progress") {
    return { id, label, status: "warn", notes };
  }
  return { id, label, status: "fail", notes };
};

const buildBaaChecks = ({ settings, hipaa }) => {
  const required = Array.isArray(settings.requiredBaaVendors)
    ? settings.requiredBaaVendors
    : [];
  const documents = Array.isArray(hipaa?.baaDocuments) ? hipaa.baaDocuments : [];
  const vendorBaas = settings.vendorBaas || {};

  return required.map((vendor) => {
    const vendorId = String(vendor || "").toLowerCase();
    const vendorState = vendorBaas[vendorId] || { status: "pending" };
    const hasDocument = documents.some(
      (doc) => String(doc.vendor || "").toLowerCase() === vendorId
    );
    const completed = vendorState.status === "completed" && hasDocument;
    return toBooleanCheck({
      id: `baa_${vendorId}`,
      label: `BAA signed: ${vendorId}`,
      value: completed,
      notes: hasDocument
        ? "Document uploaded and status tracked."
        : "No vendor-specific BAA document uploaded.",
    });
  });
};

const summarize = (checks = []) => {
  const total = checks.length || 1;
  const passed = checks.filter((item) => item.status === "pass").length;
  const failed = checks.filter((item) => item.status === "fail").length;
  const warned = checks.filter((item) => item.status === "warn").length;
  return {
    total,
    passed,
    warned,
    failed,
    score: Math.round((passed / total) * 100),
    blockerCount: failed,
  };
};

export const buildProductionReadinessStatus = () => {
  const settings = getProductionReadinessSettings();
  const hipaa = getHipaaSettings();
  const codebook = getCodebookStatus();

  const baaChecks = buildBaaChecks({ settings, hipaa });
  const security = settings.securityHardening || {};

  const legalCheck = toStatusCheck({
    id: "legal_review",
    label: "Formal legal review",
    statusValue: settings.legalReview?.status,
    notes: settings.legalReview?.reviewedBy
      ? `Reviewed by ${settings.legalReview.reviewedBy}`
      : "No legal reviewer recorded.",
  });

  const complianceCheck = toStatusCheck({
    id: "compliance_review",
    label: "Compliance review",
    statusValue: settings.complianceReview?.status,
    notes: settings.complianceReview?.reviewedBy
      ? `Reviewed by ${settings.complianceReview.reviewedBy}`
      : "No compliance reviewer recorded.",
  });

  const securityChecks = [
    toBooleanCheck({
      id: "security_rbac",
      label: "RBAC enabled",
      value: Boolean(security.iamRbacEnabled),
    }),
    toBooleanCheck({
      id: "security_sso_mfa",
      label: "SSO + MFA enforced",
      value: Boolean(security.ssoEnabled && security.mfaEnforced),
    }),
    toBooleanCheck({
      id: "security_key_rotation",
      label: "Encryption key rotation enabled",
      value: Boolean(security.keyRotationEnabled),
    }),
    toBooleanCheck({
      id: "security_immutable_audit",
      label: "Immutable audit export/SIEM enabled",
      value: Boolean(security.immutableAuditExportEnabled),
    }),
    toBooleanCheck({
      id: "security_vuln_scan",
      label: "Vulnerability scan completed",
      value: Boolean(security.vulnerabilityScanCompleted),
    }),
    toBooleanCheck({
      id: "security_pen_test",
      label: "Penetration test completed",
      value: Boolean(security.penetrationTestCompleted),
    }),
    toBooleanCheck({
      id: "security_api_key",
      label: "API key auth enabled",
      value: Boolean(env.requireApiKey && featureFlags.hasApiKeyConfigured),
    }),
    toBooleanCheck({
      id: "security_cors_allowlist",
      label: "CORS allowlist configured",
      value: featureFlags.corsAllowlistEnabled,
    }),
    toBooleanCheck({
      id: "security_rate_limit",
      label: "API rate limiting enabled",
      value: env.rateLimitEnabled,
      blockerIfFalse: false,
    }),
  ];

  const operationalChecks = [
    toBooleanCheck({
      id: "codebook_freshness",
      label: "Codebook freshness in policy",
      value: !codebook.isStale,
      blockerIfFalse: false,
      notes: codebook.isStale ? "Codebook update required soon." : "Codebook freshness acceptable.",
    }),
    toBooleanCheck({
      id: "coder_review_workflow",
      label: "Coder review workflow active",
      value: Boolean(settings.complianceReview?.coderReviewWorkflowEnabled),
    }),
  ];

  const checks = [legalCheck, complianceCheck, ...baaChecks, ...securityChecks, ...operationalChecks];
  const summary = summarize(checks);
  const blockers = checks
    .filter((item) => item.status === "fail")
    .map((item) => ({ id: item.id, label: item.label, notes: item.notes }));
  const warnings = checks
    .filter((item) => item.status === "warn")
    .map((item) => ({ id: item.id, label: item.label, notes: item.notes }));

  const readyForProduction = summary.blockerCount === 0 && Boolean(settings.goLive?.approved);

  return {
    generatedAt: new Date().toISOString(),
    readyForProduction,
    summary,
    blockers,
    warnings,
    checks,
    approvals: {
      legalReview: settings.legalReview || {},
      complianceReview: settings.complianceReview || {},
      goLive: settings.goLive || {},
    },
  };
};
