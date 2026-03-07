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
  projectedRevenue: document.getElementById("projectedRevenue"),
  payerMultiplier: document.getElementById("payerMultiplier"),
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

const addTranscriptLine = (source, cleanedText, rawText, quality) => {
  clearEmpty(ui.transcriptFeed);

  const line = document.createElement("div");
  line.className = "tx-line provider";

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

  line.innerHTML = html;
  ui.transcriptFeed.prepend(line);
};

const addAssistantMessage = (text) => {
  clearEmpty(ui.chatFeed);
  const message = document.createElement("div");
  message.className = "chat-msg assistant";
  message.textContent = text;
  ui.chatFeed.prepend(message);
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
  ui.projectedRevenue.textContent = `$${safeNumber(tracker?.projectedTotal)}`;
  ui.payerMultiplier.textContent = `x${safeNumber(tracker?.payerMultiplier)}`;
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
    renderComplianceItem("Transcript Cleanup", status.integrations?.transcriptCleanupConfigured)
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

const summarizeAssistantUpdate = (suggestions, guidanceItems, model) => {
  const prefix = model ? `AI analysis (${model})` : "Assistant";
  const codePart = suggestions.length
    ? `Codes: ${suggestions.slice(0, 3).map((s) => `${s.code}: ${s.rationale || "supported"}`).join(" | ")}`
    : "Codes: koi naya compliant code detect nahi hua.";

  const guidanceText = formatGuidanceText(guidanceItems);
  const guidancePart = guidanceText
    ? `Doctor next prompts: ${guidanceText}`
    : "Doctor next prompts: encounter context gather karte raho (duration, severity, plan).";

  return `${prefix}: ${codePart} ${guidancePart}`;
};

const submitTranscriptSegment = async (text, source) => {
  if (!state.appointment) return null;

  const payload = await api(`/api/appointments/${state.appointment.id}/transcript`, {
    method: "POST",
    body: JSON.stringify({ segment: text, source }),
  });

  renderSuggestions(payload.allSuggestions || []);
  renderRevenueTracker(payload.revenueTracker || {});
  addAssistantMessage(
    summarizeAssistantUpdate(
      payload.newlyAddedSuggestions || [],
      payload.guidance?.items || [],
      payload.analysis?.model
    )
  );

  if (payload.analysis?.mode === "rule-engine+openai") {
    addLog(`Analyzed by ${payload.analysis.model || "OpenAI"}`, "good");
  }

  return payload;
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

const handleTranscriptSegment = async (text, source) => {
  if (shouldSkipDuplicateSegment(text)) {
    return;
  }

  const payload = await submitTranscriptSegment(text, source);
  if (!payload) return;

  const processed = payload.processedSegment || {
    source,
    rawText: text,
    cleanedText: text,
    quality: { confidence: 0.5, method: "fallback" },
  };

  addTranscriptLine(
    processed.source || source,
    processed.cleanedText || text,
    processed.rawText || text,
    processed.quality || null
  );

  const raw = String(processed.rawText || "").trim().toLowerCase();
  const cleaned = String(processed.cleanedText || "").trim().toLowerCase();
  if (raw && cleaned && raw !== cleaned) {
    addLog("Transcript auto-cleanup applied for noisy ASR text.", "good");
  }
};

const startAzureSpeech = async () => {
  if (!window.SpeechSDK) return false;

  try {
    const tokenData = await api("/api/azure/speech-token");
    if (!tokenData.configured || !tokenData.token || !tokenData.region) {
      addLog("Azure Speech not configured, browser fallback use hoga.", "warn");
      return false;
    }

    const speechConfig = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(
      tokenData.token,
      tokenData.region
    );
    speechConfig.speechRecognitionLanguage = "en-US";
    const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognized = (_sender, event) => {
      if (event.result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = event.result.text?.trim();
        if (text) {
          handleTranscriptSegment(text, "azure-live").catch((error) =>
            addLog(`Transcript submission failed: ${error.message}`, "warn")
          );
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
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.lang = "en-US";

  recognizer.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        const text = result[0]?.transcript?.trim();
        if (text) {
          handleTranscriptSegment(text, "browser-fallback").catch((error) =>
            addLog(`Fallback transcript failed: ${error.message}`, "warn")
          );
        }
      }
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

  addLog(`Doctor ${doctorRef} started appointment ${state.appointment.id}.`, "good");
  ui.sessionBadge.textContent = `Live: ${state.appointment.id}`;
  ui.sessionBadge.classList.add("active");

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
