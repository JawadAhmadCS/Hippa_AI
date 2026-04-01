const state = {
  auth: {
    token: "",
    user: null,
    challengeId: "",
    availableFactors: ["totp"],
    preferredFactor: "totp",
  },
  appointment: null,
  selectedPatientProfile: null,
  mediaRecorder: null,
  recordingChunks: [],
  micStream: null,
  speechRecognizer: null,
  browserRecognizer: null,
  encounterActive: false,
  lastTranscriptNormalized: "",
  lastTranscriptAt: 0,
  lastServerTranscriptCount: 0,
  interimTranscriptText: "",
  backgroundTranscriptSegments: [],
  chartNotes: [],
  lastAssistantMessage: "",
  lastThrottleLogAt: 0,
  suggestionStream: null,
  currentView: "live",
  allowedViews: ["live"],
  loadedViewData: {
    past: false,
    billing: false,
    revenue: false,
    settings: false,
    hipaa: false,
    codebook: false,
  },
  noteEditor: {
    loaded: false,
    note: null,
    codingAnalysis: null,
    autosaveTimer: null,
    finalEditorTouched: false,
  },
  billing: {
    queue: [],
    selectedAppointmentId: "",
  },
  security2fa: {
    settings: null,
    setup: null,
  },
  selectedPastEncounterId: "",
  reportFilters: {
    granularity: "daily",
    dateFrom: "",
    dateTo: "",
  },
  codebook: {
    meta: null,
    codes: [],
    filteredCodes: [],
    selectedCode: null,
    extensions: {
      favoriteCodesByDoctor: {},
      payerFeeSchedules: {},
      customRules: [],
      bundlingRules: [],
    },
  },
  hipaa: {
    settings: null,
  },
  clientLandingId: "",
  clientLandingName: "",
};

