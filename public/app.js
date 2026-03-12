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
};

const ui = {
  doctorRef: document.getElementById("doctorRef"),
  patientRef: document.getElementById("patientRef"),
  consentFormId: document.getElementById("consentFormId"),
  insurancePlan: document.getElementById("insurancePlan"),
  visitType: document.getElementById("visitType"),
  consentGiven: document.getElementById("consentGiven"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  transcriptFeed: document.getElementById("transcriptFeed"),
  chatFeed: document.getElementById("chatFeed"),
  suggestionList: document.getElementById("suggestionList"),
  baselineRevenue: document.getElementById("baselineRevenue"),
  opportunityRevenue: document.getElementById("opportunityRevenue"),
  earnedNowRevenue: document.getElementById("earnedNowRevenue"),
  projectedRevenue: document.getElementById("projectedRevenue"),
  payerMultiplier: document.getElementById("payerMultiplier"),
  guidanceList: document.getElementById("guidanceList"),
  billableCodesList: document.getElementById("billableCodesList"),
  compliancePanel: document.getElementById("compliancePanel"),
  eventLog: document.getElementById("eventLog"),
  sessionBadge: document.getElementById("sessionBadge"),
  waveform: document.getElementById("waveform"),
};

const safeNumber = (value) => Number(value || 0).toFixed(2);

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const addLog = (line, level = "info") => {
  const at = new Date().toLocaleTimeString();
  const node = document.createElement("div");
  node.className = `log-entry ${level}`;
  node.innerHTML = `<span class="ts">${at}</span>${escapeHtml(line)}`;
  ui.eventLog.prepend(node);
};

const clearEmpty = (container) => {
  const empty = container.querySelector(".empty");
  if (empty) empty.remove();
};

const formatTranscriptLineHtml = ({ source, cleanedText, rawText, quality, pending, errorText }) => {
  const cleaned = String(cleanedText || "").trim();
  const raw = String(rawText || "").trim();
  const corrected = cleaned && raw && cleaned.toLowerCase() !== raw.toLowerCase();
  const confidencePct = Math.round((Number(quality?.confidence || 0) || 0) * 100);

  let html = `<div class="speaker">${escapeHtml(source)}</div>${escapeHtml(cleaned || raw)}`;

  if (corrected) {
    html += `<div class="speaker">cleaned from: ${escapeHtml(raw)}</div>`;
  }

  if (Number.isFinite(confidencePct) && confidencePct > 0) {
    html += `<div class="speaker">quality: ${confidencePct}% (${escapeHtml(quality?.method || "n/a")})</div>`;
  }

  if (pending) {
    html += `<div class="speaker">syncing...</div>`;
  }

  if (errorText) {
    html += `<div class="speaker">${escapeHtml(errorText)}</div>`;
  }

  return html;
};

const upsertTranscriptLine = (line, { source, cleanedText, rawText, quality, pending = false, errorText = "" }) => {
  line.className = "tx-line provider";
  line.innerHTML = formatTranscriptLineHtml({
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
  clearEmpty(ui.transcriptFeed);
  const line = document.createElement("div");
  upsertTranscriptLine(line, { source, cleanedText, rawText, quality, pending, errorText });
  ui.transcriptFeed.prepend(line);
  return line;
};

const clearInterimTranscript = () => {
  if (state.interimTranscriptNode) {
    state.interimTranscriptNode.remove();
    state.interimTranscriptNode = null;
  }
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

  clearEmpty(ui.chatFeed);
  const message = document.createElement("div");
  message.className = "chat-msg assistant";
  message.textContent = cleaned;
  ui.chatFeed.prepend(message);
  state.lastAssistantMessage = cleaned;
};

const closeSuggestionStream = () => {
  if (state.suggestionStream) {
    state.suggestionStream.close();
    state.suggestionStream = null;
  }
};

const renderSuggestions = (suggestions) => {
  ui.suggestionList.innerHTML = "";
  if (!suggestions.length) {
    ui.suggestionList.innerHTML = '<div class="empty">No compliant suggestions yet.</div>';
    return;
  }

  for (const item of suggestions) {
    const card = document.createElement("div");
    card.className = "cpt-card";
    const confidence = Math.max(0, Math.min(100, Math.round((item.confidence || 0) * 100)));
    card.innerHTML = `
      <div class="cpt-top">
        <div class="cpt-code">${escapeHtml(item.code)}</div>
        <div class="cpt-amount">${confidence}%</div>
      </div>
      <div class="cpt-desc"><strong>${escapeHtml(item.title || "CPT/HCPCS suggestion")}</strong></div>
      <div class="cpt-desc">${escapeHtml(item.rationale || "No rationale.")}</div>
      <div class="cpt-desc">Doc: ${escapeHtml(item.documentationNeeded || "Document medical necessity.")}</div>
      <div class="cpt-confidence"><div class="cpt-confidence-fill" style="width:${confidence}%"></div></div>
    `;
    ui.suggestionList.appendChild(card);
  }
};

const renderRevenueTracker = (tracker) => {
  ui.baselineRevenue.textContent = `$${safeNumber(tracker?.baseline)}`;
  ui.opportunityRevenue.textContent = `$${safeNumber(tracker?.compliantOpportunity)}`;
  ui.earnedNowRevenue.textContent = `$${safeNumber(tracker?.earnedNow ?? tracker?.projectedTotal)}`;
  ui.projectedRevenue.textContent = `$${safeNumber(tracker?.projectedTotal)}`;
  ui.payerMultiplier.textContent = `x${safeNumber(tracker?.payerMultiplier)}`;
};

const renderGuidance = (guidanceItems) => {
  if (!ui.guidanceList) return;

  ui.guidanceList.innerHTML = "";
  if (!Array.isArray(guidanceItems) || guidanceItems.length === 0) {
    ui.guidanceList.innerHTML = '<div class="empty">No targeted prompts yet.</div>';
    return;
  }

  for (const item of guidanceItems.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "guidance-item";
    const priority = String(item.priority || "medium").toUpperCase();
    row.innerHTML = `
      <div class="guidance-priority">${escapeHtml(priority)}</div>
      <div>${escapeHtml(item.prompt || "")}</div>
    `;
    ui.guidanceList.appendChild(row);
  }
};

const renderBillableCodes = (codes) => {
  if (!ui.billableCodesList) return;

  ui.billableCodesList.innerHTML = "";
  if (!Array.isArray(codes) || codes.length === 0) {
    ui.billableCodesList.innerHTML = '<div class="empty">No billable codes detected yet.</div>';
    return;
  }

  for (const code of codes) {
    const row = document.createElement("div");
    row.className = "billable-code-item";
    const kind = String(code.type || "").replaceAll("-", " ");
    row.innerHTML = `
      <div class="cpt-top">
        <div class="cpt-code">${escapeHtml(code.code)}</div>
        <div class="cpt-amount">$${safeNumber(code.estimatedAmount)}</div>
      </div>
      <div class="cpt-desc"><strong>${escapeHtml(code.title || "")}</strong></div>
      <div class="cpt-desc">Type: ${escapeHtml(kind)} | Source: ${escapeHtml(code.source || "transcript")}</div>
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

const renderComplianceItem = (label, ok) => {
  const row = document.createElement("div");
  row.className = `compliance-item ${ok ? "ok" : "warn"}`;
  row.innerHTML = `<span class="dot"></span><span>${escapeHtml(label)}: ${ok ? "Configured" : "Missing"}</span>`;
  return row;
};

const refreshComplianceStatus = async () => {
  const status = await api("/api/compliance/status");
  ui.compliancePanel.innerHTML = "";
  ui.compliancePanel.appendChild(
    renderComplianceItem("OpenAI Analysis", status.integrations?.openAiAnalysisConfigured)
  );
  ui.compliancePanel.appendChild(
    renderComplianceItem("Transcript Cleanup (Deterministic)", status.integrations?.transcriptCleanupConfigured)
  );
  ui.compliancePanel.appendChild(
    renderComplianceItem("Transcript Cleanup (AI)", status.integrations?.transcriptCleanupAiEnabled)
  );
  ui.compliancePanel.appendChild(
    renderComplianceItem("Azure Speech", status.integrations?.azureSpeechConfigured)
  );
  ui.compliancePanel.appendChild(
    renderComplianceItem("Azure Blob", status.integrations?.azureBlobConfigured)
  );

  const access = document.createElement("div");
  access.className = "compliance-item ok";
  access.innerHTML = `<span class="dot"></span><span>Access Model: Doctor-only workspace</span>`;
  ui.compliancePanel.appendChild(access);

  const codebook = document.createElement("div");
  codebook.className = `compliance-item ${status.codebook?.stale ? "warn" : "ok"}`;
  codebook.innerHTML = `<span class="dot"></span><span>Codebook Age: ${status.codebook?.ageDays ?? "?"} days</span>`;
  ui.compliancePanel.appendChild(codebook);
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

const summarizeAssistantUpdate = (suggestions, guidanceItems, model, tracker, missedBillables = []) => {
  const prefix = model ? `AI analysis (${model})` : "Assistant";
  const codePart = suggestions.length
    ? `Codes: ${suggestions.slice(0, 3).map((s) => `${s.code}: ${s.rationale || "supported"}`).join(" | ")}`
    : "Codes: no new compliant code detected.";

  const guidanceText = formatGuidanceText(guidanceItems);
  const guidancePart = guidanceText
    ? `Doctor next prompts: ${guidanceText}`
    : "Doctor next prompts: continue collecting encounter details (duration, severity, and plan).";

  const revenuePart = `Estimated earned now: $${safeNumber(tracker?.earnedNow ?? tracker?.projectedTotal)}`;
  const missedPart = missedBillables.length
    ? `Missed billables to verify: ${missedBillables.slice(0, 2).map((item) => item.potentialCode).join(", ")}`
    : "Missed billables: none flagged.";

  return `${prefix}: ${codePart} ${guidancePart} ${missedPart} ${revenuePart}`;
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
    summarizeAssistantUpdate(
      payload.newlyAddedSuggestions || [],
      payload.guidance?.items || [],
      payload.analysis?.model,
      payload.revenueTracker,
      payload.missedBillables || []
    )
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

  if (isDuplicate) {
    return true;
  }

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
  if (shouldSkipDuplicateSegment(text)) {
    return;
  }

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
        if (partial) {
          setInterimTranscript("azure-live", partial);
        }
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
    if (state.encounterActive) {
      try {
        recognizer.start();
      } catch {
        addLog("Browser fallback recognizer restart failed.", "warn");
      }
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

const startEncounter = async () => {
  if (!ui.consentGiven.checked) {
    alert("Intake consent form must be signed before recording.");
    return;
  }

  const doctorRef = ui.doctorRef.value.trim();
  const patientRef = ui.patientRef.value.trim() || "anonymous";
  const consentFormId = ui.consentFormId.value.trim();
  const insurancePlan = ui.insurancePlan.value;
  const visitType = ui.visitType.value;

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
      insurancePlan,
      visitType,
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

  ui.transcriptFeed.innerHTML = '<div class="empty">Transcript will appear here during encounter</div>';
  ui.chatFeed.innerHTML = '<div class="empty">Assistant analysis updates will appear here</div>';
  renderSuggestions([]);
  renderGuidance([]);
  renderBillableCodes([]);
  renderRevenueTracker({ baseline: 0, compliantOpportunity: 0, earnedNow: 0, projectedTotal: 0, payerMultiplier: 1 });

  addLog(`Doctor ${doctorRef} started appointment ${state.appointment.id}.`, "good");
  ui.sessionBadge.textContent = `Live: ${state.appointment.id}`;
  ui.sessionBadge.classList.add("active");
  startSuggestionStream();

  state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  startRecording();

  const azureStarted = await startAzureSpeech();
  if (!azureStarted) startBrowserSpeechFallback();

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
  }

  ui.waveform?.classList.remove("active");

  try {
    await stopRecordingAndUpload();
  } catch (error) {
    addLog(error.message, "warn");
  }

  ui.sessionBadge.textContent = "Session Idle";
  ui.sessionBadge.classList.remove("active");
  ui.startBtn.disabled = false;
  addLog("Encounter ended.");
};

ui.startBtn.addEventListener("click", () => {
  startEncounter().catch((error) => addLog(`Start failed: ${error.message}`, "warn"));
});

ui.stopBtn.addEventListener("click", () => {
  stopEncounter().catch((error) => addLog(`Stop failed: ${error.message}`, "warn"));
});

refreshComplianceStatus().catch((error) => addLog(`Compliance status error: ${error.message}`, "warn"));

