const state = {
  auth: {
    token: "",
    user: null,
    challengeId: "",
  },
  appointment: null,
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
  },
  billing: {
    queue: [],
    selectedAppointmentId: "",
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
  doctorRef: document.getElementById("doctorRef"),
  patientRef: document.getElementById("patientRef"),
  consentFormId: document.getElementById("consentFormId"),
  insurancePlan: document.getElementById("insurancePlan"),
  visitType: document.getElementById("visitType"),
  consentGiven: document.getElementById("consentGiven"),
  consentBadge: document.getElementById("consentBadge"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  transcriptFeed: document.getElementById("transcriptFeed"),
  chatFeed: document.getElementById("chatFeed"),
  suggestionList: document.getElementById("suggestionList"),
  baselineRevenue: document.getElementById("baselineRevenue"),
  opportunityRevenue: document.getElementById("opportunityRevenue"),
  earnedNowRevenue: document.getElementById("earnedNowRevenue"),
  projectedRevenue: document.getElementById("projectedRevenue"),
  oppChange: document.getElementById("oppChange"),
  earnedChange: document.getElementById("earnedChange"),
  payerMultiplier: document.getElementById("payerMultiplier"),
  multiplierDesc: document.getElementById("multiplierDesc"),
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
  noteAdditionalProvider: document.getElementById("noteAdditionalProvider"),
  noteFreeText: document.getElementById("noteFreeText"),
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
  billingFinalNotePreview: document.getElementById("billingFinalNotePreview"),
  billingApprovedCodes: document.getElementById("billingApprovedCodes"),
  pastAuditSummary: document.getElementById("pastAuditSummary"),
  pastEncounterAuditList: document.getElementById("pastEncounterAuditList"),
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

const formatCurrency = (value) => `$${safeNumber(value)}`;

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
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
  writeAuthToken("");
};

const setAuthOverlayOpen = (open) => {
  ui.authOverlay?.classList.toggle("open", Boolean(open));
};

const setAuthUserUi = () => {
  const user = state.auth.user;
  if (ui.authUserText) {
    ui.authUserText.textContent = user
      ? `${user.displayName || user.username} (${user.role})`
      : "Not signed in";
  }
  if (ui.authUserPill) {
    ui.authUserPill.classList.toggle("live", Boolean(user));
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.disabled = !user;
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
    ui.suggestionList.innerHTML = emptyStateHtml("No compliant suggestions yet.");
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
      <div class="cpt-desc"><strong>${escapeHtml(item.title || "CPT/HCPCS suggestion")}</strong></div>
      <div class="cpt-desc">${escapeHtml(item.rationale || "No rationale.")}</div>
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
  const baseline = Number(tracker?.baseline || 0);
  const opportunity = Number(tracker?.compliantOpportunity || 0);
  const earnedNow = Number(tracker?.earnedNow ?? tracker?.projectedTotal ?? 0);
  const projected = Number(tracker?.projectedTotal || 0);
  const payerMultiplier = Number(tracker?.payerMultiplier || 1);

  ui.baselineRevenue.textContent = `$${safeNumber(baseline)}`;
  ui.opportunityRevenue.textContent = `$${safeNumber(opportunity)}`;
  ui.earnedNowRevenue.textContent = `$${safeNumber(earnedNow)}`;
  ui.projectedRevenue.textContent = `$${safeNumber(projected)}`;
  ui.payerMultiplier.textContent = `x${safeNumber(payerMultiplier)}`;

  if (ui.oppChange) {
    ui.oppChange.textContent =
      opportunity > 0 ? `+${safeNumber(opportunity)} compliant opportunity` : "No added opportunity yet";
  }

  if (ui.earnedChange) {
    const codeCount = Array.isArray(tracker?.billableCodes) ? tracker.billableCodes.length : 0;
    ui.earnedChange.textContent = `${codeCount} billable code${codeCount === 1 ? "" : "s"} selected`;
  }
};

const renderGuidance = (guidanceItems) => {
  ui.guidanceList.innerHTML = "";
  if (!Array.isArray(guidanceItems) || guidanceItems.length === 0) {
    ui.guidanceList.innerHTML = emptyStateHtml("No compliance prompts yet.");
    return;
  }

  for (const item of guidanceItems.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "guidance-item";
    const evidenceKey = getEvidenceKey("guidance", item);
    const mainText = item.text || item.prompt || "";
    const detailText = item.detail || item.rationale || "";
    row.innerHTML = `
      <div class="guidance-tag">${escapeHtml(
        item.sourceType === "missed-billable"
          ? "BILLING SUPPORT"
          : item.sourceType === "documentation-gap"
            ? "COMPLIANCE"
            : parsePriority(item.priority)
      )}</div>
      <div class="guidance-text">${escapeHtml(mainText)}</div>
      ${detailText ? `<div class="guidance-detail">${escapeHtml(detailText)}</div>` : ""}
    `;

    bindEvidenceTrigger(row, {
      title: mainText || "Compliance guidance",
      subtitle: detailText || "Supporting transcript evidence",
      refs: item.evidenceRefs || [],
      evidenceKey,
    });

    ui.guidanceList.appendChild(row);
  }
};

const renderBillableCodes = (codes) => {
  ui.billableCodesList.innerHTML = "";
  if (!Array.isArray(codes) || codes.length === 0) {
    ui.billableCodesList.innerHTML = emptyStateHtml("No billable codes detected yet.");
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
      title: `${code.code} billable code`,
      subtitle:
        code.rationale || code.evidence || "This code is currently selected based on transcript evidence.",
      refs: code.evidenceRefs || [],
      evidenceKey,
    });

    ui.billableCodesList.appendChild(row);
  }
};