const ui = {
  authOverlay: document.getElementById("authOverlay"),
  authUsername: document.getElementById("authUsername"),
  authPassword: document.getElementById("authPassword"),
  authPasswordBtn: document.getElementById("authPasswordBtn"),
  auth2faBlock: document.getElementById("auth2faBlock"),
  authTotpCode: document.getElementById("authTotpCode"),
  auth2faBtn: document.getElementById("auth2faBtn"),
  authSetupHint: document.getElementById("authSetupHint"),
  authSetupSecret: document.getElementById("authSetupSecret"),
  authErrorText: document.getElementById("authErrorText"),
  authUserPill: document.getElementById("authUserPill"),
  authUserText: document.getElementById("authUserText"),
  logoutBtn: document.getElementById("logoutBtn"),
  sidebarDoctorName: document.getElementById("sidebarDoctorName"),
  sidebarDoctorRole: document.getElementById("sidebarDoctorRole"),
  patientRef: document.getElementById("patientRef"),
  patientLookupBtn: document.getElementById("patientLookupBtn"),
  patientChartOptions: document.getElementById("patientChartOptions"),
  patientHeaderFirstName: document.getElementById("patientHeaderFirstName"),
  patientHeaderLastName: document.getElementById("patientHeaderLastName"),
  patientHeaderDob: document.getElementById("patientHeaderDob"),
  patientHeaderInsurance: document.getElementById("patientHeaderInsurance"),
  consentFormId: document.getElementById("consentFormId"),
  insurancePlan: document.getElementById("insurancePlan"),
  visitType: document.getElementById("visitType"),
  encounterMode: document.getElementById("encounterMode"),
  telehealthPlatform: document.getElementById("telehealthPlatform"),
  recordingRetentionHint: document.getElementById("recordingRetentionHint"),
  consentGiven: document.getElementById("consentGiven"),
  consentBadge: document.getElementById("consentBadge"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  transcriptFeed: document.getElementById("transcriptFeed"),
  chatFeed: document.getElementById("chatFeed"),
  suggestionList: document.getElementById("suggestionList"),
  currentEstimatedRevenue: document.getElementById("currentEstimatedRevenue"),
  potentialEstimatedRevenue: document.getElementById("potentialEstimatedRevenue"),
  guidanceList: document.getElementById("guidanceList"),
  billableCodesList: document.getElementById("billableCodesList"),
  billableCount: document.getElementById("billableCount"),
  cptBadge: document.getElementById("cptBadge"),
  txBadge: document.getElementById("txBadge"),
  noteStatusBadge: document.getElementById("noteStatusBadge"),
  noteAnalysisStatus: document.getElementById("noteAnalysisStatus"),
  noteHpiEditor: document.getElementById("noteHpiEditor"),
  noteRosEditor: document.getElementById("noteRosEditor"),
  noteExamEditor: document.getElementById("noteExamEditor"),
  noteAssessmentEditor: document.getElementById("noteAssessmentEditor"),
  notePlanEditor: document.getElementById("notePlanEditor"),
  manualDoctorNotesInput: document.getElementById("manualDoctorNotesInput"),
  noteFinalMergedEditor: document.getElementById("noteFinalMergedEditor"),
  noteMergeStatus: document.getElementById("noteMergeStatus"),
  noteFinalStatus: document.getElementById("noteFinalStatus"),
  recalculateNoteBtn: document.getElementById("recalculateNoteBtn"),
  saveNoteDraftBtn: document.getElementById("saveNoteDraftBtn"),
  finalizeNoteBtn: document.getElementById("finalizeNoteBtn"),
  noteCptList: document.getElementById("noteCptList"),
  noteIcdList: document.getElementById("noteIcdList"),
  noteJustificationText: document.getElementById("noteJustificationText"),
  noteMissingPrompts: document.getElementById("noteMissingPrompts"),
  noteVersionList: document.getElementById("noteVersionList"),
  noteFinalCodesInput: document.getElementById("noteFinalCodesInput"),
  overrideReasonInput: document.getElementById("overrideReasonInput"),
  guidanceBadge: document.getElementById("guidanceBadge"),
  eventLog: document.getElementById("eventLog"),
  sessionBadge: document.getElementById("sessionBadge"),
  sessionStatus: document.getElementById("sessionStatus"),
  sessionText: document.getElementById("sessionText"),
  waveform: document.getElementById("waveform"),
  currentViewLabel: document.getElementById("currentViewLabel"),
  navItems: Array.from(document.querySelectorAll(".nav-item[data-view]")),
  viewPanels: Array.from(document.querySelectorAll(".view-panel")),
  pastEncountersSummary: document.getElementById("pastEncountersSummary"),
  pastEncountersBody: document.getElementById("pastEncountersBody"),
  refreshPastBtn: document.getElementById("refreshPastBtn"),
  pastSearchInput: document.getElementById("pastSearchInput"),
  pastDateFrom: document.getElementById("pastDateFrom"),
  pastDateTo: document.getElementById("pastDateTo"),
  applyPastFiltersBtn: document.getElementById("applyPastFiltersBtn"),
  billingQueueSummary: document.getElementById("billingQueueSummary"),
  refreshBillingQueueBtn: document.getElementById("refreshBillingQueueBtn"),
  billingQueueBody: document.getElementById("billingQueueBody"),
  billingExpectedRevenue: document.getElementById("billingExpectedRevenue"),
  billingPatientChartPreview: document.getElementById("billingPatientChartPreview"),
  billingFinalNotePreview: document.getElementById("billingFinalNotePreview"),
  billingTranscriptPreview: document.getElementById("billingTranscriptPreview"),
  billingAudioPreview: document.getElementById("billingAudioPreview"),
  billingRecommendedCpt: document.getElementById("billingRecommendedCpt"),
  billingRecommendedIcd: document.getElementById("billingRecommendedIcd"),
  billingApprovedCodes: document.getElementById("billingApprovedCodes"),
  billingCodeEvidence: document.getElementById("billingCodeEvidence"),
  pastAuditSummary: document.getElementById("pastAuditSummary"),
  pastEncounterAuditList: document.getElementById("pastEncounterAuditList"),
  pastEncounterDataSummary: document.getElementById("pastEncounterDataSummary"),
  pastEncounterDataBody: document.getElementById("pastEncounterDataBody"),
  reportGeneratedAt: document.getElementById("reportGeneratedAt"),
  reportGranularity: document.getElementById("reportGranularity"),
  reportDateFrom: document.getElementById("reportDateFrom"),
  reportDateTo: document.getElementById("reportDateTo"),
  applyReportFiltersBtn: document.getElementById("applyReportFiltersBtn"),
  exportRevenueCsvBtn: document.getElementById("exportRevenueCsvBtn"),
  reportTotalEncounters: document.getElementById("reportTotalEncounters"),
  reportConsentedEncounters: document.getElementById("reportConsentedEncounters"),
  reportTotalProjected: document.getElementById("reportTotalProjected"),
  reportTotalEarned: document.getElementById("reportTotalEarned"),
  reportAvgProjected: document.getElementById("reportAvgProjected"),
  reportTrendChart: document.getElementById("reportTrendChart"),
  reportByInsuranceBody: document.getElementById("reportByInsuranceBody"),
  reportByVisitTypeBody: document.getElementById("reportByVisitTypeBody"),
  reportCptFrequencyBody: document.getElementById("reportCptFrequencyBody"),
  reportMissedOpportunityBody: document.getElementById("reportMissedOpportunityBody"),
  refreshRevenueBtn: document.getElementById("refreshRevenueBtn"),
  settingsSummary: document.getElementById("settingsSummary"),
  settingsPracticeName: document.getElementById("settingsPracticeName"),
  settingsNpiNumber: document.getElementById("settingsNpiNumber"),
  settingsTimezone: document.getElementById("settingsTimezone"),
  settingsLanguage: document.getElementById("settingsLanguage"),
  settingsAddress: document.getElementById("settingsAddress"),
  settingsBillingEmail: document.getElementById("settingsBillingEmail"),
  settingsEmailAlerts: document.getElementById("settingsEmailAlerts"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  settingsSavedAt: document.getElementById("settingsSavedAt"),
  settings2faStatus: document.getElementById("settings2faStatus"),
  settings2faEnabled: document.getElementById("settings2faEnabled"),
  settings2faSmsEnabled: document.getElementById("settings2faSmsEnabled"),
  save2faSettingsBtn: document.getElementById("save2faSettingsBtn"),
  settings2faSavedAt: document.getElementById("settings2faSavedAt"),
  settings2faSetupHint: document.getElementById("settings2faSetupHint"),
  settings2faSetupBtn: document.getElementById("settings2faSetupBtn"),
  settings2faSetupSecret: document.getElementById("settings2faSetupSecret"),
  settings2faSetupQr: document.getElementById("settings2faSetupQr"),
  settings2faSetupCode: document.getElementById("settings2faSetupCode"),
  settings2faVerifyBtn: document.getElementById("settings2faVerifyBtn"),
  jumpViewButtons: Array.from(document.querySelectorAll("[data-jump-view]")),
  prefDoctorRef: document.getElementById("prefDoctorRef"),
  prefDefaultView: document.getElementById("prefDefaultView"),
  prefAiAggressiveness: document.getElementById("prefAiAggressiveness"),
  prefDefaultVisitType: document.getElementById("prefDefaultVisitType"),
  prefTranscriptLanguage: document.getElementById("prefTranscriptLanguage"),
  prefDashboardLayout: document.getElementById("prefDashboardLayout"),
  prefAutoOpenPast: document.getElementById("prefAutoOpenPast"),
  prefAutoRefreshReports: document.getElementById("prefAutoRefreshReports"),
  prefAutoSuggestEnabled: document.getElementById("prefAutoSuggestEnabled"),
  prefKeyboardShortcuts: document.getElementById("prefKeyboardShortcuts"),
  prefCompactTables: document.getElementById("prefCompactTables"),
  savePreferencesBtn: document.getElementById("savePreferencesBtn"),
  loadPreferencesBtn: document.getElementById("loadPreferencesBtn"),
  preferencesStatus: document.getElementById("preferencesStatus"),
  preferencesSavedAt: document.getElementById("preferencesSavedAt"),
  hipaaSettingsContent: document.getElementById("hipaaSettingsContent"),
  refreshHipaaBtn: document.getElementById("refreshHipaaBtn"),
  codebookMeta: document.getElementById("codebookMeta"),
  codebookSearchInput: document.getElementById("codebookSearchInput"),
  refreshCodebookBtn: document.getElementById("refreshCodebookBtn"),
  codebookTableBody: document.getElementById("codebookTableBody"),
  codebookEditorState: document.getElementById("codebookEditorState"),
  codebookEditCode: document.getElementById("codebookEditCode"),
  codebookEditRate: document.getElementById("codebookEditRate"),
  codebookEditTitle: document.getElementById("codebookEditTitle"),
  codebookEditDocumentation: document.getElementById("codebookEditDocumentation"),
  codebookEditCompliance: document.getElementById("codebookEditCompliance"),
  saveCodebookBtn: document.getElementById("saveCodebookBtn"),
  codebookFavoriteDoctorRef: document.getElementById("codebookFavoriteDoctorRef"),
  codebookFavoriteCodes: document.getElementById("codebookFavoriteCodes"),
  codebookPayerScheduleJson: document.getElementById("codebookPayerScheduleJson"),
  saveCodebookExtensionsBtn: document.getElementById("saveCodebookExtensionsBtn"),
  codebookExtensionsStatus: document.getElementById("codebookExtensionsStatus"),
  codebookRuleTrigger: document.getElementById("codebookRuleTrigger"),
  codebookRuleCode: document.getElementById("codebookRuleCode"),
  codebookRuleNote: document.getElementById("codebookRuleNote"),
  addCustomRuleBtn: document.getElementById("addCustomRuleBtn"),
  codebookBundlePrimary: document.getElementById("codebookBundlePrimary"),
  codebookBundleBlocked: document.getElementById("codebookBundleBlocked"),
  codebookBundleReason: document.getElementById("codebookBundleReason"),
  addBundlingRuleBtn: document.getElementById("addBundlingRuleBtn"),
  customRulesList: document.getElementById("customRulesList"),
  bundlingRulesList: document.getElementById("bundlingRulesList"),
  hipaaTemplateName: document.getElementById("hipaaTemplateName"),
  hipaaTemplateContent: document.getElementById("hipaaTemplateContent"),
  hipaaRetentionDays: document.getElementById("hipaaRetentionDays"),
  saveHipaaSettingsBtn: document.getElementById("saveHipaaSettingsBtn"),
  hipaaTemplatesList: document.getElementById("hipaaTemplatesList"),
  hipaaRoleAccessJson: document.getElementById("hipaaRoleAccessJson"),
  hipaaMaskPatientRef: document.getElementById("hipaaMaskPatientRef"),
  hipaaMaskTranscriptExport: document.getElementById("hipaaMaskTranscriptExport"),
  saveHipaaAccessBtn: document.getElementById("saveHipaaAccessBtn"),
  hipaaEncryptionStatus: document.getElementById("hipaaEncryptionStatus"),
  hipaaBaaUploader: document.getElementById("hipaaBaaUploader"),
  hipaaBaaFile: document.getElementById("hipaaBaaFile"),
  uploadBaaBtn: document.getElementById("uploadBaaBtn"),
  hipaaBaaDocsList: document.getElementById("hipaaBaaDocsList"),
  hipaaAuditDoctorFilter: document.getElementById("hipaaAuditDoctorFilter"),
  refreshAuditLogsBtn: document.getElementById("refreshAuditLogsBtn"),
  hipaaAuditLogList: document.getElementById("hipaaAuditLogList"),
  evidenceDrawer: document.getElementById("transcriptEvidenceDrawer"),
  evidenceBackdrop: document.getElementById("transcriptEvidenceBackdrop"),
  evidenceCloseBtn: document.getElementById("transcriptEvidenceClose"),
  evidenceTitle: document.getElementById("transcriptEvidenceTitle"),
  evidenceSubtitle: document.getElementById("transcriptEvidenceSubtitle"),
  evidenceBody: document.getElementById("transcriptEvidenceBody"),
  authFactorMethod: document.getElementById("authFactorMethod"),
  authSendSmsBtn: document.getElementById("authSendSmsBtn"),
  authSmsHint: document.getElementById("authSmsHint"),
  authSetupQr: document.getElementById("authSetupQr"),
  authPortalLabel: document.getElementById("authPortalLabel"),
  brandName: document.getElementById("brandName"),
  brandBreadcrumb: document.getElementById("brandBreadcrumb"),
};

const safeNumber = (value) => Number(value || 0).toFixed(2);
const PREFS_KEY = "mari.preferences.v1";
const AUTH_TOKEN_KEY = "mari.auth.token.v1";
const viewTitles = {
  live: "Live Encounter",
  past: "Past Encounters",
  billing: "Billing Queue",
  revenue: "Revenue Reports",
  settings: "Settings",
  codebook: "CPT Codebook",
  preferences: "Preferences",
  hipaa: "HIPAA Settings",
};
const defaultPrefs = {
  doctorRef: "default",
  defaultView: "live",
  aiAggressiveness: "conservative",
  autoSuggestEnabled: true,
  defaultVisitType: "follow-up",
  transcriptDisplayLanguage: "en",
  keyboardShortcutsEnabled: true,
  dashboardLayout: "standard",
  autoOpenPastAfterStop: false,
  autoRefreshReports: true,
  compactTables: false,
};

const toTitle = (value) =>
  String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const splitPatientName = (value = "") => {
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

const toInsuranceLabel = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getClientLandingContext = () => {
  const pathParts = String(window.location.pathname || "/")
    .split("/")
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean);
  if (pathParts.length >= 2 && (pathParts[0] === "c" || pathParts[0] === "clinic")) {
    const clientId = pathParts[1];
    return {
      clientId,
      clientName: toTitle(clientId),
    };
  }
  return {
    clientId: "",
    clientName: "",
  };
};

const applyClientLandingContext = () => {
  const context = getClientLandingContext();
  state.clientLandingId = context.clientId;
  state.clientLandingName = context.clientName;
  if (context.clientName) {
    const branded = `${context.clientName} Revenue Copilot`;
    if (ui.brandName) ui.brandName.textContent = branded;
    if (ui.brandBreadcrumb) ui.brandBreadcrumb.textContent = branded;
    document.title = branded;
  }
  if (ui.authPortalLabel) {
    ui.authPortalLabel.textContent = context.clientId
      ? `Clinic portal: ${context.clientName} (${context.clientId})`
      : "Clinic portal: all clients";
  }
};

const formatCurrency = (value) => `$${safeNumber(value)}`;

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const formatDateOnly = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const looksLikeCptCode = (value) => /^\d{5}$/.test(normalizeCode(value));
const looksLikeIcd10Code = (value) =>
  /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(normalizeCode(value));
const uniqueCodes = (values = []) => {
  const seen = new Set();
  const out = [];
  for (const item of values) {
    const normalized = normalizeCode(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const setTextContent = (element, value) => {
  if (!element) return;
  const normalized = String(value || "").trim();
  element.textContent = normalized || "-";
};

const normalizePatientProfile = (profile = {}, fallbackRef = "") => {
  const fullName = String(
    profile?.fullName || [profile?.firstName, profile?.lastName].filter(Boolean).join(" ")
  )
    .trim();
  const split = splitPatientName(fullName);
  const firstName = String(profile?.firstName || split.firstName || "").trim();
  const lastName = String(profile?.lastName || split.lastName || "").trim();
  return {
    patientRef: String(profile?.patientRef || fallbackRef || "")
      .trim()
      .toUpperCase(),
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" ").trim(),
    firstName,
    lastName,
    dob: String(profile?.dob || "").trim(),
    insuranceInfo: String(profile?.insuranceInfo || "").trim(),
    externalChartId: String(profile?.externalChartId || "").trim(),
  };
};

const renderPatientHeader = ({ patientProfile = null, insurancePlan = "" } = {}) => {
  const normalized = normalizePatientProfile(patientProfile || {}, ui.patientRef?.value || "");
  const insuranceLabel = normalized.insuranceInfo
    ? toInsuranceLabel(normalized.insuranceInfo)
    : toInsuranceLabel(insurancePlan);
  setTextContent(ui.patientHeaderFirstName, normalized.firstName || "-");
  setTextContent(ui.patientHeaderLastName, normalized.lastName || "-");
  setTextContent(ui.patientHeaderDob, normalized.dob ? formatDateOnly(normalized.dob) : "-");
  setTextContent(ui.patientHeaderInsurance, insuranceLabel || "-");
};

const renderSidebarDoctorIdentity = () => {
  const user = state.auth.user;
  if (!user) {
    setTextContent(ui.sidebarDoctorName, "Not signed in");
    setTextContent(ui.sidebarDoctorRole, "User");
    return;
  }
  const display = String(user.displayName || user.username || "").trim() || "Doctor";
  const role = String(user.role || "").trim();
  const roleLabel =
    role === "provider"
      ? "Attending Physician"
      : role === "billing"
        ? "Billing Team"
        : role === "admin"
          ? "Administrator"
          : toTitle(role || "User");
  setTextContent(ui.sidebarDoctorName, display);
  setTextContent(ui.sidebarDoctorRole, roleLabel);
};

const readPreferences = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw);
    return {
      ...defaultPrefs,
      ...(parsed || {}),
    };
  } catch {
    return { ...defaultPrefs };
  }
};

const writePreferences = (prefs) => {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

const readAuthToken = () => String(localStorage.getItem(AUTH_TOKEN_KEY) || "").trim();
const writeAuthToken = (token) => {
  const normalized = String(token || "").trim();
  state.auth.token = normalized;
  if (normalized) {
    localStorage.setItem(AUTH_TOKEN_KEY, normalized);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

const clearAuthState = () => {
  state.auth.user = null;
  state.auth.challengeId = "";
  state.auth.availableFactors = ["totp"];
  state.auth.preferredFactor = "totp";
  state.appointment = null;
  state.selectedPatientProfile = null;
  state.noteEditor.finalEditorTouched = false;
  renderPatientHeader({ patientProfile: null, insurancePlan: ui.insurancePlan?.value || "" });
  writeAuthToken("");
};

const setAuthOverlayOpen = (open) => {
  ui.authOverlay?.classList.toggle("open", Boolean(open));
};

const setAuthUserUi = () => {
  const user = state.auth.user;
  if (ui.authUserText) {
    ui.authUserText.textContent = user
      ? `${user.displayName || user.username} (${user.role})${user.clientName ? ` - ${user.clientName}` : ""}`
      : "Not signed in";
  }
  if (ui.authUserPill) {
    ui.authUserPill.classList.toggle("live", Boolean(user));
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.disabled = !user;
  }
  renderSidebarDoctorIdentity();
};

const applyUserContextToEncounterForm = () => {
  const user = state.auth.user;
  if (!user) return;
  if (ui.prefDoctorRef && !ui.prefDoctorRef.value.trim()) {
    ui.prefDoctorRef.value = String(user.username || "default").trim() || "default";
  }
  if (ui.authPortalLabel && (user.clientId || state.clientLandingId)) {
    const clientId = String(user.clientId || state.clientLandingId || "").trim();
    const clientName = String(user.clientName || state.clientLandingName || "").trim();
    ui.authPortalLabel.textContent = clientId
      ? `Clinic portal: ${clientName || toTitle(clientId)} (${clientId})`
      : ui.authPortalLabel.textContent;
  }
};

const setAuthError = (text) => {
  if (!ui.authErrorText) return;
  ui.authErrorText.textContent = String(text || "").trim();
};

const getRoleAllowedViews = (role) => {
  if (role === "billing") return ["billing"];
  if (role === "provider" || role === "admin") {
    return ["live", "past", "billing", "revenue", "settings", "codebook", "preferences", "hipaa"];
  }
  return [];
};

const applyRoleViewAccess = () => {
  const role = state.auth.user?.role || "";
  const allowed = getRoleAllowedViews(role);
  state.allowedViews = allowed;

  for (const item of ui.navItems) {
    const visible = allowed.includes(item.dataset.view);
    item.style.display = visible ? "" : "none";
  }

  if (!allowed.includes(state.currentView)) {
    state.currentView = allowed[0] || "live";
  }
};

const resetLoadedViews = () => {
  for (const key of Object.keys(state.loadedViewData)) {
    state.loadedViewData[key] = false;
  }
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const addLog = (line, level = "info") => {
  if (!ui.eventLog) {
    const fn = level === "warn" ? console.warn : console.log;
    fn(line);
    return;
  }

  const at = new Date().toLocaleTimeString();
  const node = document.createElement("div");
  node.className = `log-entry ${level}`;
  node.innerHTML = `<span class="ts">${at}</span>${escapeHtml(line)}`;
  ui.eventLog.prepend(node);
};

const removeEmptyStates = (container) => {
  if (!container) return;
  container.querySelectorAll(".empty, .empty-state").forEach((node) => node.remove());
};

const emptyStateHtml = (text) =>
  `<div class="empty-state empty"><p>${escapeHtml(text)}</p></div>`;

const parsePriority = (priority) => {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") return "CLINICAL PRIORITY";
  if (normalized === "low") return "FOLLOW-UP";
  return "DOCTOR PROMPT";
};

const setConsentBadgeState = () => {
  if (!ui.consentBadge || !ui.consentGiven) return;
  if (ui.consentGiven.checked) {
    ui.consentBadge.textContent = "Signed";
    ui.consentBadge.classList.add("signed");
    return;
  }
  ui.consentBadge.textContent = "Required";
  ui.consentBadge.classList.remove("signed");
};

const setRecordingRetentionHint = (days = 60) => {
  if (!ui.recordingRetentionHint) return;
  const normalizedDays = Math.max(1, Number(days) || 60);
  ui.recordingRetentionHint.textContent =
    `HIPAA-FIRST | DOCTOR-ONLY WORKSPACE | Recording retention: ${normalizedDays} days`;
};

const syncEncounterModeUi = () => {
  const mode = String(ui.encounterMode?.value || "in-person").trim().toLowerCase();
  if (!ui.telehealthPlatform) return;
  if (mode === "telehealth") {
    ui.telehealthPlatform.disabled = false;
    if (!String(ui.telehealthPlatform.value || "").trim()) {
      ui.telehealthPlatform.value = "zoom";
    }
    return;
  }
  ui.telehealthPlatform.value = "";
  ui.telehealthPlatform.disabled = true;
};

const setTranscriptBadge = (text, active = false) => {
  if (!ui.txBadge) return;
  ui.txBadge.textContent = text;
  ui.txBadge.classList.toggle("active", Boolean(active));
};

const setSessionUiState = ({ active, text }) => {
  if (ui.sessionBadge) {
    ui.sessionBadge.textContent = text;
    ui.sessionBadge.classList.toggle("active", Boolean(active));
  }

  if (ui.sessionText) {
    ui.sessionText.textContent = text;
  }

  if (ui.sessionStatus) {
    ui.sessionStatus.classList.toggle("live", Boolean(active));
  }
};

const closeSuggestionStream = () => {
  if (!state.suggestionStream) return;
  state.suggestionStream.close();
  state.suggestionStream = null;
};

const evidencePalette = ["#2563eb", "#059669", "#d97706", "#db2777", "#0f766e", "#7c3aed"];

const hashText = (value) =>
  String(value || "")
    .split("")
    .reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);

const getEvidenceKey = (prefix, item = {}) =>
  [
    prefix,
    item.code,
    item.text,
    item.prompt,
    item.potentialCode,
    item.id,
    item.sourceType,
  ]
    .filter(Boolean)
    .join(":");

const getEvidenceColor = (key) => evidencePalette[hashText(key) % evidencePalette.length];

const getSortedTranscriptSegments = () =>
  [...state.backgroundTranscriptSegments].sort(
    (left, right) =>
      Number(left.sequence || 0) - Number(right.sequence || 0) ||
      new Date(left.at || 0).getTime() - new Date(right.at || 0).getTime()
  );

const storeTranscriptSegment = (segment) => {
  const segmentId = String(segment?.id || "").trim();
  if (!segmentId) return;

  const nextSegment = {
    id: segmentId,
    sequence: Number(segment?.sequence || 0),
    at: segment?.at || new Date().toISOString(),
    source: String(segment?.source || "transcript").trim(),
    rawText: String(segment?.rawText || "").trim(),
    cleanedText: String(segment?.cleanedText || segment?.rawText || "").trim(),
    quality: segment?.quality || null,
  };

  const existingIndex = state.backgroundTranscriptSegments.findIndex((item) => item.id === segmentId);
  if (existingIndex >= 0) {
    state.backgroundTranscriptSegments.splice(existingIndex, 1, nextSegment);
    return;
  }

  state.backgroundTranscriptSegments.push(nextSegment);
};

const closeEvidenceDrawer = () => {
  ui.evidenceDrawer?.classList.remove("open");
  ui.evidenceBackdrop?.classList.remove("open");
};

const openEvidenceDrawer = ({ title, subtitle = "", refs = [], evidenceKey = "" }) => {
  if (!ui.evidenceDrawer || !ui.evidenceBody) return;

  const transcript = getSortedTranscriptSegments();
  const matchedIds = new Set((refs || []).map((ref) => String(ref?.segmentId || "").trim()).filter(Boolean));
  const accent = getEvidenceColor(evidenceKey || title);

  ui.evidenceTitle.textContent = title;
  ui.evidenceSubtitle.textContent =
    subtitle || (matchedIds.size ? "Matching transcript evidence is highlighted below." : "");

  if (!transcript.length) {
    ui.evidenceBody.innerHTML = emptyStateHtml("Transcript is still syncing in the background.");
  } else {
    ui.evidenceBody.innerHTML = transcript
      .map((segment) => {
        const isMatch = matchedIds.has(segment.id);
        const sourceLabel = `${segment.source || "transcript"} • ${formatDateTime(segment.at)}`;
        const qualityPct = Math.round((Number(segment.quality?.confidence || 0) || 0) * 100);
        return `
          <div class="evidence-line${isMatch ? " is-match" : ""}" data-segment-id="${escapeHtml(
            segment.id
          )}" style="--evidence-color:${accent}">
            <div class="evidence-line-meta">${escapeHtml(sourceLabel)}</div>
            <div class="evidence-line-text">${escapeHtml(segment.cleanedText || segment.rawText || "")}</div>
            <div class="evidence-line-submeta">${escapeHtml(
              qualityPct > 0 ? `Quality ${qualityPct}%` : "Saved transcript evidence"
            )}</div>
          </div>
        `;
      })
      .join("");
  }

  ui.evidenceDrawer.classList.add("open");
  ui.evidenceBackdrop?.classList.add("open");

  requestAnimationFrame(() => {
    const firstMatch = ui.evidenceBody.querySelector(".evidence-line.is-match");
    firstMatch?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
};

const bindEvidenceTrigger = (element, { title, subtitle = "", refs = [], evidenceKey = "" }) => {
  if (!element || !Array.isArray(refs) || refs.length === 0) return;

  const accent = getEvidenceColor(evidenceKey || title);
  element.classList.add("is-clickable");
  element.style.setProperty("--evidence-color", accent);
  element.setAttribute("role", "button");
  element.tabIndex = 0;

  const open = () =>
    openEvidenceDrawer({
      title,
      subtitle,
      refs,
      evidenceKey,
    });

  element.addEventListener("click", open);
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  });
};

const renderChartNotes = (notes) => {
  state.chartNotes = Array.isArray(notes) ? notes : [];
  ui.transcriptFeed.innerHTML = "";

  const items = state.chartNotes.slice(0, 6);
  if (!items.length) {
    if (state.encounterActive) {
      ui.transcriptFeed.innerHTML = emptyStateHtml(
        "Listening and drafting chart notes while the transcript saves in the background"
      );
      return;
    }

    ui.transcriptFeed.innerHTML = emptyStateHtml("AI chart notes appear here during encounter");
    return;
  }

  for (const note of items) {
    const card = document.createElement("div");
    card.className = "note-card";
    card.innerHTML = `
      <div class="note-category">${escapeHtml(note.category || "Chart Note")}</div>
      <div class="note-title">${escapeHtml(note.text || "Encounter note captured.")}</div>
      ${
        note.detail
          ? `<div class="note-detail">${escapeHtml(note.detail)}</div>`
          : ""
      }
      <div class="note-meta">${
        Array.isArray(note.evidenceRefs) && note.evidenceRefs.length
          ? "Click to open supporting transcript evidence"
          : "Saved from live encounter analysis"
      }</div>
    `;

    bindEvidenceTrigger(card, {
      title: note.text || "Chart note evidence",
      subtitle: note.detail || "Supporting transcript evidence",
      refs: note.evidenceRefs || [],
      evidenceKey: getEvidenceKey("note", note),
    });

    ui.transcriptFeed.appendChild(card);
  }
};

const clearInterimTranscript = () => {
  state.interimTranscriptText = "";
};

const setInterimTranscript = (_source, text) => {
  state.interimTranscriptText = String(text || "").trim();
  if (!state.chartNotes.length && state.encounterActive) {
    renderChartNotes(state.chartNotes);
  }
};

const addAssistantMessage = (text) => {
  const cleaned = String(text || "").trim();
  if (!cleaned || cleaned === state.lastAssistantMessage) return;

  removeEmptyStates(ui.chatFeed);
  const message = document.createElement("div");
  message.className = "chat-bubble assistant";
  message.textContent = cleaned;
  ui.chatFeed.prepend(message);
  state.lastAssistantMessage = cleaned;
};

const renderSuggestions = (suggestions) => {
  ui.suggestionList.innerHTML = "";
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    ui.suggestionList.innerHTML = emptyStateHtml("No assistant suggestions yet.");
    if (ui.cptBadge) ui.cptBadge.textContent = "0 codes";
    return;
  }

  if (ui.cptBadge) {
    const count = suggestions.length;
    ui.cptBadge.textContent = `${count} code${count === 1 ? "" : "s"}`;
  }

  for (const item of suggestions) {
    const card = document.createElement("div");
    card.className = "cpt-card";
    const evidenceRefs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [];
    const evidenceKey = getEvidenceKey("cpt", item);
    const confidence = Math.max(0, Math.min(100, Math.round((item.confidence || 0) * 100)));
    const amount = item.estimatedAmount ? `+$${safeNumber(item.estimatedAmount)}` : `${confidence}%`;
    card.innerHTML = `
      <div class="cpt-card-top">
        <div class="cpt-code">${escapeHtml(item.code)}</div>
        <div class="cpt-amount">${amount}</div>
      </div>
      <div class="cpt-desc"><strong>${escapeHtml(item.title || "Assistant suggestion")}</strong></div>
      <div class="cpt-desc">${escapeHtml(item.rationale || "No rationale.")}</div>
      <div class="cpt-desc"><strong>MDM:</strong> ${escapeHtml(item.mdmJustification || "MDM support not yet provided.")}</div>
      <div class="cpt-desc">Doc: ${escapeHtml(item.documentationNeeded || "Document medical necessity.")}</div>
      ${
        evidenceRefs.length
          ? `<div class="evidence-chip" style="--evidence-color:${getEvidenceColor(evidenceKey)}">Open transcript evidence</div>`
          : ""
      }
      <div class="cpt-confidence-bar">
        <div class="cpt-confidence-fill" style="width:${confidence}%"></div>
      </div>
      <div class="cpt-confidence-label"><span>Confidence</span><span>${confidence}%</span></div>
    `;

    bindEvidenceTrigger(card, {
      title: `${item.code} recommendation`,
      subtitle: item.rationale || item.documentationNeeded || "Supporting transcript evidence",
      refs: evidenceRefs,
      evidenceKey,
    });

    ui.suggestionList.appendChild(card);
  }
};

const renderRevenueTracker = (tracker) => {
  const currentEstimatedRevenue = Number(
    tracker?.earnedNow ??
      tracker?.currentCodesRevenue ??
      tracker?.baseline ??
      tracker?.projectedTotal ??
      0
  );
  const potentialEstimatedRevenue = Number(
    tracker?.projectedRevenueWithSuggestions ??
      tracker?.projectedTotal ??
      currentEstimatedRevenue
  );

  if (ui.currentEstimatedRevenue) {
    ui.currentEstimatedRevenue.textContent = `$${safeNumber(currentEstimatedRevenue)}`;
  }
  if (ui.potentialEstimatedRevenue) {
    ui.potentialEstimatedRevenue.textContent = `$${safeNumber(potentialEstimatedRevenue)}`;
  }
};

const renderGuidance = (guidanceItems) => {
  const count = Array.isArray(guidanceItems) ? guidanceItems.length : 0;
  if (ui.guidanceBadge) {
    ui.guidanceBadge.textContent = count ? `${count} AI hints` : "Editable";
  }
};

const renderBillableCodes = (codes) => {
  ui.billableCodesList.innerHTML = "";
  if (!Array.isArray(codes) || codes.length === 0) {
    ui.billableCodesList.innerHTML = emptyStateHtml("No suggested codes detected yet.");
    if (ui.billableCount) ui.billableCount.textContent = "0 items";
    return;
  }

  if (ui.billableCount) {
    ui.billableCount.textContent = `${codes.length} item${codes.length === 1 ? "" : "s"}`;
  }

  for (const code of codes) {
    const row = document.createElement("div");
    row.className = "table-row";
    const evidenceKey = getEvidenceKey("billable", code);
    const confidence = Number(code.confidence || 0);
    const status = confidence >= 0.8 ? "confirmed" : "pending";
    row.innerHTML = `
      <div class="table-code">${escapeHtml(code.code)}</div>
      <div class="table-desc">${escapeHtml(code.title || "")}</div>
      <div class="table-amount">$${safeNumber(code.estimatedAmount)}</div>
      <div><span class="status-tag ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></div>
    `;

    bindEvidenceTrigger(row, {
      title: `${code.code} suggested code`,
      subtitle:
        code.mdmJustification ||
        code.rationale ||
        code.evidence ||
        "This code is currently selected based on transcript evidence.",
      refs: code.evidenceRefs || [],
      evidenceKey,
    });

    ui.billableCodesList.appendChild(row);
  }
};

const buildProviderNoteText = (content = {}) => {
  const manual = String(content?.additionalProviderNotes || "").trim();
  const merged = String(content?.freeTextAdditions || "").trim();
  if (merged) return merged;
  const sections = content?.sections || {};
  const sectionText = [
    sections.hpi,
    sections.ros,
    sections.exam,
    sections.assessment,
    sections.plan,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n");
  if (manual && sectionText) {
    return `${sectionText}\n\nManual Notes:\n${manual}`;
  }
  return sectionText || manual;
};

const syncProviderNoteIntoChartNotes = (noteText) => {
  const normalized = String(noteText || "").trim();
  const withoutProviderNote = Array.isArray(state.chartNotes)
    ? state.chartNotes.filter((item) => String(item?.id || "") !== "provider-notes-context")
    : [];

  if (!normalized) {
    state.chartNotes = withoutProviderNote;
    renderChartNotes(state.chartNotes);
    return;
  }

  const preview = normalized.length > 320 ? `${normalized.slice(0, 320).trim()}...` : normalized;
  const providerNote = {
    id: "provider-notes-context",
    category: "Provider Notes",
    text: "Doctor-entered notes were incorporated into AI chart notes and recommendations.",
    detail: preview,
    evidenceRefs: [],
  };

  state.chartNotes = [providerNote, ...withoutProviderNote].slice(0, 8);
  renderChartNotes(state.chartNotes);
};

const getNoteContentFromUi = () => {
  const manualNotes = String(ui.manualDoctorNotesInput?.value || "").trim();
  const mergedNotes = String(ui.noteFinalMergedEditor?.value || "").trim();
  const existingSections = state.noteEditor.note?.version?.contentJson?.sections || {};
  return {
    sections: {
      hpi: String(existingSections.hpi || "").trim(),
      ros: String(existingSections.ros || "").trim(),
      exam: String(existingSections.exam || "").trim(),
      assessment: String(existingSections.assessment || "").trim(),
      plan: String(existingSections.plan || "").trim(),
    },
    additionalProviderNotes: manualNotes,
    freeTextAdditions: mergedNotes || manualNotes,
  };
};

const setNoteContentToUi = (content = {}) => {
  const manualText = String(content?.additionalProviderNotes || "").trim();
  const mergedText = buildProviderNoteText(content);
  state.noteEditor.finalEditorTouched = false;
  if (ui.manualDoctorNotesInput) {
    ui.manualDoctorNotesInput.value = manualText;
  }
  if (ui.noteFinalMergedEditor) {
    ui.noteFinalMergedEditor.value = mergedText;
  }
  syncProviderNoteIntoChartNotes(mergedText);
  updateNoteMergeStatus();
};

const updateNoteMergeStatus = () => {
  if (!ui.noteMergeStatus) return;
  const manualNotes = String(ui.manualDoctorNotesInput?.value || "").trim();
  const mergedNotes = String(ui.noteFinalMergedEditor?.value || "").trim();
  if (!manualNotes && !mergedNotes) {
    ui.noteMergeStatus.textContent =
      "Add manual notes here. The merged final chart note stays editable below before finalization.";
    if (ui.noteFinalStatus) {
      ui.noteFinalStatus.textContent =
        "After the appointment ends, edit this final section and click Finalize to publish to Billing + EHR.";
    }
    return;
  }
  const manualLines = manualNotes.split(/\r?\n/).filter((line) => line.trim()).length;
  const mergedLines = mergedNotes.split(/\r?\n/).filter((line) => line.trim()).length;
  ui.noteMergeStatus.textContent = `Manual note captured (${manualLines} lines). Merged final note currently has ${mergedLines} lines and remains editable.`;
  if (ui.noteFinalStatus) {
    ui.noteFinalStatus.textContent =
      "Merged final note is ready for review. Save any edits, then click Finalize to send Billing + EHR.";
  }
};

const setNoteLockState = (locked) => {
  if (ui.manualDoctorNotesInput) ui.manualDoctorNotesInput.disabled = Boolean(locked);
  if (ui.noteFinalMergedEditor) ui.noteFinalMergedEditor.disabled = Boolean(locked);
  if (ui.saveNoteDraftBtn) ui.saveNoteDraftBtn.disabled = Boolean(locked);
  if (ui.recalculateNoteBtn) ui.recalculateNoteBtn.disabled = Boolean(locked);
  if (ui.finalizeNoteBtn) ui.finalizeNoteBtn.disabled = Boolean(locked);
};

const renderNoteVersions = (versions = []) => {
  renderSimplePills(
    ui.noteVersionList,
    versions.map((item) => `v${item.versionNumber} ${item.versionType}${item.isFinal ? " (final)" : ""}`),
    "No versions yet"
  );
};

const renderNoteCoding = (analysis) => {
  state.noteEditor.codingAnalysis = analysis || null;
  if (!analysis) {
    renderSimplePills(ui.noteCptList, [], "No assistant suggestions");
    renderSimplePills(ui.noteIcdList, [], "No ICD suggestions");
    renderSimplePills(ui.noteMissingPrompts, [], "No prompts");
    if (ui.noteJustificationText) ui.noteJustificationText.textContent = "No current coding justification.";
    return;
  }

  const cptCodes = Array.isArray(analysis.cptCodes) ? analysis.cptCodes : [];
  const icdCodes = Array.isArray(analysis.icdCodes) ? analysis.icdCodes : [];
  const prompts = Array.isArray(analysis.documentationImprovements)
    ? analysis.documentationImprovements
    : [];

  renderCodePillsWithEvidence({
    container: ui.noteCptList,
    items: cptCodes,
    emptyText: "No assistant suggestions",
    keyPrefix: "note-cpt",
    subtitleBuilder: (item) =>
      item.mdmJustification ||
      item.rationale ||
      "Suggested code linked to transcript evidence and note context.",
  });
  renderCodePillsWithEvidence({
    container: ui.noteIcdList,
    items: icdCodes,
    emptyText: "No ICD suggestions",
    keyPrefix: "note-icd",
    subtitleBuilder: (item) => item.rationale || item.evidence || "Suggested diagnosis evidence",
  });
  renderSimplePills(
    ui.noteMissingPrompts,
    prompts.map((item) => item.text || item.prompt),
    "No prompts"
  );
  if (ui.noteJustificationText) {
    ui.noteJustificationText.textContent = String(analysis.justification || "No justification");
  }
};

const renderNotePayload = (payload) => {
  const note = payload?.note || null;
  state.noteEditor.note = note;
  if (!note) return;

  setNoteContentToUi(note.version?.contentJson || {});
  renderNoteVersions(note.versions || []);
  renderNoteCoding(payload.codingAnalysis || null);
  const finalized = note.status === "finalized" && note.locked;
  setNoteLockState(finalized);

  if (ui.noteStatusBadge) {
    ui.noteStatusBadge.textContent = finalized ? "Finalized" : note.status || "Draft";
    ui.noteStatusBadge.classList.toggle("active", finalized);
  }

  if (ui.noteAnalysisStatus) {
    const model = payload?.codingAnalysis?.model;
    const confidence = Math.round(Number(payload?.codingAnalysis?.confidence || 0) * 100);
    ui.noteAnalysisStatus.textContent = model
      ? `Analysis ready (${model}) • ${confidence}%`
      : `Analysis ready • ${confidence}%`;
  }
  const finalCodes =
    note?.version?.finalCodes ||
    payload?.codingAnalysis?.cptCodes?.map((item) => item.code).filter(Boolean) ||
    [];
  if (ui.noteFinalCodesInput) {
    ui.noteFinalCodesInput.value = finalCodes.join(", ");
  }
  if (ui.overrideReasonInput) {
    ui.overrideReasonInput.value = String(note?.version?.overrideReason || "");
  }
};

const loadAppointmentNote = async (appointmentId, { includeVersions = true } = {}) => {
  if (!appointmentId) return;
  const payload = await api(
    `/api/appointments/${encodeURIComponent(appointmentId)}/note?includeVersions=${includeVersions ? "true" : "false"}`
  );
  renderNotePayload(payload || {});
  state.noteEditor.loaded = true;
};

const saveNoteDraft = async ({ silent = false, allowAfterFinal = false } = {}) => {
  if (!state.appointment?.id) return null;
  if (ui.noteAnalysisStatus) ui.noteAnalysisStatus.textContent = "Saving draft + updating coding...";

  const payload = await api(`/api/appointments/${encodeURIComponent(state.appointment.id)}/note`, {
    method: "PUT",
    body: JSON.stringify({
      content: getNoteContentFromUi(),
      allowAfterFinal,
    }),
  });
  renderNotePayload(payload || {});
  if (!silent) addLog("Provider note draft saved.", "good");
  return payload;
};

const recalculateNoteDraft = async () => {
  if (!state.appointment?.id) return;
  if (ui.noteAnalysisStatus) ui.noteAnalysisStatus.textContent = "Recalculating...";
  const payload = await api(
    `/api/appointments/${encodeURIComponent(state.appointment.id)}/note/recalculate`,
    {
      method: "POST",
      body: JSON.stringify({
        content: getNoteContentFromUi(),
      }),
    }
  );
  renderNoteCoding(payload.codingAnalysis || null);
  if (ui.noteAnalysisStatus) ui.noteAnalysisStatus.textContent = "Analysis ready";
  addLog("Coding recommendations recalculated from edited note.", "good");
};

const finalizeCurrentNote = async () => {
  if (!state.appointment?.id) return;
  const overriddenCodes = String(ui.noteFinalCodesInput?.value || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const finalCodes = overriddenCodes.length
    ? overriddenCodes
    : Array.isArray(state.noteEditor.codingAnalysis?.cptCodes)
      ? state.noteEditor.codingAnalysis.cptCodes.map((item) => item.code).filter(Boolean)
      : [];
  const suggestedCodes = Array.isArray(state.noteEditor.codingAnalysis?.cptCodes)
    ? state.noteEditor.codingAnalysis.cptCodes.map((item) => String(item.code || "").toUpperCase()).filter(Boolean)
    : [];
  const overrideReason = String(ui.overrideReasonInput?.value || "").trim();
  const overrides = [];
  for (const code of finalCodes) {
    if (!suggestedCodes.includes(code)) {
      overrides.push({
        originalCode: suggestedCodes[0] || "",
        finalCode: code,
        reason: overrideReason,
      });
    }
  }

  const payload = await api(`/api/appointments/${encodeURIComponent(state.appointment.id)}/note/finalize`, {
    method: "POST",
    body: JSON.stringify({
      overrideReason,
      finalCodes,
      overrides,
    }),
  });
  renderNotePayload(payload || {});
  addLog("Note finalized and locked for billing.", "good");
};

const scheduleNoteAutosave = () => {
  if (!state.appointment?.id) return;
  if (state.noteEditor.note?.locked) return;
  clearTimeout(state.noteEditor.autosaveTimer);
  if (ui.noteAnalysisStatus) ui.noteAnalysisStatus.textContent = "Draft changes pending...";
  state.noteEditor.autosaveTimer = setTimeout(() => {
    saveNoteDraft({ silent: true }).catch((error) =>
      addLog(`Auto-save failed: ${error.message}`, "warn")
    );
  }, 1200);
};

const api = async (path, options = {}) => {
  const headers = {
    ...(options.headers || {}),
  };
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (state.auth.token) {
    headers.Authorization = `Bearer ${state.auth.token}`;
  }

  const response = await fetch(path, {
    headers,
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.auth.token) {
      clearAuthState();
      setAuthUserUi();
      applyRoleViewAccess();
      setAuthOverlayOpen(true);
      setAuthError("Session expired. Please sign in again.");
    }
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
};

const renderTableBody = (container, rowsHtml, emptyColSpan, emptyText) => {
  if (!container) return;
  if (rowsHtml && rowsHtml.length) {
    container.innerHTML = rowsHtml;
    return;
  }
  container.innerHTML = `<tr><td colspan="${emptyColSpan}" class="tiny-note">${escapeHtml(
    emptyText
  )}</td></tr>`;
};

const setCompactTableMode = (enabled) => {
  document.body.classList.toggle("compact-tables", Boolean(enabled));
};

const applyPreferencesToUi = (prefs) => {
  if (ui.prefDoctorRef) ui.prefDoctorRef.value = prefs.doctorRef || "default";
  if (ui.prefDefaultView) ui.prefDefaultView.value = prefs.defaultView || "live";
  if (ui.prefAiAggressiveness) ui.prefAiAggressiveness.value = prefs.aiAggressiveness || "conservative";
  if (ui.prefDefaultVisitType) ui.prefDefaultVisitType.value = prefs.defaultVisitType || "follow-up";
  if (ui.prefTranscriptLanguage) {
    ui.prefTranscriptLanguage.value = prefs.transcriptDisplayLanguage || "en";
  }
  if (ui.prefDashboardLayout) ui.prefDashboardLayout.value = prefs.dashboardLayout || "standard";
  if (ui.prefAutoOpenPast) ui.prefAutoOpenPast.checked = Boolean(prefs.autoOpenPastAfterStop);
  if (ui.prefAutoRefreshReports) ui.prefAutoRefreshReports.checked = Boolean(prefs.autoRefreshReports);
  if (ui.prefAutoSuggestEnabled) ui.prefAutoSuggestEnabled.checked = Boolean(prefs.autoSuggestEnabled);
  if (ui.prefKeyboardShortcuts) {
    ui.prefKeyboardShortcuts.checked = Boolean(prefs.keyboardShortcutsEnabled);
  }
  if (ui.prefCompactTables) ui.prefCompactTables.checked = Boolean(prefs.compactTables);
  setCompactTableMode(Boolean(prefs.compactTables));
};

const readPreferencesFromUi = () => ({
  doctorRef: ui.prefDoctorRef?.value?.trim() || "default",
  defaultView: ui.prefDefaultView?.value || "live",
  aiAggressiveness: ui.prefAiAggressiveness?.value || "conservative",
  autoSuggestEnabled: Boolean(ui.prefAutoSuggestEnabled?.checked),
  defaultVisitType: ui.prefDefaultVisitType?.value || "follow-up",
  transcriptDisplayLanguage: ui.prefTranscriptLanguage?.value || "en",
  keyboardShortcutsEnabled: Boolean(ui.prefKeyboardShortcuts?.checked),
  dashboardLayout: ui.prefDashboardLayout?.value || "standard",
  autoOpenPastAfterStop: Boolean(ui.prefAutoOpenPast?.checked),
  autoRefreshReports: Boolean(ui.prefAutoRefreshReports?.checked),
  compactTables: Boolean(ui.prefCompactTables?.checked),
});

const renderPastEncounters = (appointments) => {
  if (!ui.pastEncountersBody) return;

  const accessSuffix = state.auth.token
    ? `?accessToken=${encodeURIComponent(state.auth.token)}`
    : "";

  const rowsHtml = (appointments || [])
    .map(
      (item) => `
      <tr>
        <td>
          <div class="table-code-pill">${escapeHtml(item.id)}</div>
          <div class="tiny-note">${escapeHtml(item.doctorRef || "-")}</div>
        </td>
        <td>${escapeHtml(item.patientRef || "-")}</td>
        <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
        <td>
          <div class="pill-list">
            ${(item.finalCptCodes || [])
              .slice(0, 4)
              .map((code) => `<span class="pill">${escapeHtml(code)}</span>`)
              .join("") || '<span class="tiny-note">No codes</span>'}
          </div>
        </td>
        <td>${escapeHtml(formatCurrency(item.earnedNow || item.projectedRevenue || 0))}</td>
        <td>
          <div class="inline-actions">
            <a class="btn btn-ghost" style="height:30px;padding:0 10px;" href="/api/appointments/${encodeURIComponent(
              item.id
            )}/transcript.pdf${accessSuffix}" target="_blank" rel="noopener">PDF</a>
            <button class="btn btn-ghost" style="height:30px;padding:0 10px;" data-audit-id="${escapeHtml(
              item.id
            )}" type="button">Open</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  renderTableBody(ui.pastEncountersBody, rowsHtml, 6, "No completed encounters to show.");

  ui.pastEncountersBody.querySelectorAll("button[data-audit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointmentId = button.getAttribute("data-audit-id");
      if (!appointmentId) return;
      state.selectedPastEncounterId = appointmentId;
      Promise.all([loadPastEncounterAudit(appointmentId), loadPastEncounterData(appointmentId)]).catch(
        (error) => addLog(`Unable to load encounter details: ${error.message}`, "warn")
      );
    });
  });

  if (ui.pastEncountersSummary) {
    const count = Array.isArray(appointments) ? appointments.length : 0;
    ui.pastEncountersSummary.textContent = `${count} encounter${count === 1 ? "" : "s"}`;
  }
};

const buildUniqueCodes = (items = [], selector = (item) => item) =>
  Array.from(
    new Set(
      items
        .map((item) => String(selector(item) || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

const getActiveOrLatestNoteVersion = (appointment = {}) => {
  const workflow = appointment?.noteWorkflow || {};
  const versions = Array.isArray(workflow.versions) ? workflow.versions : [];
  if (!versions.length) return null;
  const current = versions.find((item) => item.versionId === workflow.currentVersionId);
  return current || versions[versions.length - 1] || null;
};

const renderPastEncounterData = (appointment) => {
  if (!ui.pastEncounterDataBody) return;
  if (!appointment) {
    if (ui.pastEncounterDataSummary) {
      ui.pastEncounterDataSummary.textContent =
        "Select an encounter to load transcript, recordings, notes, and codes.";
    }
    ui.pastEncounterDataBody.innerHTML = '<div class="tiny-note">No encounter selected.</div>';
    return;
  }

  const transcriptSegments = Array.isArray(appointment.transcriptSegments)
    ? appointment.transcriptSegments
    : [];
  const recordings = Array.isArray(appointment.recordings) ? appointment.recordings : [];
  const suggestions = Array.isArray(appointment.suggestions) ? appointment.suggestions : [];
  const icdSuggestions = Array.isArray(appointment.icdSuggestions) ? appointment.icdSuggestions : [];
  const billableCodes = Array.isArray(appointment?.revenueTracker?.billableCodes)
    ? appointment.revenueTracker.billableCodes
    : [];
  const noteVersion = getActiveOrLatestNoteVersion(appointment);
  const noteContent = noteVersion?.contentJson || {};
  const noteSections = noteContent.sections || {};
  const noteText =
    String(noteContent.freeTextAdditions || "").trim() ||
    String(noteContent.additionalProviderNotes || "").trim() ||
    [
      noteSections.hpi,
      noteSections.ros,
      noteSections.exam,
      noteSections.assessment,
      noteSections.plan,
    ]
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .join("\n");

  const transcriptPreview = transcriptSegments.length
    ? transcriptSegments
        .slice(-12)
        .map((segment) => {
          const seq = Number(segment.sequence || 0);
          const source = String(segment.source || "transcript").trim();
          const text = String(segment.cleanedText || segment.text || "").trim();
          return `[${seq || "-"} | ${source}] ${text}`;
        })
        .join("\n")
    : "No transcript segments saved.";

  const recordingPreview = recordings.length
    ? recordings
        .map((item, index) => {
          const provider = String(item.provider || "storage").trim();
          const savedAt = formatDateTime(item.at || item.uploadedAt || "");
          const expiresAt = item.retentionExpiresAt ? formatDateTime(item.retentionExpiresAt) : "n/a";
          const location = String(item.location || item.blobName || "").trim();
          const link =
            location && /^https?:\/\//i.test(location) ? `\nLink: ${location}` : location ? `\nPath: ${location}` : "";
          return `${index + 1}. ${provider} | Saved: ${savedAt} | Expires: ${expiresAt}${link}`;
        })
        .join("\n\n")
    : "No recording metadata saved.";

  const finalVersion = Array.isArray(appointment?.noteWorkflow?.versions)
    ? appointment.noteWorkflow.versions.find(
        (item) => item.versionId && item.versionId === appointment?.noteWorkflow?.finalizedVersionId
      ) || null
    : null;
  const finalCodes = buildUniqueCodes(finalVersion?.finalCodes || []);
  const suggestedCpt = buildUniqueCodes(suggestions, (item) => item?.code);
  const suggestedIcd = buildUniqueCodes(icdSuggestions, (item) => item?.code);
  const currentBillable = buildUniqueCodes(billableCodes, (item) => item?.code);

  const section = (label, body) => `
    <div class="audit-item">
      <div class="meta">${escapeHtml(label)}</div>
      <div class="body">${escapeHtml(body || "-")}</div>
    </div>
  `;

  const notePreview = noteText || "No doctor note saved.";
  const cptLine = currentBillable.length
    ? `Current Billable CPT: ${currentBillable.join(", ")}`
    : "Current Billable CPT: none";
  const suggestedLine = suggestedCpt.length
    ? `Suggested CPT: ${suggestedCpt.join(", ")}`
    : "Suggested CPT: none";
  const finalLine = finalCodes.length ? `Final CPT: ${finalCodes.join(", ")}` : "Final CPT: none";
  const icdLine = suggestedIcd.length ? `Suggested ICD-10: ${suggestedIcd.join(", ")}` : "Suggested ICD-10: none";

  if (ui.pastEncounterDataSummary) {
    ui.pastEncounterDataSummary.textContent = `Loaded ${appointment.id} | Transcripts: ${transcriptSegments.length} | Recordings: ${recordings.length} | Note versions: ${Array.isArray(appointment?.noteWorkflow?.versions) ? appointment.noteWorkflow.versions.length : 0}`;
  }

  ui.pastEncounterDataBody.innerHTML = [
    section("Doctor Note", notePreview),
    section("Codes", [cptLine, suggestedLine, finalLine, icdLine].join("\n")),
    section("Recordings", recordingPreview),
    section("Transcription", transcriptPreview),
  ].join("");
};

const renderBillingQueue = (queue = []) => {
  state.billing.queue = Array.isArray(queue) ? queue : [];
  if (!ui.billingQueueBody) return;

  const rowsHtml = state.billing.queue
    .map(
      (item) => {
        const patientProfile = normalizePatientProfile(item?.patientProfile || {}, item?.patientRef || "");
        const firstName = patientProfile.firstName || "-";
        const lastName = patientProfile.lastName || "-";
        const dob = patientProfile.dob ? formatDateOnly(patientProfile.dob) : "-";
        const appointmentTime = formatDateTime(item?.appointmentTime || item?.finalizedAt);
        return `
      <tr>
        <td>
          <button class="btn btn-ghost" type="button" data-billing-open="${escapeHtml(
            item.appointmentId
          )}" style="height:30px;padding:0 10px;">
            ${escapeHtml(item.appointmentId || "-")}
          </button>
        </td>
        <td>${escapeHtml(firstName)}</td>
        <td>${escapeHtml(lastName)}</td>
        <td>${escapeHtml(dob)}</td>
        <td>${escapeHtml(appointmentTime)}</td>
        <td>${escapeHtml(formatCurrency(item.expectedRevenueFromAppointment || 0))}</td>
        <td><button class="btn btn-ghost" type="button" data-billing-open="${escapeHtml(
          item.appointmentId
        )}" style="height:30px;padding:0 10px;">Open</button></td>
      </tr>`;
      }
    )
    .join("");

  renderTableBody(ui.billingQueueBody, rowsHtml, 7, "No finalized notes available.");
  if (ui.billingQueueSummary) {
    ui.billingQueueSummary.textContent = `${state.billing.queue.length} finalized encounter${
      state.billing.queue.length === 1 ? "" : "s"
    }`;
  }

  ui.billingQueueBody.querySelectorAll("button[data-billing-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointmentId = button.getAttribute("data-billing-open");
      if (!appointmentId) return;
      loadBillingFinalNote(appointmentId).catch((error) =>
        addLog(`Billing final note load failed: ${error.message}`, "warn")
      );
    });
  });
};

const loadBillingQueue = async () => {
  const payload = await api("/api/billing/queue");
  renderBillingQueue(payload.queue || []);
  state.loadedViewData.billing = true;
};

const loadBillingFinalNote = async (appointmentId) => {
  const payload = await api(`/api/billing/appointments/${encodeURIComponent(appointmentId)}/final`);
  const noteContent = payload?.finalVersion?.contentJson || {};
  const preview = buildProviderNoteText(noteContent) || "No finalized merged note available.";
  const patientProfile = normalizePatientProfile(payload?.patientProfile || {}, payload?.patientRef || "");
  const appointmentTime = formatDateTime(payload?.appointmentTime || payload?.finalizedAt);
  const patientSummary = [
    patientProfile.patientRef ? `Ref: ${patientProfile.patientRef}` : "",
    patientProfile.externalChartId ? `Chart: ${patientProfile.externalChartId}` : "",
    patientProfile.fullName ? `Name: ${patientProfile.fullName}` : "",
    patientProfile.dob ? `DOB: ${formatDateOnly(patientProfile.dob)}` : "",
    patientProfile.insuranceInfo ? `Insurance: ${toInsuranceLabel(patientProfile.insuranceInfo)}` : "",
    appointmentTime && appointmentTime !== "-" ? `Appointment Time: ${appointmentTime}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const currentRevenue = Number(
    payload?.mergedRevenue?.currentEstimatedRevenue ??
      payload?.revenueTracker?.earnedNow ??
      payload?.revenueTracker?.projectedTotal ??
      0
  );
  const potentialRevenue = Number(
    payload?.mergedRevenue?.potentialEstimatedRevenue ??
      payload?.expectedRevenueFromAppointment ??
      payload?.revenueTracker?.projectedRevenueWithSuggestions ??
      payload?.revenueTracker?.projectedTotal ??
      currentRevenue
  );

  if (ui.billingExpectedRevenue) {
    ui.billingExpectedRevenue.textContent = formatCurrency(
      payload?.expectedRevenueFromAppointment ?? potentialRevenue ?? currentRevenue ?? 0
    );
  }
  if (ui.billingPatientChartPreview) {
    ui.billingPatientChartPreview.textContent = patientSummary || "Patient chart summary unavailable.";
  }
  if (ui.billingFinalNotePreview) {
    ui.billingFinalNotePreview.textContent = preview;
  }
  const recommendedCptCodes = Array.isArray(payload?.recommendedCptCodes)
    ? payload.recommendedCptCodes.map((item) => normalizeCode(item?.code))
    : [];
  const recommendedIcd10Codes = Array.isArray(payload?.recommendedIcd10Codes)
    ? payload.recommendedIcd10Codes.map((item) => normalizeCode(item?.code))
    : [];
  const approvedCodes = Array.isArray(payload?.approvedCodes) ? payload.approvedCodes.map(normalizeCode) : [];
  const allCptCodes = uniqueCodes([
    ...recommendedCptCodes,
    ...approvedCodes.filter((code) => looksLikeCptCode(code)),
  ]);
  const allIcdCodes = uniqueCodes([
    ...recommendedIcd10Codes,
    ...approvedCodes.filter((code) => looksLikeIcd10Code(code)),
  ]);

  renderSimplePills(ui.billingRecommendedCpt, allCptCodes, "No CPT codes loaded.");
  renderSimplePills(ui.billingRecommendedIcd, allIcdCodes, "No ICD-10 codes loaded.");
  renderSimplePills(ui.billingApprovedCodes, payload.approvedCodes || [], "No approved codes.");
  const transcriptPreview = Array.isArray(payload?.transcriptSegments)
    ? payload.transcriptSegments
        .slice(-8)
        .map((segment) => `[${segment.sequence || "-"}] ${segment.cleanedText || ""}`)
        .join("\n")
    : "";
  if (ui.billingTranscriptPreview) {
    ui.billingTranscriptPreview.textContent = transcriptPreview || "No transcript excerpts loaded.";
  }
  const recordings = Array.isArray(payload?.recordings) ? payload.recordings : [];
  const audioPreview = recordings.length
    ? recordings
        .slice(0, 4)
        .map((item, index) => {
          const provider = String(item?.provider || "storage").trim() || "storage";
          const savedAt = item?.uploadedAt ? formatDateTime(item.uploadedAt) : "-";
          const location = String(item?.location || "").trim();
          return `${index + 1}) ${provider} ${savedAt !== "-" ? `@ ${savedAt}` : ""}${
            location ? ` (${location})` : ""
          }`;
        })
        .join(" | ")
    : "No audio recordings loaded.";
  if (ui.billingAudioPreview) {
    ui.billingAudioPreview.textContent = audioPreview;
  }
  renderCodePillsWithEvidence({
    container: ui.billingCodeEvidence,
    items: Array.isArray(payload?.codeEvidence) ? payload.codeEvidence : [],
    emptyText: "No code evidence loaded.",
    keyPrefix: "billing-code",
    subtitleBuilder: (item) =>
      [item.mdmJustification, item.rationale, item.evidence].filter(Boolean).join(" | "),
    labelBuilder: (item) => {
      const amount = Number(item?.estimatedAmount || 0) > 0 ? ` $${safeNumber(item.estimatedAmount)}` : "";
      return `${String(item?.code || "").toUpperCase()}${amount}`;
    },
  });
  state.billing.selectedAppointmentId = appointmentId;
};

const renderAuditItems = (container, events, fallbackText) => {
  if (!container) return;
  if (!Array.isArray(events) || !events.length) {
    container.innerHTML = `<div class="tiny-note">${escapeHtml(fallbackText)}</div>`;
    return;
  }
  container.innerHTML = events
    .map((event) => {
      const meta = `${event.at || ""} • ${event.eventType || "event"}`;
      const body = JSON.stringify(event.payload || {}, null, 2);
      return `
        <div class="audit-item">
          <div class="meta">${escapeHtml(meta)}</div>
          <div class="body">${escapeHtml(body)}</div>
        </div>
      `;
    })
    .join("");
};

const loadPastEncounterAudit = async (appointmentId) => {
  if (!appointmentId) return;
  const payload = await api(`/api/appointments/${encodeURIComponent(appointmentId)}/audit?limit=120`);
  if (ui.pastAuditSummary) {
    ui.pastAuditSummary.textContent = `${payload.count || 0} records for ${appointmentId}`;
  }
  renderAuditItems(
    ui.pastEncounterAuditList,
    payload.events || [],
    "No audit events for this encounter."
  );
};

const loadPastEncounterData = async (appointmentId) => {
  if (!appointmentId) return;
  const payload = await api(`/api/appointments/${encodeURIComponent(appointmentId)}`);
  renderPastEncounterData(payload?.appointment || null);
};

const loadPastEncounters = async () => {
  const query = new URLSearchParams();
  const q = String(ui.pastSearchInput?.value || "").trim();
  const dateFrom = String(ui.pastDateFrom?.value || "").trim();
  const dateTo = String(ui.pastDateTo?.value || "").trim();
  if (q) query.set("q", q);
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await api(`/api/appointments${suffix}`);
  const appointments = Array.isArray(payload.appointments) ? payload.appointments : [];
  renderPastEncounters(appointments);
  if (!appointments.length) {
    state.selectedPastEncounterId = "";
    renderPastEncounterData(null);
    if (ui.pastAuditSummary) {
      ui.pastAuditSummary.textContent = "Select an encounter to load doctor activity.";
    }
    renderAuditItems(ui.pastEncounterAuditList, [], "No encounter selected.");
  } else if (
    state.selectedPastEncounterId &&
    appointments.some((item) => item.id === state.selectedPastEncounterId)
  ) {
    loadPastEncounterData(state.selectedPastEncounterId).catch(() => {});
  }
  state.loadedViewData.past = true;
};

const renderPatientChartOptions = (patients = []) => {
  if (!ui.patientChartOptions) return;
  ui.patientChartOptions.innerHTML = Array.isArray(patients)
    ? patients
        .map((patient) => {
          const label = [patient.patientRef, patient.externalChartId, patient.fullName]
            .filter(Boolean)
            .join(" - ");
          return `<option value="${escapeHtml(patient.patientRef || "")}" label="${escapeHtml(label)}"></option>`;
        })
        .join("")
    : "";
};

const setSelectedPatientProfile = (profile = null, { insurancePlan = "" } = {}) => {
  state.selectedPatientProfile = profile
    ? normalizePatientProfile(profile, ui.patientRef?.value || "")
    : null;
  renderPatientHeader({
    patientProfile: state.selectedPatientProfile,
    insurancePlan:
      insurancePlan ||
      state.appointment?.insurancePlan ||
      ui.insurancePlan?.value ||
      state.selectedPatientProfile?.insuranceInfo ||
      "",
  });
};

const loadPatientProfileByRef = async (patientRef, { silent = false } = {}) => {
  const normalizedRef = String(patientRef || "")
    .trim()
    .toUpperCase();
  if (!normalizedRef) {
    setSelectedPatientProfile(null, { insurancePlan: ui.insurancePlan?.value || "" });
    return null;
  }
  if (!["provider", "admin"].includes(state.auth.user?.role || "")) return null;

  try {
    const payload = await api(`/api/patient-charts/${encodeURIComponent(normalizedRef)}`);
    const patient = payload?.patient || null;
    setSelectedPatientProfile(
      patient
        ? {
            ...patient,
            insuranceInfo: toInsuranceLabel(ui.insurancePlan?.value || ""),
          }
        : null,
      { insurancePlan: ui.insurancePlan?.value || "" }
    );
    if (!silent && patient) {
      addLog(`Loaded patient chart ${patient.patientRef || normalizedRef}.`, "info");
    }
    return patient;
  } catch (error) {
    setSelectedPatientProfile(
      {
        patientRef: normalizedRef,
        insuranceInfo: toInsuranceLabel(ui.insurancePlan?.value || ""),
      },
      { insurancePlan: ui.insurancePlan?.value || "" }
    );
    if (!silent) {
      addLog(`Unable to load patient chart ${normalizedRef}: ${error.message}`, "warn");
    }
    return null;
  }
};

const lookupPatientCharts = async ({ query = "", silent = false } = {}) => {
  if (!["provider", "admin"].includes(state.auth.user?.role || "")) return [];
  const params = new URLSearchParams();
  const q = String(query || "").trim();
  if (q) params.set("q", q);
  params.set("limit", "15");
  const payload = await api(`/api/patient-charts/search?${params.toString()}`);
  const patients = Array.isArray(payload?.patients) ? payload.patients : [];
  renderPatientChartOptions(patients);
  const normalizedQuery = q.toUpperCase();
  const exactMatch = patients.find(
    (patient) => String(patient?.patientRef || "").trim().toUpperCase() === normalizedQuery
  );
  if (exactMatch) {
    setSelectedPatientProfile(
      {
        ...exactMatch,
        insuranceInfo: toInsuranceLabel(ui.insurancePlan?.value || ""),
      },
      { insurancePlan: ui.insurancePlan?.value || "" }
    );
  }
  if (!silent) {
    addLog(`Loaded ${patients.length} patient chart match${patients.length === 1 ? "" : "es"}.`, "info");
  }
  return patients;
};

const renderRevenueReport = (report) => {
  if (ui.reportGeneratedAt) {
    ui.reportGeneratedAt.textContent = report?.generatedAt
      ? `Generated ${formatDateTime(report.generatedAt)}`
      : "Not generated yet";
  }

  const totals = report?.totals || {};
  if (ui.reportTotalEncounters) ui.reportTotalEncounters.textContent = String(totals.encounters || 0);
  if (ui.reportConsentedEncounters) {
    ui.reportConsentedEncounters.textContent = String(totals.consentedEncounters || 0);
  }
  if (ui.reportTotalProjected) {
    ui.reportTotalProjected.textContent = formatCurrency(totals.totalProjectedRevenue || 0);
  }
  if (ui.reportTotalEarned) {
    ui.reportTotalEarned.textContent = formatCurrency(totals.totalEarnedNow || 0);
  }
  if (ui.reportAvgProjected) {
    ui.reportAvgProjected.textContent = formatCurrency(totals.avgProjectedPerEncounter || 0);
  }

  const insuranceRows = (report?.byInsurance || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.insurancePlan || "-")}</td>
        <td>${escapeHtml(String(item.encounters || 0))}</td>
        <td>${escapeHtml(formatCurrency(item.projectedRevenue || 0))}</td>
        <td>${escapeHtml(formatCurrency(item.earnedNow || 0))}</td>
      </tr>`
    )
    .join("");
  renderTableBody(ui.reportByInsuranceBody, insuranceRows, 4, "No insurance data.");

  const visitRows = (report?.byVisitType || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.visitType || "-")}</td>
        <td>${escapeHtml(String(item.encounters || 0))}</td>
        <td>${escapeHtml(formatCurrency(item.projectedRevenue || 0))}</td>
        <td>${escapeHtml(formatCurrency(item.earnedNow || 0))}</td>
      </tr>`
    )
    .join("");
  renderTableBody(ui.reportByVisitTypeBody, visitRows, 4, "No visit type data.");

  const cptRows = (report?.cptFrequency || [])
    .slice(0, 30)
    .map(
      (item) => `
      <tr>
        <td class="table-code-pill">${escapeHtml(item.code || "-")}</td>
        <td>${escapeHtml(item.title || "-")}</td>
        <td>${escapeHtml(String(item.frequency || 0))}</td>
        <td>${escapeHtml(formatCurrency(item.projectedRevenue || 0))}</td>
      </tr>`
    )
    .join("");
  renderTableBody(ui.reportCptFrequencyBody, cptRows, 4, "No CPT usage data.");

  const missedRows = (report?.missedOpportunity || [])
    .slice(0, 30)
    .map(
      (item) => `
      <tr>
        <td class="table-code-pill">${escapeHtml(item.potentialCode || "-")}</td>
        <td>${escapeHtml(item.component || "-")}</td>
        <td>${escapeHtml(String(item.count || 0))}</td>
      </tr>`
    )
    .join("");
  renderTableBody(
    ui.reportMissedOpportunityBody,
    missedRows,
    3,
    "No missed opportunity records."
  );

  const trend = Array.isArray(report?.trendSeries) ? report.trendSeries.slice(-24) : [];
  if (ui.reportTrendChart) {
    if (!trend.length) {
      ui.reportTrendChart.innerHTML = '<div class="tiny-note">No trend data yet.</div>';
    } else {
      const max = Math.max(...trend.map((item) => Number(item.projectedRevenue || 0)), 1);
      ui.reportTrendChart.innerHTML = trend
        .map((item) => {
          const projected = Number(item.projectedRevenue || 0);
          const barHeight = Math.max(4, Math.round((projected / max) * 110));
          return `
            <div class="chart-col">
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${barHeight}px"></div>
              </div>
              <div class="chart-label">${escapeHtml(item.period || "-")}</div>
              <div class="chart-value">${escapeHtml(formatCurrency(projected))}</div>
            </div>
          `;
        })
        .join("");
    }
  }
};

const buildRevenueQueryString = () => {
  const query = new URLSearchParams();
  const granularity = String(ui.reportGranularity?.value || state.reportFilters.granularity || "daily")
    .trim()
    .toLowerCase();
  const dateFrom = String(ui.reportDateFrom?.value || "").trim();
  const dateTo = String(ui.reportDateTo?.value || "").trim();
  query.set("granularity", granularity);
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);
  state.reportFilters = { granularity, dateFrom, dateTo };
  return query.toString();
};

