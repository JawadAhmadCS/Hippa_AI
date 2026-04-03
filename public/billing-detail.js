const AUTH_TOKEN_KEY = "mari.auth.token.v1";

const ui = {
  appointmentHeaderMeta: document.getElementById("appointmentHeaderMeta"),
  patientSummaryPills: document.getElementById("patientSummaryPills"),
  pageStatus: document.getElementById("pageStatus"),
  finalizedNotesBox: document.getElementById("finalizedNotesBox"),
  transcriptBox: document.getElementById("transcriptBox"),
  policyIcdPills: document.getElementById("policyIcdPills"),
  policyCptPills: document.getElementById("policyCptPills"),
  icdPills: document.getElementById("icdPills"),
  cptPills: document.getElementById("cptPills"),
  approvedCodePills: document.getElementById("approvedCodePills"),
  playAudioBtn: document.getElementById("playAudioBtn"),
  audioMeta: document.getElementById("audioMeta"),
  audioPlayer: document.getElementById("audioPlayer"),
  refreshBtn: document.getElementById("refreshBtn"),
  closeBtn: document.getElementById("closeBtn"),
};

const state = {
  appointmentId: "",
  payload: null,
  audioPlaybackUrl: "",
};

const getAuthToken = () => String(localStorage.getItem(AUTH_TOKEN_KEY) || "").trim();

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeCode = (value) => String(value || "").trim().toUpperCase();

const renderPills = (container, items, emptyText = "No items", warnSet = new Set()) => {
  if (!container) return;
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    container.innerHTML = `<span class="pill">${escapeHtml(emptyText)}</span>`;
    return;
  }
  container.innerHTML = values
    .map((item) => {
      const normalized = normalizeCode(item);
      const warnClass = warnSet.has(normalized) ? " warn" : "";
      return `<span class="pill${warnClass}">${escapeHtml(normalized)}</span>`;
    })
    .join("");
};