const getEditableText = (element) => String(element?.textContent || "").trim();

const setEditableText = (element, value) => {
  if (!element) return;
  element.textContent = String(value || "").trim();
};

const getNoteContentFromUi = () => ({
  sections: {
    hpi: getEditableText(ui.noteHpiEditor),
    ros: getEditableText(ui.noteRosEditor),
    exam: getEditableText(ui.noteExamEditor),
    assessment: getEditableText(ui.noteAssessmentEditor),
    plan: getEditableText(ui.notePlanEditor),
  },
  additionalProviderNotes: String(ui.noteAdditionalProvider?.value || "").trim(),
  freeTextAdditions: String(ui.noteFreeText?.value || "").trim(),
});

const setNoteContentToUi = (content = {}) => {
  setEditableText(ui.noteHpiEditor, content?.sections?.hpi || "");
  setEditableText(ui.noteRosEditor, content?.sections?.ros || "");
  setEditableText(ui.noteExamEditor, content?.sections?.exam || "");
  setEditableText(ui.noteAssessmentEditor, content?.sections?.assessment || "");
  setEditableText(ui.notePlanEditor, content?.sections?.plan || "");
  if (ui.noteAdditionalProvider) {
    ui.noteAdditionalProvider.value = String(content?.additionalProviderNotes || "").trim();
  }
  if (ui.noteFreeText) {
    ui.noteFreeText.value = String(content?.freeTextAdditions || "").trim();
  }
};

const setNoteLockState = (locked) => {
  const editable = [ui.noteHpiEditor, ui.noteRosEditor, ui.noteExamEditor, ui.noteAssessmentEditor, ui.notePlanEditor];
  for (const item of editable) {
    if (!item) continue;
    item.setAttribute("contenteditable", locked ? "false" : "true");
    item.style.background = locked ? "#f1f5f9" : "";
  }
  if (ui.noteAdditionalProvider) ui.noteAdditionalProvider.disabled = Boolean(locked);
  if (ui.noteFreeText) ui.noteFreeText.disabled = Boolean(locked);
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
    renderSimplePills(ui.noteCptList, [], "No CPT suggestions");
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

  renderSimplePills(
    ui.noteCptList,
    cptCodes.map(
      (item) =>
        `${item.code} (${Math.round((item.confidence || 0) * 100)}%) • refs ${
          Array.isArray(item.evidenceRefs) ? item.evidenceRefs.length : 0
        }`
    ),
    "No CPT suggestions"
  );
  renderSimplePills(
    ui.noteIcdList,
    icdCodes.map(
      (item) =>
        `${item.code} (${Math.round((item.confidence || 0) * 100)}%) • refs ${
          Array.isArray(item.evidenceRefs) ? item.evidenceRefs.length : 0
        }`
    ),
    "No ICD suggestions"
  );
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
  if (ui.noteFinalCodesInput && !ui.noteFinalCodesInput.value.trim()) {
    ui.noteFinalCodesInput.value = finalCodes.join(", ");
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
            )}" type="button">Audit</button>
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
      loadPastEncounterAudit(appointmentId).catch((error) =>
        addLog(`Unable to load encounter audit: ${error.message}`, "warn")
      );
    });
  });

  if (ui.pastEncountersSummary) {
    const count = Array.isArray(appointments) ? appointments.length : 0;
    ui.pastEncountersSummary.textContent = `${count} encounter${count === 1 ? "" : "s"}`;
  }
};