const loadRevenueReport = async () => {
  const query = buildRevenueQueryString();
  const payload = await api(`/api/reports/revenue?${query}`);
  renderRevenueReport(payload || {});
  state.loadedViewData.revenue = true;
  return payload;
};

const exportRevenueCsv = () => {
  const query = buildRevenueQueryString();
  const tokenPart = state.auth.token ? `&accessToken=${encodeURIComponent(state.auth.token)}` : "";
  window.open(`/api/reports/revenue/export.csv?${query}${tokenPart}`, "_blank", "noopener,noreferrer");
};

const populateGeneralSettingsForm = (settings) => {
  if (ui.settingsPracticeName) ui.settingsPracticeName.value = settings.practiceName || "";
  if (ui.settingsNpiNumber) ui.settingsNpiNumber.value = settings.npiNumber || "";
  if (ui.settingsTimezone) ui.settingsTimezone.value = settings.timezone || "";
  if (ui.settingsLanguage) ui.settingsLanguage.value = settings.language || "en";
  if (ui.settingsAddress) ui.settingsAddress.value = settings.address || "";
  if (ui.settingsBillingEmail) ui.settingsBillingEmail.value = settings.billingAlertEmail || "";
  if (ui.settingsEmailAlerts) ui.settingsEmailAlerts.checked = Boolean(settings.emailBillingAlerts);
};

