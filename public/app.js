const state = {
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
  interimTranscriptNode: null,
  lastAssistantMessage: "",
  lastThrottleLogAt: 0,
  suggestionStream: null,
  currentView: "live",
  loadedViewData: {
    past: false,
    revenue: false,
    settings: false,
    hipaa: false,
    codebook: false,
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
};

const safeNumber = (value) => Number(value || 0).toFixed(2);
const PREFS_KEY = "mari.preferences.v1";
const viewTitles = {
  live: "Live Encounter",
  past: "Past Encounters",
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

const transcriptLineHtml = ({ source, cleanedText, rawText, quality, pending = false, errorText = "" }) => {
  const cleaned = String(cleanedText || "").trim();
  const raw = String(rawText || "").trim();
  const confidencePct = Math.round((Number(quality?.confidence || 0) || 0) * 100);

  const details = [];
  if (raw && cleaned && raw.toLowerCase() !== cleaned.toLowerCase()) {
    details.push(`Cleaned from: ${raw}`);
  }
  if (confidencePct > 0) {
    details.push(`Quality: ${confidencePct}% (${quality?.method || "n/a"})`);
  }
  if (pending) {
    details.push("Syncing...");
  }
  if (errorText) {
    details.push(errorText);
  }

  const detailHtml = details
    .map((line) => `<div class="tx-text" style="font-size:11px;color:#94a3b8">${escapeHtml(line)}</div>`)
    .join("");

  return `
    <div class="tx-speaker">${escapeHtml(source)}</div>
    <div class="tx-text">${escapeHtml(cleaned || raw)}</div>
    ${detailHtml}
  `;
};

const upsertTranscriptLine = (
  line,
  { source, cleanedText, rawText, quality, pending = false, errorText = "" }
) => {
  line.className = "tx-line provider";
  line.innerHTML = transcriptLineHtml({
    source,
    cleanedText,
    rawText,
    quality,
    pending,
    errorText,
  });
};

const addTranscriptLine = (
  source,
  cleanedText,
  rawText,
  quality,
  { pending = false, errorText = "" } = {}
) => {
  removeEmptyStates(ui.transcriptFeed);
  const line = document.createElement("div");
  upsertTranscriptLine(line, { source, cleanedText, rawText, quality, pending, errorText });
  ui.transcriptFeed.prepend(line);
  return line;
};

const clearInterimTranscript = () => {
  if (!state.interimTranscriptNode) return;
  state.interimTranscriptNode.remove();
  state.interimTranscriptNode = null;
};

const setInterimTranscript = (source, text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    clearInterimTranscript();
    return;
  }

  if (!state.interimTranscriptNode) {
    state.interimTranscriptNode = addTranscriptLine(
      source,
      trimmed,
      trimmed,
      { confidence: 0.4, method: "interim" },
      { pending: true }
    );
    return;
  }

  upsertTranscriptLine(state.interimTranscriptNode, {
    source,
    cleanedText: trimmed,
    rawText: trimmed,
    quality: { confidence: 0.4, method: "interim" },
    pending: true,
  });
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
      <div class="cpt-confidence-bar">
        <div class="cpt-confidence-fill" style="width:${confidence}%"></div>
      </div>
      <div class="cpt-confidence-label"><span>Confidence</span><span>${confidence}%</span></div>
    `;
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
    ui.guidanceList.innerHTML = emptyStateHtml("No targeted prompts yet.");
    return;
  }

  for (const item of guidanceItems.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "guidance-item";
    row.innerHTML = `
      <div class="guidance-tag">${escapeHtml(parsePriority(item.priority))}</div>
      <div class="guidance-text">${escapeHtml(item.prompt || "")}</div>
    `;
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
    const confidence = Number(code.confidence || 0);
    const status = confidence >= 0.8 ? "confirmed" : "pending";
    row.innerHTML = `
      <div class="table-code">${escapeHtml(code.code)}</div>
      <div class="table-desc">${escapeHtml(code.title || "")}</div>
      <div class="table-amount">$${safeNumber(code.estimatedAmount)}</div>
      <div><span class="status-tag ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></div>
    `;
    ui.billableCodesList.appendChild(row);
  }
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
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
            )}/transcript.pdf" target="_blank" rel="noopener">PDF</a>
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
  window.open(`/api/reports/revenue/export.csv?${query}`, "_blank", "noopener,noreferrer");
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
  if (!viewTitles[view]) return;

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
    .map((item, index) => `${index + 1}. ${item.prompt}`)
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
    ? `Doctor next prompts: ${guidanceText}`
    : "Doctor next prompts: continue collecting encounter details (duration, severity, and plan).";

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
  renderSuggestions(payload.allSuggestions || []);
  renderRevenueTracker(payload.revenueTracker || {});
  renderGuidance(payload.guidance?.items || []);
  renderBillableCodes(payload.revenueTracker?.billableCodes || []);

  addAssistantMessage(
    summarizeAssistantUpdate({
      suggestions: payload.newlyAddedSuggestions || [],
      guidanceItems: payload.guidance?.items || [],
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
  applyAnalysisPayload(payload);
  return payload;
};

const startSuggestionStream = () => {
  if (!state.appointment) return;
  closeSuggestionStream();

  const stream = new EventSource(`/api/appointments/${state.appointment.id}/stream`);
  stream.addEventListener("analysis.update", (event) => {
    const payload = JSON.parse(event.data || "{}");
    applyAnalysisPayload(payload);
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

const syncTranscriptSubmission = async ({ text, source, transcriptLine }) => {
  try {
    const payload = await submitTranscriptSegment(text, source);
    if (!payload) return;

    const processed = payload.processedSegment || {
      source,
      rawText: text,
      cleanedText: text,
      quality: { confidence: 0.5, method: "fallback" },
    };

    upsertTranscriptLine(transcriptLine, {
      source: processed.source || source,
      cleanedText: processed.cleanedText || text,
      rawText: processed.rawText || text,
      quality: processed.quality || null,
      pending: false,
    });

    const raw = String(processed.rawText || "").trim().toLowerCase();
    const cleaned = String(processed.cleanedText || "").trim().toLowerCase();
    if (raw && cleaned && raw !== cleaned) {
      addLog("Transcript auto-cleanup applied for noisy ASR text.", "good");
    }
  } catch (error) {
    upsertTranscriptLine(transcriptLine, {
      source,
      cleanedText: text,
      rawText: text,
      quality: { confidence: 0.3, method: "sync-error" },
      pending: false,
      errorText: `sync failed: ${error.message}`,
    });
    addLog(`Transcript submission failed: ${error.message}`, "warn");
  }
};

const handleTranscriptSegment = (text, source) => {
  if (shouldSkipDuplicateSegment(text)) return;
  clearInterimTranscript();

  const transcriptLine = addTranscriptLine(
    source,
    text,
    text,
    { confidence: 0.45, method: "live-local" },
    { pending: true }
  );
  syncTranscriptSubmission({ text, source, transcriptLine });
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
  const recorder = new MediaRecorder(state.micStream, { mimeType: "audio/webm" });

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
  ui.transcriptFeed.innerHTML = emptyStateHtml("Transcript appears here during encounter");
  ui.chatFeed.innerHTML = emptyStateHtml("Assistant analysis will appear here");
  ui.guidanceList.innerHTML = emptyStateHtml("Real-time prompts will appear here");
  ui.suggestionList.innerHTML = emptyStateHtml("CPT codes surface as encounter progresses");
  ui.billableCodesList.innerHTML = emptyStateHtml("No codes logged yet");

  if (ui.cptBadge) ui.cptBadge.textContent = "0 codes";
  if (ui.billableCount) ui.billableCount.textContent = "0 items";
};

const startEncounter = async () => {
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

  state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  startRecording();

  const azureStarted = await startAzureSpeech();
  if (!azureStarted) {
    startBrowserSpeechFallback();
  }

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

  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = null;
  }

  ui.waveform?.classList.remove("active");
  setTranscriptBadge("Stopped", false);

  try {
    await stopRecordingAndUpload();
  } catch (error) {
    addLog(error.message, "warn");
  }

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

const initializeViews = () => {
  const prefs = readPreferences();
  applyPreferencesToUi(prefs);

  if (ui.reportGranularity) ui.reportGranularity.value = state.reportFilters.granularity;
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

  const initialView = viewTitles[prefs.defaultView] ? prefs.defaultView : "live";
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

ui.consentGiven?.addEventListener("change", setConsentBadgeState);

setConsentBadgeState();
setTranscriptBadge("Idle", false);
bindNavigation();
bindPreferences();
bindCodebook();
initializeViews();