const renderBillingQueue = (queue = []) => {
  state.billing.queue = Array.isArray(queue) ? queue : [];
  if (!ui.billingQueueBody) return;

  const rowsHtml = state.billing.queue
    .map(
      (item) => `
      <tr>
        <td><div class="table-code-pill">${escapeHtml(item.appointmentId || "-")}</div></td>
        <td>${escapeHtml(formatDateTime(item.finalizedAt))}</td>
        <td>${escapeHtml((item.approvedCodes || []).join(", ") || "-")}</td>
        <td>${escapeHtml(`${Math.round(Number(item.confidence || 0) * 100)}%`)}</td>
        <td><button class="btn btn-ghost" type="button" data-billing-open="${escapeHtml(
          item.appointmentId
        )}" style="height:30px;padding:0 10px;">Open</button></td>
      </tr>`
    )
    .join("");

  renderTableBody(ui.billingQueueBody, rowsHtml, 5, "No finalized notes available.");
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
  const sections = payload?.finalVersion?.contentJson?.sections || {};
  const preview = [
    `HPI: ${sections.hpi || "-"}`,
    `ROS: ${sections.ros || "-"}`,
    `Exam: ${sections.exam || "-"}`,
    `Assessment: ${sections.assessment || "-"}`,
    `Plan: ${sections.plan || "-"}`,
  ].join("\n\n");

  if (ui.billingFinalNotePreview) {
    ui.billingFinalNotePreview.textContent = preview;
  }
  renderSimplePills(ui.billingApprovedCodes, payload.approvedCodes || [], "No approved codes.");
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
  renderPastEncounters(payload.appointments || []);
  state.loadedViewData.past = true;
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
  const [report, compliance, settingsPayload] = await Promise.all([
    loadRevenueReport(),
    api("/api/compliance/status"),
    api("/api/settings/general"),
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

const renderSimplePills = (container, values, emptyText = "No items") => {
  if (!container) return;
  if (!Array.isArray(values) || !values.length) {
    container.innerHTML = `<span class="pill">${escapeHtml(emptyText)}</span>`;
    return;
  }
  container.innerHTML = values.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("");
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
    ui.hipaaRetentionDays.value = Number(hipaa.dataRetentionDays || 365);
  }

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

  const dataRetentionDays = Number(ui.hipaaRetentionDays?.value || current.dataRetentionDays || 365);
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
    ? `Compliance prompts: ${guidanceText}`
    : "Compliance prompts: continue collecting encounter details (duration, severity, and plan).";

  const missedPart = missedBillables.length
    ? `Missed billables: ${missedBillables
        .slice(0, 2)
        .map((item) => item.potentialCode)
        .join(", ")}`
    : "Missed billables: none flagged.";

  const gapPart = documentationGaps.length
    ? `Documentation gaps: ${documentationGaps.length}`
    : "Documentation gaps: none major.";

  const revenuePart = `Estimated earned now: $${safeNumber(
    tracker?.earnedNow ?? tracker?.projectedTotal
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
  addLog(`Recording uploaded to ${uploaded.recording.provider}.`, "good");
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
  ui.guidanceList.innerHTML = emptyStateHtml("Compliance prompts will appear here");
  ui.suggestionList.innerHTML = emptyStateHtml("CPT codes surface as encounter progresses");
  ui.billableCodesList.innerHTML = emptyStateHtml("No codes logged yet");

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

  const doctorRef = ui.doctorRef.value.trim();
  const patientRef = ui.patientRef.value.trim() || "anonymous";
  const consentFormId = ui.consentFormId.value.trim();

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
      consentGiven: true,
    }),
  });

  state.appointment = created.appointment;
  state.encounterActive = true;
  state.lastTranscriptNormalized = "";
  state.lastTranscriptAt = 0;
  state.lastServerTranscriptCount = 0;
  state.lastAssistantMessage = "";
  state.lastThrottleLogAt = 0;
  state.noteEditor.loaded = false;
  state.noteEditor.note = null;
  state.noteEditor.codingAnalysis = null;
  clearInterimTranscript();

  resetEncounterPanels();
  renderRevenueTracker({
    baseline: 0,
    compliantOpportunity: 0,
    earnedNow: 0,
    projectedTotal: 0,
    payerMultiplier: 1,
    billableCodes: [],
  });

  addLog(`Doctor ${doctorRef} started appointment ${state.appointment.id}.`, "good");
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

const handlePasswordAuth = async () => {
  const username = String(ui.authUsername?.value || "").trim().toLowerCase();
  const password = String(ui.authPassword?.value || "");
  if (!username || !password) {
    setAuthError("Username and password are required.");
    return;
  }

  const payload = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  state.auth.challengeId = payload.challengeId || "";
  if (!state.auth.challengeId) {
    throw new Error("Missing 2FA challenge from server.");
  }

  if (ui.auth2faBlock) ui.auth2faBlock.style.display = "block";
  if (ui.authSetupHint) {
    ui.authSetupHint.textContent = payload.mfaSetupRequired
      ? "Scan this secret in your authenticator app, then enter the 6-digit code."
      : "Enter your 6-digit authenticator code.";
  }
  if (ui.authSetupSecret) {
    ui.authSetupSecret.textContent = payload.setup?.secret
      ? `Setup secret: ${payload.setup.secret}`
      : "";
  }
  setAuthError("");
};

const handle2faAuth = async () => {
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
    }),
  });

  writeAuthToken(payload.token || "");
  state.auth.user = payload.user || null;
  state.auth.challengeId = "";
  if (ui.authPassword) ui.authPassword.value = "";
  if (ui.authTotpCode) ui.authTotpCode.value = "";
  if (ui.auth2faBlock) ui.auth2faBlock.style.display = "none";
  if (ui.authSetupSecret) ui.authSetupSecret.textContent = "";
  setAuthOverlayOpen(false);
  setAuthUserUi();
  applyRoleViewAccess();
  resetLoadedViews();
  initializeViews();
  setAuthError("");
};

const loadSessionUser = async () => {
  const token = readAuthToken();
  if (!token) return false;
  writeAuthToken(token);
  try {
    const payload = await api("/api/auth/me");
    state.auth.user = payload.user || null;
    setAuthUserUi();
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
    ui.noteHpiEditor,
    ui.noteRosEditor,
    ui.noteExamEditor,
    ui.noteAssessmentEditor,
    ui.notePlanEditor,
    ui.noteAdditionalProvider,
    ui.noteFreeText,
  ];

  for (const input of autosaveInputs) {
    if (!input) continue;
    input.addEventListener("input", scheduleNoteAutosave);
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
    ui.prefDoctorRef.value = prefs.doctorRef || "default";
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
ui.authPasswordBtn?.addEventListener("click", () => {
  handlePasswordAuth().catch((error) => setAuthError(error.message || "Login failed."));
});
ui.auth2faBtn?.addEventListener("click", () => {
  handle2faAuth().catch((error) => setAuthError(error.message || "2FA failed."));
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

setConsentBadgeState();
setTranscriptBadge("Idle", false);
bindNavigation();
bindPreferences();
bindCodebook();
bindNoteEditor();
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