const readGeneralSettingsForm = () => ({
  practiceName: String(ui.settingsPracticeName?.value || "").trim(),
  npiNumber: String(ui.settingsNpiNumber?.value || "").trim(),
  timezone: String(ui.settingsTimezone?.value || "").trim(),
  language: String(ui.settingsLanguage?.value || "en").trim(),
  address: String(ui.settingsAddress?.value || "").trim(),
  emailBillingAlerts: Boolean(ui.settingsEmailAlerts?.checked),
  billingAlertEmail: String(ui.settingsBillingEmail?.value || "").trim(),
});

const renderSettingsSummary = ({ report, compliance, generalSettings, integrations }) => {
  if (!ui.settingsSummary) return;

  const codebook = compliance?.codebook || {};
  const totals = report?.totals || {};
  ui.settingsSummary.innerHTML = `
    <div class="kv-row"><span class="kv-key">Practice Name</span><span class="kv-value">${escapeHtml(
      generalSettings?.practiceName || "-"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">NPI Number</span><span class="kv-value">${escapeHtml(
      generalSettings?.npiNumber || "-"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Codebook Version</span><span class="kv-value">${escapeHtml(
      codebook.version || "-"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Codebook Age</span><span class="kv-value">${escapeHtml(
      `${Number(codebook.ageDays || 0)} days`
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Realtime Streaming</span><span class="kv-value">${escapeHtml(
      compliance?.integrations?.realtimeStreamingConfigured ? "Enabled" : "Disabled"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Azure Speech</span><span class="kv-value">${escapeHtml(
      integrations?.azureSpeechConfigured ? "Configured" : "Not configured"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Azure Transcribe</span><span class="kv-value">${escapeHtml(
      integrations?.azureBlobConfigured ? "Configured" : "Not configured"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">OpenAI Analysis</span><span class="kv-value">${escapeHtml(
      integrations?.openAiConfigured ? "Configured" : "Not configured"
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Total Encounters</span><span class="kv-value">${escapeHtml(
      String(totals.encounters || 0)
    )}</span></div>
    <div class="kv-row"><span class="kv-key">Total Projected</span><span class="kv-value">${escapeHtml(
      formatCurrency(totals.totalProjectedRevenue || 0)
    )}</span></div>
  `;
};