const buildFinalNoteText = (noteContent = {}) => {
  const sections = noteContent?.sections || {};
  const sectionText = [
    sections.hpi ? `HPI:\n${sections.hpi}` : "",
    sections.ros ? `ROS:\n${sections.ros}` : "",
    sections.exam ? `Exam:\n${sections.exam}` : "",
    sections.assessment ? `Assessment:\n${sections.assessment}` : "",
    sections.plan ? `Plan:\n${sections.plan}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const manual = String(noteContent?.additionalProviderNotes || "").trim();
  const merged = String(noteContent?.freeTextAdditions || "").trim();
  if (merged) return merged;
  if (sectionText && manual) return `${sectionText}\n\nManual Notes:\n${manual}`;
  return sectionText || manual || "";
};

const api = async (path, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
};

const renderStatus = (message = "", level = "") => {
  if (!ui.pageStatus) return;
  ui.pageStatus.className = `status${level ? ` ${level}` : ""}`;
  ui.pageStatus.textContent = String(message || "");
};

const renderSummary = (payload = {}) => {
  const profile = payload?.patientProfile || {};
  const rows = [
    `Appointment: ${payload.appointmentId || "-"}`,
    `Patient ID: ${profile.patientRef || payload.patientRef || "-"}`,
    `Patient: ${profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "-"}`,
    `DOB: ${profile.dob || "-"}`,
    `Insurance: ${profile.insuranceInfo || payload.insurancePlanName || payload.insurancePlan || "-"}`,
    `Finalized At: ${formatDateTime(payload.finalizedAt)}`,
  ];

  if (ui.appointmentHeaderMeta) {
    ui.appointmentHeaderMeta.textContent = rows.join(" | ");
  }

  if (ui.patientSummaryPills) {
    const expectedRevenue = Number(payload?.expectedRevenueFromAppointment || 0);
    const pills = [
      payload?.encounterMode ? `Mode: ${payload.encounterMode}` : "",
      payload?.telehealthPlatform ? `Platform: ${payload.telehealthPlatform}` : "",
      `Expected Revenue: $${expectedRevenue.toFixed(2)}`,
      payload?.insurancePolicy?.planName ? `Plan: ${payload.insurancePolicy.planName}` : "",
    ].filter(Boolean);
    ui.patientSummaryPills.innerHTML = pills.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("");
  }
};

const renderNotesAndTranscript = (payload = {}) => {
  const noteText =
    buildFinalNoteText(payload?.finalVersion?.contentJson || {}) || "No finalized merged note available.";
  if (ui.finalizedNotesBox) ui.finalizedNotesBox.textContent = noteText;

  const transcript = Array.isArray(payload?.transcriptSegments) ? payload.transcriptSegments : [];
  const transcriptText = transcript.length
    ? transcript
        .map((segment) => {
          const seq = Number(segment?.sequence || 0) || "-";
          const at = formatDateTime(segment?.at || "");
          const source = String(segment?.source || "transcript").trim();
          const text = String(segment?.cleanedText || "").trim();
          return `[${seq}] ${source} @ ${at}\n${text}`;
        })
        .join("\n\n")
    : "No transcript available.";
  if (ui.transcriptBox) ui.transcriptBox.textContent = transcriptText;
};

const renderCodes = (payload = {}) => {
  const recommendedIcd = Array.isArray(payload?.recommendedIcd10Codes)
    ? payload.recommendedIcd10Codes.map((item) => normalizeCode(item?.code))
    : [];
  const recommendedCpt = Array.isArray(payload?.recommendedCptCodes)
    ? payload.recommendedCptCodes.map((item) => normalizeCode(item?.code))
    : [];
  const approvedCodes = Array.isArray(payload?.approvedCodes)
    ? payload.approvedCodes.map((item) => normalizeCode(item))
    : [];
  const approvedIcd = Array.isArray(payload?.approvedIcdCodes)
    ? payload.approvedIcdCodes.map((item) => normalizeCode(item?.code))
    : [];

  const policy = payload?.insurancePolicy || {};
  const policyIcdCodes = Array.isArray(policy?.icdCodes)
    ? policy.icdCodes.map((item) => normalizeCode(item))
    : [];
  const policyCptCodes = Array.isArray(policy?.cptCodes)
    ? policy.cptCodes.map((item) => normalizeCode(item))
    : [];
  const warnIcd = new Set(
    [
      ...(Array.isArray(policy?.outOfPlanRecommendedIcd) ? policy.outOfPlanRecommendedIcd : []),
      ...(Array.isArray(policy?.outOfPlanApprovedIcd) ? policy.outOfPlanApprovedIcd : []),
    ].map((item) => normalizeCode(item))
  );
  const warnCpt = new Set(
    [
      ...(Array.isArray(policy?.outOfPlanRecommendedCpt) ? policy.outOfPlanRecommendedCpt : []),
      ...(Array.isArray(policy?.outOfPlanApprovedCpt) ? policy.outOfPlanApprovedCpt : []),
    ].map((item) => normalizeCode(item))
  );

  renderPills(ui.policyIcdPills, policyIcdCodes, "No plan-specific ICD-10 profile configured.");
  renderPills(ui.policyCptPills, policyCptCodes, "No plan-specific CPT profile configured.");
  renderPills(ui.icdPills, [...new Set([...recommendedIcd, ...approvedIcd])], "No ICD-10 codes", warnIcd);
  renderPills(ui.cptPills, recommendedCpt, "No CPT codes", warnCpt);
  renderPills(ui.approvedCodePills, approvedCodes, "No finalized billing codes");

  if (!policyIcdCodes.length && !policyCptCodes.length) {
    renderStatus(
      "No plan-specific code profile is configured yet. Billing can still review suggested and finalized codes.",
      "warn"
    );
    return;
  }

  const warningCount = warnIcd.size + warnCpt.size;
  if (warningCount) {
    renderStatus(
      `${warningCount} code(s) are outside the selected insurance plan code profile.`,
      "warn"
    );
  } else {
    renderStatus("Codes align with the selected insurance plan profile.", "good");
  }
};

const renderAudio = (payload = {}) => {
  const recordings = Array.isArray(payload?.recordings) ? payload.recordings : [];
  if (!recordings.length) {
    state.audioPlaybackUrl = "";
    if (ui.audioMeta) ui.audioMeta.textContent = "No recording available for this appointment.";
    if (ui.playAudioBtn) ui.playAudioBtn.disabled = true;
    if (ui.audioPlayer) ui.audioPlayer.removeAttribute("src");
    return;
  }

  const first = recordings[0] || {};
  const token = getAuthToken();
  const tokenQuery = token ? `?accessToken=${encodeURIComponent(token)}` : "";
  state.audioPlaybackUrl = `/api/billing/appointments/${encodeURIComponent(
    payload.appointmentId
  )}/recordings/0/play${tokenQuery}`;

  if (ui.audioMeta) {
    const provider = String(first.provider || "storage").trim() || "storage";
    const uploadedAt = formatDateTime(first.uploadedAt || "");
    ui.audioMeta.textContent = `Source: ${provider} | Uploaded: ${uploadedAt}`;
  }
  if (ui.playAudioBtn) ui.playAudioBtn.disabled = false;
  if (ui.audioPlayer) {
    ui.audioPlayer.src = state.audioPlaybackUrl;
  }
};

const loadBillingDetail = async () => {
  if (!state.appointmentId) {
    renderStatus("Missing appointmentId in URL.", "danger");
    return;
  }

  renderStatus("Loading billing detail...");
  const payload = await api(`/api/billing/appointments/${encodeURIComponent(state.appointmentId)}/final`);
  state.payload = payload;
  renderSummary(payload);
  renderNotesAndTranscript(payload);
  renderCodes(payload);
  renderAudio(payload);
};

const parseAppointmentId = () => {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("appointmentId") || "").trim();
};

ui.playAudioBtn?.addEventListener("click", async () => {
  if (!state.audioPlaybackUrl || !ui.audioPlayer) return;
  try {
    ui.audioPlayer.src = state.audioPlaybackUrl;
    await ui.audioPlayer.play();
  } catch (error) {
    renderStatus(`Unable to play recording: ${error.message}`, "danger");
  }
});

ui.refreshBtn?.addEventListener("click", () => {
  loadBillingDetail().catch((error) => renderStatus(error.message, "danger"));
});

ui.closeBtn?.addEventListener("click", () => {
  window.close();
});

state.appointmentId = parseAppointmentId();
loadBillingDetail().catch((error) => renderStatus(error.message, "danger"));