const loadSettingsSummary = async () => {
  const [report, compliance, settingsPayload, _security] = await Promise.all([
    loadRevenueReport(),
    api("/api/compliance/status"),
    api("/api/settings/general"),
    load2faSettings(),
  ]);
  populateGeneralSettingsForm(settingsPayload.settings || {});
  renderSettingsSummary({
    report,
    compliance,
    generalSettings: settingsPayload.settings || {},
    integrations: settingsPayload.integrations || {},
  });
  state.loadedViewData.settings = true;
};

const saveGeneralSettings = async () => {
  const payload = await api("/api/settings/general", {
    method: "PUT",
    body: JSON.stringify(readGeneralSettingsForm()),
  });
  populateGeneralSettingsForm(payload.settings || {});
  if (ui.settingsSavedAt) {
    ui.settingsSavedAt.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
  }
  addLog("General settings updated.", "good");
  state.loadedViewData.settings = false;
};

const render2faSetupArtifacts = (setup) => {
  const secret = String(setup?.secret || "").trim();
  if (ui.settings2faSetupSecret) {
    ui.settings2faSetupSecret.textContent = secret ? `Setup secret: ${secret}` : "";
  }
  if (ui.settings2faSetupQr) {
    if (setup?.qrImageUrl) {
      ui.settings2faSetupQr.src = setup.qrImageUrl;
      ui.settings2faSetupQr.style.display = "block";
    } else {
      ui.settings2faSetupQr.removeAttribute("src");
      ui.settings2faSetupQr.style.display = "none";
    }
  }
};

const render2faSettings = (settings = {}) => {
  state.security2fa.settings = settings || {};
  const factors = Array.isArray(settings?.availableFactors) ? settings.availableFactors : [];
  const factorLabel = factors.length
    ? factors
        .map((item) => (String(item).toLowerCase() === "sms" ? "SMS" : "Authenticator"))
        .join(", ")
    : "None configured";

  if (ui.settings2faEnabled) ui.settings2faEnabled.checked = Boolean(settings?.mfaEnabled);
  if (ui.settings2faSmsEnabled) ui.settings2faSmsEnabled.checked = Boolean(settings?.sms2faEnabled);
  if (ui.settings2faStatus) {
    ui.settings2faStatus.innerHTML = `
      <div class="kv-row"><span class="kv-key">2FA Required</span><span class="kv-value">${escapeHtml(
        settings?.mfaEnabled ? "Enabled" : "Disabled"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Authenticator App</span><span class="kv-value">${escapeHtml(
        settings?.totpEnabled ? "Configured" : "Not configured"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">SMS Factor</span><span class="kv-value">${escapeHtml(
        settings?.sms2faEnabled
          ? `Enabled${settings?.phoneMasked ? ` (${settings.phoneMasked})` : ""}`
          : "Disabled"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Available Methods</span><span class="kv-value">${escapeHtml(
        factorLabel
      )}</span></div>
    `;
  }
};

const load2faSettings = async () => {
  const payload = await api("/api/settings/security/2fa");
  render2faSettings(payload.settings || {});
  if (payload.user) {
    state.auth.user = {
      ...(state.auth.user || {}),
      ...payload.user,
    };
    setAuthUserUi();
  }
  return payload;
};

const save2faSettings = async () => {
  const payload = await api("/api/settings/security/2fa", {
    method: "PUT",
    body: JSON.stringify({
      mfaEnabled: Boolean(ui.settings2faEnabled?.checked),
      sms2faEnabled: Boolean(ui.settings2faSmsEnabled?.checked),
    }),
  });
  render2faSettings(payload.settings || {});
  if (payload.user) {
    state.auth.user = {
      ...(state.auth.user || {}),
      ...payload.user,
    };
    setAuthUserUi();
  }
  if (ui.settings2faSavedAt) {
    ui.settings2faSavedAt.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
  }
  addLog("2FA settings updated.", "good");
};

const start2faSetup = async () => {
  const payload = await api("/api/settings/security/2fa/setup", {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.security2fa.setup = payload.setup || null;
  render2faSetupArtifacts(state.security2fa.setup);
  render2faSettings(payload.settings || state.security2fa.settings || {});
  if (payload.user) {
    state.auth.user = {
      ...(state.auth.user || {}),
      ...payload.user,
    };
    setAuthUserUi();
  }
  if (ui.settings2faSetupHint) {
    ui.settings2faSetupHint.textContent =
      "Scan QR in your authenticator app, enter a 6-digit code, then verify to enable 2FA.";
  }
  addLog("Authenticator setup created. Verify code to finish enabling 2FA.", "good");
};

const verify2faSetup = async () => {
  const code = String(ui.settings2faSetupCode?.value || "").trim();
  if (!code) {
    addLog("Enter a 6-digit authenticator code to verify setup.", "warn");
    return;
  }
  const payload = await api("/api/settings/security/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  render2faSettings(payload.settings || {});
  if (payload.user) {
    state.auth.user = {
      ...(state.auth.user || {}),
      ...payload.user,
    };
    setAuthUserUi();
  }
  if (ui.settings2faSetupCode) ui.settings2faSetupCode.value = "";
  if (ui.settings2faSetupHint) {
    ui.settings2faSetupHint.textContent = "Authenticator verified. 2FA is now enabled for login.";
  }
  if (ui.settings2faSavedAt) {
    ui.settings2faSavedAt.textContent = `Verified at ${new Date().toLocaleTimeString()}`;
  }
  addLog("Authenticator verified and 2FA enabled.", "good");
};

const renderSimplePills = (container, values, emptyText = "No items") => {
  if (!container) return;
  if (!Array.isArray(values) || !values.length) {
    container.innerHTML = `<span class="pill">${escapeHtml(emptyText)}</span>`;
    return;
  }
  container.innerHTML = values.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("");
};

const renderCodePillsWithEvidence = ({
  container,
  items = [],
  emptyText = "No items",
  keyPrefix = "code",
  subtitleBuilder = null,
  labelBuilder = null,
}) => {
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = `<span class="pill">${escapeHtml(emptyText)}</span>`;
    return;
  }

  for (const item of items) {
    const refs = Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : [];
    const code = String(item?.code || "").toUpperCase().trim();
    const confidence = Math.round(Number(item?.confidence || 0) * 100);
    const label = labelBuilder
      ? labelBuilder(item)
      : `${code || "CODE"} (${confidence}%) refs ${refs.length}`;
    const chip = document.createElement("span");
    chip.className = "pill";
    chip.textContent = label;

    bindEvidenceTrigger(chip, {
      title: `${code || "Code"} evidence`,
      subtitle:
        (typeof subtitleBuilder === "function"
          ? subtitleBuilder(item)
          : item?.mdmJustification || item?.rationale || item?.evidence || "") ||
        "Supporting transcript evidence",
      refs,
      evidenceKey: getEvidenceKey(keyPrefix, item),
    });

    container.appendChild(chip);
  }
};

const renderHipaaSettings = (payload) => {
  const hipaa = payload?.hipaa || {};
  state.hipaa.settings = hipaa;

  const templates = Array.isArray(hipaa.consentTemplates) ? hipaa.consentTemplates : [];
  renderSimplePills(
    ui.hipaaTemplatesList,
    templates.map((template) => `${template.name || "Template"} (${template.id || "-"})`),
    "No templates loaded"
  );

  if (ui.hipaaRetentionDays) {
    ui.hipaaRetentionDays.value = Number(hipaa.dataRetentionDays || 60);
  }
  setRecordingRetentionHint(hipaa.dataRetentionDays || 60);

  if (ui.hipaaRoleAccessJson) {
    ui.hipaaRoleAccessJson.value = JSON.stringify(hipaa.roleAccess || {}, null, 2);
  }

  if (ui.hipaaMaskPatientRef) {
    ui.hipaaMaskPatientRef.checked = Boolean(hipaa.phiMasking?.maskPatientReferenceInUi);
  }
  if (ui.hipaaMaskTranscriptExport) {
    ui.hipaaMaskTranscriptExport.checked = Boolean(hipaa.phiMasking?.maskTranscriptInExports);
  }

  renderSimplePills(
    ui.hipaaBaaDocsList,
    (hipaa.baaDocuments || []).map((item) => `${item.name} • ${formatDateTime(item.uploadedAt)}`),
    "No BAA documents yet"
  );

  if (ui.hipaaEncryptionStatus) {
    const status = hipaa.encryptionStatus || {};
    ui.hipaaEncryptionStatus.innerHTML = `
      <div class="kv-row"><span class="kv-key">At Rest</span><span class="kv-value">${escapeHtml(
        status.atRest || "-"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">In Transit</span><span class="kv-value">${escapeHtml(
        status.inTransit || "-"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Key Rotation</span><span class="kv-value">${escapeHtml(
        status.keyRotationEnabled ? "Enabled" : "Disabled"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">OpenAI</span><span class="kv-value">${escapeHtml(
        status.openAiConfigured ? "Configured" : "Not configured"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Azure Speech</span><span class="kv-value">${escapeHtml(
        status.azureSpeechConfigured ? "Configured" : "Not configured"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Azure Blob</span><span class="kv-value">${escapeHtml(
        status.azureBlobConfigured ? "Configured" : "Not configured"
      )}</span></div>
      <div class="kv-row"><span class="kv-key">Audit Hash Chain</span><span class="kv-value">${escapeHtml(
        status.auditHashChainEnabled ? "Enabled" : "Disabled"
      )}</span></div>
    `;
  }

  if (ui.hipaaSettingsContent) {
    ui.hipaaSettingsContent.innerHTML = `
      <h3>Compliance + Integration Snapshot</h3>
      <div class="kv-list">
        <div class="kv-row"><span class="kv-key">Retention Days</span><span class="kv-value">${escapeHtml(
          String(hipaa.dataRetentionDays || "-")
        )}</span></div>
        <div class="kv-row"><span class="kv-key">Consent Templates</span><span class="kv-value">${escapeHtml(
          String(templates.length)
        )}</span></div>
        <div class="kv-row"><span class="kv-key">BAA Documents</span><span class="kv-value">${escapeHtml(
          String((hipaa.baaDocuments || []).length)
        )}</span></div>
      </div>
    `;
  }

  renderAuditItems(ui.hipaaAuditLogList, payload?.recentAudit || [], "No audit records loaded.");
};

const loadHipaaSettings = async () => {
  const payload = await api("/api/hipaa/settings");
  renderHipaaSettings(payload || {});
  state.loadedViewData.hipaa = true;
};

const parseJsonSafe = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const saveHipaaPolicySettings = async () => {
  const current = state.hipaa.settings || {};
  const templates = Array.isArray(current.consentTemplates) ? [...current.consentTemplates] : [];
  const name = String(ui.hipaaTemplateName?.value || "").trim();
  const content = String(ui.hipaaTemplateContent?.value || "").trim();
  if (name && content) {
    templates.unshift({
      id: `template-${Date.now()}`,
      name,
      content,
    });
  }

  const dataRetentionDays = Number(ui.hipaaRetentionDays?.value || current.dataRetentionDays || 60);
  const payload = await api("/api/hipaa/settings", {
    method: "PUT",
    body: JSON.stringify({
      consentTemplates: templates.slice(0, 50),
      dataRetentionDays,
    }),
  });
  renderHipaaSettings({ hipaa: payload.hipaa, recentAudit: [] });
  if (ui.hipaaTemplateName) ui.hipaaTemplateName.value = "";
  if (ui.hipaaTemplateContent) ui.hipaaTemplateContent.value = "";
  addLog("HIPAA policy settings updated.", "good");
};

const saveHipaaAccessSettings = async () => {
  const current = state.hipaa.settings || {};
  const roleAccess = parseJsonSafe(
    String(ui.hipaaRoleAccessJson?.value || "{}"),
    current.roleAccess || {}
  );

  const payload = await api("/api/hipaa/settings", {
    method: "PUT",
    body: JSON.stringify({
      roleAccess,
      phiMasking: {
        maskPatientReferenceInUi: Boolean(ui.hipaaMaskPatientRef?.checked),
        maskTranscriptInExports: Boolean(ui.hipaaMaskTranscriptExport?.checked),
      },
    }),
  });
  renderHipaaSettings({ hipaa: payload.hipaa, recentAudit: [] });
  addLog("HIPAA access/masking settings updated.", "good");
};

const loadAuditLogs = async () => {
  const doctorRef = String(ui.hipaaAuditDoctorFilter?.value || "").trim();
  const query = new URLSearchParams();
  query.set("limit", "150");
  if (doctorRef) query.set("doctorRef", doctorRef);
  const payload = await api(`/api/audit/events?${query.toString()}`);
  renderAuditItems(ui.hipaaAuditLogList, payload.events || [], "No audit records loaded.");
};

const uploadBaaDocument = async () => {
  const file = ui.hipaaBaaFile?.files?.[0];
  if (!file) {
    addLog("Select a BAA document before upload.", "warn");
    return;
  }

  const form = new FormData();
  form.append("document", file);
  form.append("uploadedBy", String(ui.hipaaBaaUploader?.value || "system").trim() || "system");

  const response = await fetch("/api/hipaa/baa-documents", {
    method: "POST",
    headers: state.auth.token
      ? {
          Authorization: `Bearer ${state.auth.token}`,
        }
      : undefined,
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `BAA upload failed (${response.status})`);
  }

  renderHipaaSettings({ hipaa: payload.hipaa, recentAudit: [] });
  if (ui.hipaaBaaFile) ui.hipaaBaaFile.value = "";
  addLog("BAA document uploaded.", "good");
};

const setCodebookMeta = (status, count) => {
  if (!ui.codebookMeta) return;
  const version = status?.version || "-";
  const updated = status?.lastUpdated || "-";
  ui.codebookMeta.textContent = `Version ${version} - ${count} codes - Updated ${updated}`;
};

const setCodebookEditorState = (text) => {
  if (!ui.codebookEditorState) return;
  ui.codebookEditorState.textContent = text;
};

const clearCodebookEditor = () => {
  if (ui.codebookEditCode) ui.codebookEditCode.value = "";
  if (ui.codebookEditRate) ui.codebookEditRate.value = "";
  if (ui.codebookEditTitle) ui.codebookEditTitle.value = "";
  if (ui.codebookEditDocumentation) ui.codebookEditDocumentation.value = "";
  if (ui.codebookEditCompliance) ui.codebookEditCompliance.value = "";
  if (ui.saveCodebookBtn) ui.saveCodebookBtn.disabled = true;
  setCodebookEditorState("Select a CPT code to view or edit details.");
};

const setCodebookEditor = (code) => {
  const item = state.codebook.codes.find((entry) => entry.code === code);
  if (!item) {
    clearCodebookEditor();
    return;
  }
  state.codebook.selectedCode = item.code;

  if (ui.codebookEditCode) ui.codebookEditCode.value = item.code || "";
  if (ui.codebookEditRate) ui.codebookEditRate.value = Number(item.medicareRate || 0).toFixed(2);
  if (ui.codebookEditTitle) ui.codebookEditTitle.value = item.title || "";
  if (ui.codebookEditDocumentation) ui.codebookEditDocumentation.value = item.documentationNeeded || "";
  if (ui.codebookEditCompliance) ui.codebookEditCompliance.value = item.complianceNotes || "";
  if (ui.saveCodebookBtn) ui.saveCodebookBtn.disabled = false;

  setCodebookEditorState(`Editing ${item.code}`);
};

const renderCodebookTable = () => {
  if (!ui.codebookTableBody) return;

  const rowsHtml = (state.codebook.filteredCodes || [])
    .map((item) => {
      const activeClass = item.code === state.codebook.selectedCode ? " active" : "";
      return `
      <tr class="selectable${activeClass}" data-code="${escapeHtml(item.code)}">
        <td class="table-code-pill">${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.title || "-")}</td>
        <td>${escapeHtml(formatCurrency(item.medicareRate || 0))}</td>
      </tr>`;
    })
    .join("");

  renderTableBody(ui.codebookTableBody, rowsHtml, 3, "No codebook records found.");

  const rows = ui.codebookTableBody.querySelectorAll("tr[data-code]");
  for (const row of rows) {
    row.addEventListener("click", () => {
      const code = row.dataset.code;
      setCodebookEditor(code);
      renderCodebookTable();
    });
  }
};

const applyCodebookFilter = () => {
  const query = String(ui.codebookSearchInput?.value || "").trim().toLowerCase();
  if (!query) {
    state.codebook.filteredCodes = [...state.codebook.codes];
  } else {
    state.codebook.filteredCodes = state.codebook.codes.filter((item) => {
      const code = String(item.code || "").toLowerCase();
      const title = String(item.title || "").toLowerCase();
      const docs = String(item.documentationNeeded || "").toLowerCase();
      return code.includes(query) || title.includes(query) || docs.includes(query);
    });
  }
  renderCodebookTable();
};

const loadCodebook = async () => {
  const payload = await api("/api/codebook");
  const codebook = payload?.codebook || {};
  const codes = Array.isArray(codebook.codes) ? codebook.codes : [];

  state.codebook.meta = payload?.status || codebook.meta || null;
  state.codebook.codes = [...codes].sort((a, b) => String(a.code).localeCompare(String(b.code)));
  state.codebook.selectedCode = null;

  setCodebookMeta(state.codebook.meta, state.codebook.codes.length);
  applyCodebookFilter();
  clearCodebookEditor();
  await loadCodebookExtensions();
  state.loadedViewData.codebook = true;
};

const saveCodebook = async () => {
  const code = String(ui.codebookEditCode?.value || "").trim().toUpperCase();
  if (!code) {
    addLog("Please select a code before saving.", "warn");
    return;
  }

  const rate = Number(ui.codebookEditRate?.value);
  if (!Number.isFinite(rate) || rate < 0) {
    addLog("Medicare rate must be a non-negative number.", "warn");
    return;
  }

  const body = {
    title: String(ui.codebookEditTitle?.value || "").trim(),
    medicareRate: Number(rate.toFixed(2)),
    documentationNeeded: String(ui.codebookEditDocumentation?.value || "").trim(),
    complianceNotes: String(ui.codebookEditCompliance?.value || "").trim(),
  };

  const payload = await api(`/api/codebook/codes/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  const updated = payload?.code;
  if (!updated?.code) {
    throw new Error("Invalid codebook update response.");
  }

  const index = state.codebook.codes.findIndex((item) => item.code === updated.code);
  if (index >= 0) {
    state.codebook.codes[index] = updated;
  } else {
    state.codebook.codes.push(updated);
  }
  state.codebook.codes.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  state.codebook.meta = payload?.status || state.codebook.meta;

  applyCodebookFilter();
  setCodebookMeta(state.codebook.meta, state.codebook.codes.length);
  setCodebookEditor(updated.code);
  addLog(`CPT code ${updated.code} updated.`, "good");
};

const renderCodebookExtensionLists = () => {
  renderSimplePills(
    ui.customRulesList,
    (state.codebook.extensions.customRules || []).map(
      (rule) => `${rule.trigger} -> ${rule.suggestedCode}`
    ),
    "No rules yet"
  );
  renderSimplePills(
    ui.bundlingRulesList,
    (state.codebook.extensions.bundlingRules || []).map(
      (rule) => `${rule.primaryCode} x ${rule.blockedWithCode}`
    ),
    "No bundling rules yet"
  );
};

const loadCodebookExtensions = async () => {
  const payload = await api("/api/codebook/extensions");
  const extensions = payload?.extensions || {};
  state.codebook.extensions = {
    favoriteCodesByDoctor: extensions.favoriteCodesByDoctor || {},
    payerFeeSchedules: extensions.payerFeeSchedules || {},
    customRules: Array.isArray(extensions.customRules) ? extensions.customRules : [],
    bundlingRules: Array.isArray(extensions.bundlingRules) ? extensions.bundlingRules : [],
  };

  if (ui.codebookFavoriteDoctorRef && !ui.codebookFavoriteDoctorRef.value.trim()) {
    ui.codebookFavoriteDoctorRef.value = String(ui.prefDoctorRef?.value || "default").trim() || "default";
  }

  const doctorRef = String(ui.codebookFavoriteDoctorRef?.value || "").trim();
  const selectedDoctorRef = doctorRef || "default";
  const favorites = state.codebook.extensions.favoriteCodesByDoctor?.[selectedDoctorRef] || [];
  if (ui.codebookFavoriteCodes) ui.codebookFavoriteCodes.value = favorites.join(", ");

  if (ui.codebookPayerScheduleJson) {
    ui.codebookPayerScheduleJson.value = JSON.stringify(
      state.codebook.extensions.payerFeeSchedules || {},
      null,
      2
    );
  }

  renderCodebookExtensionLists();
};

const saveCodebookExtensions = async () => {
  const doctorRef = String(ui.codebookFavoriteDoctorRef?.value || "").trim() || "default";
  const favoriteCodes = String(ui.codebookFavoriteCodes?.value || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  let payerFeeSchedules = state.codebook.extensions.payerFeeSchedules || {};
  const rawPayerJson = String(ui.codebookPayerScheduleJson?.value || "").trim();
  if (rawPayerJson) {
    payerFeeSchedules = JSON.parse(rawPayerJson);
  }

  const nextExtensions = {
    ...state.codebook.extensions,
    favoriteCodesByDoctor: {
      ...(state.codebook.extensions.favoriteCodesByDoctor || {}),
      [doctorRef]: favoriteCodes,
    },
    payerFeeSchedules,
  };

  const payload = await api("/api/codebook/extensions", {
    method: "PUT",
    body: JSON.stringify(nextExtensions),
  });
  state.codebook.extensions = payload.extensions || nextExtensions;
  renderCodebookExtensionLists();
  if (ui.codebookExtensionsStatus) {
    ui.codebookExtensionsStatus.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
  }
  addLog("Codebook extensions updated.", "good");
};

const addCustomRule = async () => {
  const trigger = String(ui.codebookRuleTrigger?.value || "").trim();
  const suggestedCode = String(ui.codebookRuleCode?.value || "").trim().toUpperCase();
  const note = String(ui.codebookRuleNote?.value || "").trim();
  if (!trigger || !suggestedCode) {
    addLog("Custom rule requires trigger and suggested code.", "warn");
    return;
  }

  const rules = Array.isArray(state.codebook.extensions.customRules)
    ? state.codebook.extensions.customRules
    : [];
  rules.push({ trigger, suggestedCode, note });
  state.codebook.extensions.customRules = rules;
  await saveCodebookExtensions();

  if (ui.codebookRuleTrigger) ui.codebookRuleTrigger.value = "";
  if (ui.codebookRuleCode) ui.codebookRuleCode.value = "";
  if (ui.codebookRuleNote) ui.codebookRuleNote.value = "";
};

const addBundlingRule = async () => {
  const primaryCode = String(ui.codebookBundlePrimary?.value || "").trim().toUpperCase();
  const blockedWithCode = String(ui.codebookBundleBlocked?.value || "").trim().toUpperCase();
  const reason = String(ui.codebookBundleReason?.value || "").trim();
  if (!primaryCode || !blockedWithCode) {
    addLog("Bundling rule requires both CPT codes.", "warn");
    return;
  }

  const rules = Array.isArray(state.codebook.extensions.bundlingRules)
    ? state.codebook.extensions.bundlingRules
    : [];
  rules.push({ primaryCode, blockedWithCode, reason });
  state.codebook.extensions.bundlingRules = rules;
  await saveCodebookExtensions();

  if (ui.codebookBundlePrimary) ui.codebookBundlePrimary.value = "";
  if (ui.codebookBundleBlocked) ui.codebookBundleBlocked.value = "";
  if (ui.codebookBundleReason) ui.codebookBundleReason.value = "";
};

const setActiveView = async (view, { forceReload = false } = {}) => {
  if (!state.auth.user) return;
  if (!viewTitles[view]) return;
  if (Array.isArray(state.allowedViews) && state.allowedViews.length) {
    if (!state.allowedViews.includes(view)) {
      view = state.allowedViews[0] || "live";
    }
  }

  state.currentView = view;
  if (ui.currentViewLabel) {
    ui.currentViewLabel.textContent = viewTitles[view];
  }

  for (const item of ui.navItems) {
    item.classList.toggle("active", item.dataset.view === view);
  }

  for (const panel of ui.viewPanels) {
    panel.classList.toggle("active", panel.id === `view-${view}`);
  }

  if (view === "past" && (forceReload || !state.loadedViewData.past)) {
    await loadPastEncounters();
  }
  if (view === "billing" && (forceReload || !state.loadedViewData.billing)) {
    await loadBillingQueue();
  }
  if (view === "revenue") {
    const prefs = readPreferences();
    if (forceReload || !state.loadedViewData.revenue || prefs.autoRefreshReports) {
      await loadRevenueReport();
    }
  }
  if (view === "settings" && (forceReload || !state.loadedViewData.settings)) {
    await loadSettingsSummary();
  }
  if (view === "hipaa" && (forceReload || !state.loadedViewData.hipaa)) {
    await loadHipaaSettings();
    await loadAuditLogs();
  }
  if (view === "codebook" && (forceReload || !state.loadedViewData.codebook)) {
    await loadCodebook();
  }
};

const formatGuidanceText = (guidanceItems) => {
  if (!Array.isArray(guidanceItems) || guidanceItems.length === 0) {
    return "";
  }
  return guidanceItems
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.text || item.prompt || ""}`)
    .join(" | ");
};

const summarizeAssistantUpdate = ({
  suggestions = [],
  guidanceItems = [],
  model,
  tracker,
  missedBillables = [],
  documentationGaps = [],
}) => {
  const prefix = model ? `AI analysis (${model})` : "Assistant";
  const codePart = suggestions.length
    ? `Codes: ${suggestions
        .slice(0, 3)
        .map((s) => `${s.code}: ${s.rationale || "supported"}`)
        .join(" | ")}`
    : "Codes: no new compliant code detected.";

  const guidanceText = formatGuidanceText(guidanceItems);
  const guidancePart = guidanceText
    ? `AI prompts: ${guidanceText}`
    : "AI prompts: continue collecting encounter details (duration, severity, and plan).";

  const missedPart = missedBillables.length
    ? `Missed billables: ${missedBillables
        .slice(0, 2)
        .map((item) => item.potentialCode)
        .join(", ")}`
    : "Missed billables: none flagged.";

  const gapPart = documentationGaps.length
    ? `Documentation gaps: ${documentationGaps.length}`
    : "Documentation gaps: none major.";

  const currentRevenue = tracker?.currentCodesRevenue ?? tracker?.baseline ?? 0;
  const suggestedRevenue = tracker?.suggestedCodesRevenue ?? tracker?.compliantOpportunity ?? 0;
  const revenuePart = `Current codes: $${safeNumber(currentRevenue)}. Suggested potential: $${safeNumber(
    suggestedRevenue
  )}`;

  return `${prefix}: ${codePart} ${guidancePart} ${missedPart} ${gapPart} ${revenuePart}`;
};

const applyAnalysisPayload = (payload) => {
  if (!payload) return;

  const transcriptCount = Number(payload.transcriptCount || 0);
  const isNewest = transcriptCount > state.lastServerTranscriptCount;
  if (!isNewest) return;

  state.lastServerTranscriptCount = transcriptCount;
  if (payload.processedSegment) {
    storeTranscriptSegment(payload.processedSegment);
  }
  state.chartNotes = Array.isArray(payload.chartNotes) ? payload.chartNotes : [];
  renderChartNotes(state.chartNotes);
  renderSuggestions(payload.allSuggestions || []);
  renderRevenueTracker(payload.revenueTracker || {});
  renderGuidance(payload.documentation?.improvements || []);
  renderBillableCodes(payload.revenueTracker?.billableCodes || []);

  addAssistantMessage(
    summarizeAssistantUpdate({
      suggestions: payload.newlyAddedSuggestions || [],
      guidanceItems: payload.documentation?.improvements || [],
      model: payload.analysis?.model,
      tracker: payload.revenueTracker,
      missedBillables: payload.missedBillables || [],
      documentationGaps: payload.documentation?.gaps || [],
    })
  );

  if (payload.analysis?.mode === "rule-engine+openai") {
    addLog(`Analyzed by ${payload.analysis.model || "OpenAI"}`, "good");
  } else if (payload.analysis?.mode === "rule-engine-throttled") {
    const now = Date.now();
    if (now - state.lastThrottleLogAt > 15000) {
      addLog("AI analysis throttled for faster live transcript updates.", "info");
      state.lastThrottleLogAt = now;
    }
  }
};

const submitTranscriptSegment = async (text, source) => {
  if (!state.appointment) return null;

  const payload = await api(`/api/appointments/${state.appointment.id}/transcript`, {
    method: "POST",
    body: JSON.stringify({ segment: text, source }),
  });
  if (payload.processedSegment) {
    storeTranscriptSegment(payload.processedSegment);
  }
  applyAnalysisPayload(payload);
  return payload;
};

const startSuggestionStream = () => {
  if (!state.appointment) return;
  closeSuggestionStream();

  const suffix = state.auth.token ? `?accessToken=${encodeURIComponent(state.auth.token)}` : "";
  const stream = new EventSource(`/api/appointments/${state.appointment.id}/stream${suffix}`);
  stream.addEventListener("analysis.update", (event) => {
    const payload = JSON.parse(event.data || "{}");
    applyAnalysisPayload(payload);
  });
  stream.addEventListener("transcript.accepted", (event) => {
    const payload = JSON.parse(event.data || "{}");
    if (payload.segment) {
      storeTranscriptSegment(payload.segment);
    }
  });
  stream.addEventListener("transcript.partial", (event) => {
    const payload = JSON.parse(event.data || "{}");
    const text = String(payload.partialText || "").trim();
    if (text) setInterimTranscript(payload.provider || "stt-partial", text);
  });
  stream.onerror = () => {
    addLog("Live analysis stream disconnected; continuing with direct sync.", "warn");
    closeSuggestionStream();
  };

  state.suggestionStream = stream;
};

const shouldSkipDuplicateSegment = (text) => {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return true;

  const now = Date.now();
  const isDuplicate =
    normalized === state.lastTranscriptNormalized && now - state.lastTranscriptAt < 7000;
  if (isDuplicate) return true;

  state.lastTranscriptNormalized = normalized;
  state.lastTranscriptAt = now;
  return false;
};

const syncTranscriptSubmission = async ({ text, source }) => {
  try {
    const payload = await submitTranscriptSegment(text, source);
    if (!payload) return;

    const processed = payload.processedSegment || {
      source,
      rawText: text,
      cleanedText: text,
      quality: { confidence: 0.5, method: "fallback" },
    };

    const raw = String(processed.rawText || "").trim().toLowerCase();
    const cleaned = String(processed.cleanedText || "").trim().toLowerCase();
    if (raw && cleaned && raw !== cleaned) {
      addLog("Transcript auto-cleanup applied for noisy ASR text.", "good");
    }
  } catch (error) {
    addLog(`Transcript submission failed: ${error.message}`, "warn");
  }
};

const handleTranscriptSegment = (text, source) => {
  if (shouldSkipDuplicateSegment(text)) return;
  clearInterimTranscript();
  syncTranscriptSubmission({ text, source });
};

const startAzureSpeech = async () => {
  if (!window.SpeechSDK) return false;

  try {
    const tokenData = await api("/api/azure/speech-token");
    if (!tokenData.configured || !tokenData.token || !tokenData.region) {
      addLog("Azure Speech not configured; using browser fallback.", "warn");
      return false;
    }

    const speechConfig = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(
      tokenData.token,
      tokenData.region
    );
    speechConfig.speechRecognitionLanguage = "en-US";
    const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (_sender, event) => {
      if (event.result.reason === window.SpeechSDK.ResultReason.RecognizingSpeech) {
        const partial = event.result.text?.trim();
        if (partial) setInterimTranscript("azure-live", partial);
      }
    };

    recognizer.recognized = (_sender, event) => {
      if (event.result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = event.result.text?.trim();
        if (text) {
          clearInterimTranscript();
          handleTranscriptSegment(text, "azure-live");
        }
      }
    };

    recognizer.canceled = (_sender, event) => {
      addLog(`Azure recognizer canceled: ${event.errorDetails || event.reason}`, "warn");
    };

    recognizer.startContinuousRecognitionAsync();
    state.speechRecognizer = recognizer;
    addLog("Azure speech recognition started.", "good");
    return true;
  } catch (error) {
    addLog(`Azure speech failed: ${error.message}`, "warn");
    return false;
  }
};

const startBrowserSpeechFallback = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addLog("No speech recognition available in this browser.", "warn");
    return false;
  }

  const recognizer = new SpeechRecognition();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;
  recognizer.lang = "en-US";

  recognizer.onresult = (event) => {
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript?.trim();
      if (!text) continue;

      if (result.isFinal) {
        clearInterimTranscript();
        handleTranscriptSegment(text, "browser-fallback");
      } else {
        interimText += `${text} `;
      }
    }

    if (interimText.trim()) {
      setInterimTranscript("browser-fallback", interimText.trim());
    }
  };

  recognizer.onerror = (event) => addLog(`Speech fallback error: ${event.error}`, "warn");
  recognizer.onend = () => {
    if (!state.encounterActive) return;
    try {
      recognizer.start();
    } catch {
      addLog("Browser fallback recognizer restart failed.", "warn");
    }
  };

  recognizer.start();
  state.browserRecognizer = recognizer;
  addLog("Browser speech fallback started.", "good");
  return true;
};

const startRecording = () => {
  if (!state.micStream) return;
  state.recordingChunks = [];
  const preferredMimeType =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.("audio/webm")
      ? "audio/webm"
      : "";
  const recorder = preferredMimeType
    ? new MediaRecorder(state.micStream, { mimeType: preferredMimeType })
    : new MediaRecorder(state.micStream);

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.recordingChunks.push(event.data);
    }
  };

  recorder.start(1000);
  state.mediaRecorder = recorder;
  ui.waveform?.classList.add("active");
  setTranscriptBadge("Recording", true);
  addLog("Encounter recording started.", "good");
};

const stopRecordingAndUpload = async () => {
  if (!state.mediaRecorder || !state.appointment) return;

  await new Promise((resolve) => {
    state.mediaRecorder.onstop = resolve;
    state.mediaRecorder.stop();
  });

  const blob = new Blob(state.recordingChunks, { type: "audio/webm" });
  if (!blob.size) return;

  const form = new FormData();
  form.append("audio", blob, `${state.appointment.id}.webm`);
  const response = await fetch(`/api/appointments/${state.appointment.id}/audio`, {
    method: "POST",
    headers: state.auth.token
      ? {
          Authorization: `Bearer ${state.auth.token}`,
        }
      : undefined,
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Audio upload failed (${response.status})`);
  }

  const uploaded = await response.json();
  const expiresAt = String(uploaded?.recording?.retentionExpiresAt || "").trim();
  const retentionLabel = expiresAt
    ? ` Retained until ${formatDateTime(expiresAt)}.`
    : "";
  addLog(`Recording uploaded to ${uploaded.recording.provider}.${retentionLabel}`, "good");
};

const resetEncounterPanels = () => {
  state.backgroundTranscriptSegments = [];
  state.chartNotes = [];
  state.interimTranscriptText = "";
  closeEvidenceDrawer();
  ui.transcriptFeed.innerHTML = emptyStateHtml(
    state.encounterActive
      ? "Listening and drafting chart notes while the transcript saves in the background"
      : "AI chart notes appear here during encounter"
  );
  ui.chatFeed.innerHTML = emptyStateHtml("Assistant analysis will appear here");
  if (ui.guidanceBadge) ui.guidanceBadge.textContent = "Editable";
  ui.suggestionList.innerHTML = emptyStateHtml("Assistant code suggestions surface as encounter progresses");
  ui.billableCodesList.innerHTML = emptyStateHtml("No suggested codes logged yet");

  if (ui.cptBadge) ui.cptBadge.textContent = "0 codes";
  if (ui.billableCount) ui.billableCount.textContent = "0 items";
  setNoteContentToUi({
    sections: { hpi: "", ros: "", exam: "", assessment: "", plan: "" },
    additionalProviderNotes: "",
    freeTextAdditions: "",
  });
  renderNoteCoding(null);
  renderNoteVersions([]);
};

const startEncounter = async () => {
  if (!["provider", "admin"].includes(state.auth.user?.role || "")) {
    addLog("Only provider/admin users can start encounters.", "warn");
    return;
  }
  if (!ui.consentGiven.checked) {
    alert("Intake consent form must be signed before recording.");
    return;
  }

  const doctorRef = String(state.auth.user?.username || "").trim();
  const patientRef = ui.patientRef.value.trim() || "anonymous";
  const consentFormId = ui.consentFormId.value.trim();
  const encounterMode = String(ui.encounterMode?.value || "in-person").trim().toLowerCase();
  const telehealthPlatform =
    encounterMode === "telehealth"
      ? String(ui.telehealthPlatform?.value || "generic").trim().toLowerCase()
      : "";

  if (!doctorRef) {
    alert("Doctor reference is required.");
    return;
  }

  if (!consentFormId) {
    alert("Consent Form ID is required.");
    return;
  }

  const created = await api("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      doctorRef,
      patientRef,
      consentFormId,
      consentSignedAt: new Date().toISOString(),
      insurancePlan: ui.insurancePlan.value,
      visitType: ui.visitType.value,
      encounterMode,
      telehealthPlatform,
      consentGiven: true,
    }),
  });

  state.appointment = created.appointment;
  state.selectedPatientProfile = normalizePatientProfile(
    created?.appointment?.patientProfile || {},
    created?.appointment?.patientRef || patientRef
  );
  renderPatientHeader({
    patientProfile: state.selectedPatientProfile,
    insurancePlan: created?.appointment?.insurancePlan || ui.insurancePlan?.value || "",
  });
  state.encounterActive = true;
  state.lastTranscriptNormalized = "";
  state.lastTranscriptAt = 0;
  state.lastServerTranscriptCount = 0;
  state.lastAssistantMessage = "";
  state.lastThrottleLogAt = 0;
  state.noteEditor.loaded = false;
  state.noteEditor.note = null;
  state.noteEditor.codingAnalysis = null;
  state.noteEditor.finalEditorTouched = false;
  clearInterimTranscript();

  resetEncounterPanels();
  renderRevenueTracker({
    baseline: 0,
    compliantOpportunity: 0,
    currentCodesRevenue: 0,
    suggestedCodesRevenue: 0,
    earnedNow: 0,
    projectedTotal: 0,
    projectedRevenueWithSuggestions: 0,
    payerMultiplier: 1,
    billableCodes: [],
  });

  addLog(
    `Doctor ${doctorRef} started ${encounterMode}${telehealthPlatform ? ` (${telehealthPlatform})` : ""} appointment ${state.appointment.id}.`,
    "good"
  );
  setSessionUiState({
    active: true,
    text: ui.sessionBadge ? `Live: ${state.appointment.id}` : "Session Live",
  });
  startSuggestionStream();
  loadAppointmentNote(state.appointment.id).catch((error) =>
    addLog(`Unable to load note draft: ${error.message}`, "warn")
  );

  state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const azureStarted = await startAzureSpeech();
  if (!azureStarted) {
    startBrowserSpeechFallback();
  }
  startRecording();
  setTranscriptBadge("Listening", true);

  ui.startBtn.disabled = true;
  ui.stopBtn.disabled = false;
};

const stopEncounter = async () => {
  ui.stopBtn.disabled = true;
  state.encounterActive = false;
  clearInterimTranscript();
  closeSuggestionStream();

  if (state.speechRecognizer) {
    state.speechRecognizer.stopContinuousRecognitionAsync(
      () => addLog("Azure speech stopped."),
      (error) => addLog(`Error stopping Azure speech: ${error}`, "warn")
    );
    state.speechRecognizer = null;
  }

  if (state.browserRecognizer) {
    state.browserRecognizer.stop();
    state.browserRecognizer = null;
    addLog("Browser fallback speech stopped.");
  }

  try {
    await stopRecordingAndUpload();
  } catch (error) {
    addLog(error.message, "warn");
  }

  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = null;
  }

  ui.waveform?.classList.remove("active");
  setTranscriptBadge("Stopped", false);
  closeEvidenceDrawer();

  setSessionUiState({
    active: false,
    text: ui.sessionBadge ? "Session Idle" : "Session Ended",
  });
  ui.startBtn.disabled = false;
  addLog("Encounter ended.");

  if (state.appointment?.id) {
    loadAppointmentNote(state.appointment.id, { includeVersions: true }).catch((error) =>
      addLog(`Unable to refresh merged final notes: ${error.message}`, "warn")
    );
  }

  const prefs = readPreferences();
  if (prefs.autoOpenPastAfterStop) {
    setActiveView("past", { forceReload: true }).catch((error) =>
      addLog(`Unable to open Past Encounters: ${error.message}`, "warn")
    );
  }
};

const bindNavigation = () => {
  for (const item of ui.navItems) {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const view = item.dataset.view;
      setActiveView(view).catch((error) => addLog(`Unable to open ${view}: ${error.message}`, "warn"));
    });
  }

  for (const button of ui.jumpViewButtons) {
    button.addEventListener("click", () => {
      const view = button.dataset.jumpView;
      setActiveView(view).catch((error) => addLog(`Unable to open ${view}: ${error.message}`, "warn"));
    });
  }

  ui.refreshPastBtn?.addEventListener("click", () => {
    loadPastEncounters().catch((error) => addLog(`Past encounters refresh failed: ${error.message}`, "warn"));
  });
  ui.applyPastFiltersBtn?.addEventListener("click", () => {
    loadPastEncounters().catch((error) => addLog(`Past encounter filter failed: ${error.message}`, "warn"));
  });

  ui.refreshRevenueBtn?.addEventListener("click", () => {
    loadRevenueReport().catch((error) => addLog(`Revenue report refresh failed: ${error.message}`, "warn"));
  });
  ui.refreshBillingQueueBtn?.addEventListener("click", () => {
    loadBillingQueue().catch((error) => addLog(`Billing queue refresh failed: ${error.message}`, "warn"));
  });
  ui.applyReportFiltersBtn?.addEventListener("click", () => {
    loadRevenueReport().catch((error) => addLog(`Revenue report filter failed: ${error.message}`, "warn"));
  });
  ui.exportRevenueCsvBtn?.addEventListener("click", () => {
    exportRevenueCsv();
  });

  ui.refreshHipaaBtn?.addEventListener("click", () => {
    Promise.all([loadHipaaSettings(), loadAuditLogs()]).catch((error) =>
      addLog(`HIPAA status refresh failed: ${error.message}`, "warn")
    );
  });

  ui.refreshAuditLogsBtn?.addEventListener("click", () => {
    loadAuditLogs().catch((error) => addLog(`Audit log refresh failed: ${error.message}`, "warn"));
  });

  ui.saveSettingsBtn?.addEventListener("click", () => {
    saveGeneralSettings().catch((error) => addLog(`Settings save failed: ${error.message}`, "warn"));
  });
  ui.save2faSettingsBtn?.addEventListener("click", () => {
    save2faSettings().catch((error) => addLog(`2FA settings save failed: ${error.message}`, "warn"));
  });
  ui.settings2faSetupBtn?.addEventListener("click", () => {
    start2faSetup().catch((error) => addLog(`2FA setup failed: ${error.message}`, "warn"));
  });
  ui.settings2faVerifyBtn?.addEventListener("click", () => {
    verify2faSetup().catch((error) => addLog(`2FA verification failed: ${error.message}`, "warn"));
  });

  ui.saveHipaaSettingsBtn?.addEventListener("click", () => {
    saveHipaaPolicySettings().catch((error) => addLog(`HIPAA policy save failed: ${error.message}`, "warn"));
  });

  ui.saveHipaaAccessBtn?.addEventListener("click", () => {
    saveHipaaAccessSettings().catch((error) => addLog(`HIPAA access save failed: ${error.message}`, "warn"));
  });

  ui.uploadBaaBtn?.addEventListener("click", () => {
    uploadBaaDocument().catch((error) => addLog(`BAA upload failed: ${error.message}`, "warn"));
  });
};

const bindPreferences = () => {
  applyPreferencesToUi(readPreferences());

  ui.prefCompactTables?.addEventListener("change", () => {
    setCompactTableMode(Boolean(ui.prefCompactTables?.checked));
  });

  ui.savePreferencesBtn?.addEventListener("click", async () => {
    const prefs = readPreferencesFromUi();
    writePreferences(prefs);
    applyPreferencesToUi(prefs);

    try {
      await api("/api/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      addLog(`Preferences API save failed: ${error.message}`, "warn");
    }

    if (ui.preferencesStatus) ui.preferencesStatus.textContent = "Preferences saved";
    if (ui.preferencesSavedAt) {
      ui.preferencesSavedAt.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
    }

    addLog("Preferences updated.", "good");
  });

  ui.loadPreferencesBtn?.addEventListener("click", async () => {
    const doctorRef = String(ui.prefDoctorRef?.value || "default").trim() || "default";
    try {
      const payload = await api(`/api/preferences?doctorRef=${encodeURIComponent(doctorRef)}`);
      const merged = {
        ...readPreferences(),
        ...payload.preferences,
        doctorRef,
      };
      writePreferences(merged);
      applyPreferencesToUi(merged);
      if (ui.preferencesStatus) ui.preferencesStatus.textContent = "Preferences loaded";
      addLog(`Preferences loaded for ${doctorRef}.`, "good");
    } catch (error) {
      addLog(`Preferences load failed: ${error.message}`, "warn");
    }
  });
};

const bindCodebook = () => {
  clearCodebookEditor();

  ui.refreshCodebookBtn?.addEventListener("click", () => {
    loadCodebook().catch((error) => addLog(`Codebook refresh failed: ${error.message}`, "warn"));
  });

  ui.codebookSearchInput?.addEventListener("input", () => {
    applyCodebookFilter();
  });

  ui.saveCodebookBtn?.addEventListener("click", () => {
    saveCodebook().catch((error) => addLog(`Codebook save failed: ${error.message}`, "warn"));
  });

  ui.saveCodebookExtensionsBtn?.addEventListener("click", () => {
    saveCodebookExtensions().catch((error) =>
      addLog(`Codebook extension save failed: ${error.message}`, "warn")
    );
  });

  ui.addCustomRuleBtn?.addEventListener("click", () => {
    addCustomRule().catch((error) => addLog(`Unable to add custom rule: ${error.message}`, "warn"));
  });

  ui.addBundlingRuleBtn?.addEventListener("click", () => {
    addBundlingRule().catch((error) => addLog(`Unable to add bundling rule: ${error.message}`, "warn"));
  });

  ui.codebookFavoriteDoctorRef?.addEventListener("change", () => {
    const doctorRef = String(ui.codebookFavoriteDoctorRef.value || "default").trim() || "default";
    const favorites = state.codebook.extensions.favoriteCodesByDoctor?.[doctorRef] || [];
    if (ui.codebookFavoriteCodes) ui.codebookFavoriteCodes.value = favorites.join(", ");
  });
};

const completeAuthSession = (payload = {}) => {
  writeAuthToken(payload.token || "");
  state.auth.user = payload.user || null;
  state.auth.challengeId = "";
  if (ui.authPassword) ui.authPassword.value = "";
  if (ui.authTotpCode) ui.authTotpCode.value = "";
  if (ui.auth2faBlock) ui.auth2faBlock.style.display = "none";
  if (ui.authSetupSecret) ui.authSetupSecret.textContent = "";
  if (ui.authSetupQr) {
    ui.authSetupQr.removeAttribute("src");
    ui.authSetupQr.style.display = "none";
  }
  if (ui.authSmsHint) ui.authSmsHint.textContent = "";
  setAuthOverlayOpen(false);
  setAuthUserUi();
  applyUserContextToEncounterForm();
  applyRoleViewAccess();
  resetLoadedViews();
  initializeViews();
  setAuthError("");
};

const handlePasswordAuth = async () => {
  const username = String(ui.authUsername?.value || "").trim().toLowerCase();
  const password = String(ui.authPassword?.value || "");
  if (!username || !password) {
    setAuthError("Username and password are required.");
    return;
  }

  const payload = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      clientId: state.clientLandingId || undefined,
    }),
  });

  if (payload?.token && payload?.user) {
    completeAuthSession(payload);
    return;
  }

  state.auth.challengeId = payload.challengeId || "";
  state.auth.availableFactors = Array.isArray(payload.availableFactors) && payload.availableFactors.length
    ? payload.availableFactors
    : ["totp"];
  state.auth.preferredFactor = String(payload.preferredFactor || "totp").toLowerCase();
  if (!state.auth.challengeId) {
    throw new Error("Missing 2FA challenge from server.");
  }

  if (ui.auth2faBlock) ui.auth2faBlock.style.display = "block";
  if (ui.authFactorMethod) {
    const available = state.auth.availableFactors;
    const selected = available.includes(state.auth.preferredFactor)
      ? state.auth.preferredFactor
      : available[0] || "totp";
    ui.authFactorMethod.innerHTML = available
      .map((method) => {
        if (method === "sms") return '<option value="sms">Text Message (SMS)</option>';
        return '<option value="totp">Authenticator App</option>';
      })
      .join("");
    ui.authFactorMethod.value = selected;
  }
  if (ui.authSendSmsBtn) {
    ui.authSendSmsBtn.disabled = !state.auth.availableFactors.includes("sms");
  }
  if (ui.authSetupHint) {
    const selectedFactor = String(ui.authFactorMethod?.value || state.auth.preferredFactor || "totp")
      .toLowerCase();
    ui.authSetupHint.textContent =
      selectedFactor === "sms"
        ? "Request a text code, then enter the 6-digit SMS code."
        : "Enter your 6-digit authenticator code.";
  }
  if (ui.authSetupSecret) {
    ui.authSetupSecret.textContent = payload.setup?.secret
      ? `Setup secret: ${payload.setup.secret}`
      : "";
  }
  if (ui.authSetupQr) {
    if (payload.setup?.qrImageUrl) {
      ui.authSetupQr.src = payload.setup.qrImageUrl;
      ui.authSetupQr.style.display = "block";
    } else {
      ui.authSetupQr.removeAttribute("src");
      ui.authSetupQr.style.display = "none";
    }
  }
  if (ui.authSmsHint) {
    ui.authSmsHint.textContent = "";
  }
  if (ui.authFactorMethod?.value === "sms") {
    await sendSms2faCode().catch(() => {});
  }
  setAuthError("");
};

const sendSms2faCode = async () => {
  if (!state.auth.challengeId) {
    setAuthError("Start login first to request a text code.");
    return;
  }
  if (!state.auth.availableFactors.includes("sms")) {
    setAuthError("SMS factor is not enabled for this account.");
    return;
  }
  const payload = await api("/api/auth/2fa/sms/send", {
    method: "POST",
    body: JSON.stringify({
      challengeId: state.auth.challengeId,
    }),
  });
  if (ui.authSmsHint) {
    const devPart = payload.devCode ? ` (dev code: ${payload.devCode})` : "";
    ui.authSmsHint.textContent = `Text code sent to ${payload.destination || "your phone"}${devPart}`;
  }
  if (ui.authFactorMethod && state.auth.availableFactors.includes("sms")) {
    ui.authFactorMethod.value = "sms";
  }
};

const handle2faAuth = async () => {
  const method = String(ui.authFactorMethod?.value || state.auth.preferredFactor || "totp")
    .trim()
    .toLowerCase();
  const code = String(ui.authTotpCode?.value || "").trim();
  if (!state.auth.challengeId || !code) {
    setAuthError("Enter the 2FA code to continue.");
    return;
  }

  const payload = await api("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({
      challengeId: state.auth.challengeId,
      code,
      method,
    }),
  });
  completeAuthSession(payload);
};

const loadSessionUser = async () => {
  const token = readAuthToken();
  if (!token) return false;
  writeAuthToken(token);
  try {
    const payload = await api("/api/auth/me");
    state.auth.user = payload.user || null;
    setAuthUserUi();
    applyUserContextToEncounterForm();
    applyRoleViewAccess();
    return Boolean(state.auth.user);
  } catch {
    clearAuthState();
    resetLoadedViews();
    setAuthUserUi();
    return false;
  }
};

const logout = async () => {
  try {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {}
  clearAuthState();
  resetLoadedViews();
  setAuthUserUi();
  applyRoleViewAccess();
  setAuthOverlayOpen(true);
  setAuthError("Signed out. Please login again.");
};

const bindNoteEditor = () => {
  ui.recalculateNoteBtn?.addEventListener("click", () => {
    recalculateNoteDraft().catch((error) =>
      addLog(`Recalculate failed: ${error.message}`, "warn")
    );
  });

  ui.saveNoteDraftBtn?.addEventListener("click", () => {
    saveNoteDraft().catch((error) => addLog(`Save draft failed: ${error.message}`, "warn"));
  });

  ui.finalizeNoteBtn?.addEventListener("click", () => {
    saveNoteDraft({ silent: true })
      .then(() => finalizeCurrentNote())
      .catch((error) => {
        if (String(error.message || "").includes("Re-authentication required")) {
          setAuthOverlayOpen(true);
          setAuthError("Re-authenticate with 2FA to finalize note.");
        } else {
          addLog(`Finalize failed: ${error.message}`, "warn");
        }
      });
  });

  const autosaveInputs = [
    ui.manualDoctorNotesInput,
    ui.noteFinalMergedEditor,
  ];

  for (const input of autosaveInputs) {
    if (!input) continue;
    input.addEventListener("input", () => {
      if (input === ui.noteFinalMergedEditor) {
        state.noteEditor.finalEditorTouched = true;
      }
      if (
        input === ui.manualDoctorNotesInput &&
        ui.noteFinalMergedEditor &&
        !state.noteEditor.finalEditorTouched
      ) {
        ui.noteFinalMergedEditor.value = buildProviderNoteText({
          sections: state.noteEditor.note?.version?.contentJson?.sections || {},
          additionalProviderNotes: String(ui.manualDoctorNotesInput?.value || "").trim(),
          freeTextAdditions: "",
        });
      }
      const mergedPreview = String(
        ui.noteFinalMergedEditor?.value || ui.manualDoctorNotesInput?.value || ""
      ).trim();
      syncProviderNoteIntoChartNotes(mergedPreview);
      updateNoteMergeStatus();
      scheduleNoteAutosave();
    });
    input.addEventListener("blur", () => {
      if (!state.appointment?.id) return;
      saveNoteDraft({ silent: true }).catch((error) =>
        addLog(`Auto-save failed: ${error.message}`, "warn")
      );
    });
  }
};

const initializeViews = () => {
  const role = state.auth.user?.role || "";
  const prefs = readPreferences();
  applyPreferencesToUi(prefs);

  if (ui.reportGranularity) ui.reportGranularity.value = state.reportFilters.granularity;

  if (role === "billing") {
    setActiveView("billing", { forceReload: true }).catch((error) =>
      addLog(`Unable to initialize billing view: ${error.message}`, "warn")
    );
    return;
  }

  if (ui.prefDoctorRef && !ui.prefDoctorRef.value.trim()) {
    ui.prefDoctorRef.value = state.auth.user?.username || prefs.doctorRef || "default";
  }

  const doctorRef = String(ui.prefDoctorRef?.value || "default").trim() || "default";
  api(`/api/preferences?doctorRef=${encodeURIComponent(doctorRef)}`)
    .then((payload) => {
      const merged = {
        ...prefs,
        ...payload.preferences,
        doctorRef,
      };
      writePreferences(merged);
      applyPreferencesToUi(merged);
    })
    .catch(() => {});

  const preferred = viewTitles[prefs.defaultView] ? prefs.defaultView : "live";
  const initialView = state.allowedViews.includes(preferred)
    ? preferred
    : state.allowedViews[0] || "live";
  setActiveView(initialView).catch((error) =>
    addLog(`Unable to initialize default view: ${error.message}`, "warn")
  );
};

ui.startBtn?.addEventListener("click", () => {
  startEncounter().catch((error) => addLog(`Start failed: ${error.message}`, "warn"));
});

ui.stopBtn?.addEventListener("click", () => {
  stopEncounter().catch((error) => addLog(`Stop failed: ${error.message}`, "warn"));
});

ui.evidenceCloseBtn?.addEventListener("click", closeEvidenceDrawer);
ui.evidenceBackdrop?.addEventListener("click", closeEvidenceDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeEvidenceDrawer();
  }
});

ui.consentGiven?.addEventListener("change", setConsentBadgeState);
ui.encounterMode?.addEventListener("change", syncEncounterModeUi);
ui.patientLookupBtn?.addEventListener("click", () => {
  lookupPatientCharts({ query: ui.patientRef?.value || "" })
    .then(() => loadPatientProfileByRef(ui.patientRef?.value || ""))
    .catch((error) => addLog(`Patient chart lookup failed: ${error.message}`, "warn"));
});
ui.patientRef?.addEventListener("input", () => {
  const query = String(ui.patientRef.value || "").trim();
  if (!query) {
    setSelectedPatientProfile(null, { insurancePlan: ui.insurancePlan?.value || "" });
    return;
  }
  if (query.length < 2) return;
  lookupPatientCharts({ query, silent: true }).catch(() => {});
});
ui.patientRef?.addEventListener("change", () => {
  loadPatientProfileByRef(ui.patientRef?.value || "", { silent: true }).catch(() => {});
});
ui.patientRef?.addEventListener("blur", () => {
  loadPatientProfileByRef(ui.patientRef?.value || "", { silent: true }).catch(() => {});
});
ui.insurancePlan?.addEventListener("change", () => {
  if (state.selectedPatientProfile) {
    state.selectedPatientProfile = {
      ...state.selectedPatientProfile,
      insuranceInfo: toInsuranceLabel(ui.insurancePlan?.value || ""),
    };
  }
  renderPatientHeader({
    patientProfile: state.selectedPatientProfile,
    insurancePlan: ui.insurancePlan?.value || "",
  });
});
ui.authPasswordBtn?.addEventListener("click", () => {
  handlePasswordAuth().catch((error) => setAuthError(error.message || "Login failed."));
});
ui.auth2faBtn?.addEventListener("click", () => {
  handle2faAuth().catch((error) => setAuthError(error.message || "2FA failed."));
});
ui.authSendSmsBtn?.addEventListener("click", () => {
  sendSms2faCode().catch((error) => setAuthError(error.message || "Unable to send SMS code."));
});
ui.authFactorMethod?.addEventListener("change", () => {
  if (!ui.authSetupHint) return;
  const selected = String(ui.authFactorMethod?.value || "totp").toLowerCase();
  ui.authSetupHint.textContent =
    selected === "sms"
      ? "Request a text code, then enter the 6-digit SMS code."
      : "Enter your 6-digit authenticator code.";
});
ui.logoutBtn?.addEventListener("click", () => {
  logout().catch((error) => addLog(`Logout failed: ${error.message}`, "warn"));
});
ui.authPassword?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  handlePasswordAuth().catch((error) => setAuthError(error.message || "Login failed."));
});
ui.authTotpCode?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  handle2faAuth().catch((error) => setAuthError(error.message || "2FA failed."));
});
ui.settings2faSetupCode?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  verify2faSetup().catch((error) => addLog(`2FA verification failed: ${error.message}`, "warn"));
});

setConsentBadgeState();
setRecordingRetentionHint(60);
syncEncounterModeUi();
applyClientLandingContext();
setTranscriptBadge("Idle", false);
bindNavigation();
bindPreferences();
bindCodebook();
bindNoteEditor();
updateNoteMergeStatus();
renderPatientHeader({ patientProfile: null, insurancePlan: ui.insurancePlan?.value || "" });
setAuthUserUi();
applyRoleViewAccess();
setAuthOverlayOpen(true);

loadSessionUser()
  .then((signedIn) => {
    if (!signedIn) {
      setAuthOverlayOpen(true);
      return;
    }
    setAuthOverlayOpen(false);
    initializeViews();
  })
  .catch(() => {
    setAuthOverlayOpen(true);
  });

