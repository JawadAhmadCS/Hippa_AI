const state = {
  appointment: null,
  mediaRecorder: null,
  recordingChunks: [],
  micStream: null,
  speechRecognizer: null,
  browserRecognizer: null,
  peerConnection: null,
  dataChannel: null,
  realtimeBuffer: "",
};

const ui = {
  patientRef: document.getElementById("patientRef"),
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
  assistantAudio: document.getElementById("assistantAudio"),
};

const safeNumber = (value) => Number(value || 0).toFixed(2);

const addLog = (line) => {
  const at = new Date().toLocaleTimeString();
  const node = document.createElement("div");
  node.textContent = `[${at}] ${line}`;
  ui.eventLog.prepend(node);
};

const addEntry = (container, tag, text) => {
  const wrapper = document.createElement("div");
  wrapper.className = "entry";
  const title = document.createElement("div");
  title.className = "tag";
  title.textContent = tag;
  const body = document.createElement("div");
  body.textContent = text;
  wrapper.appendChild(title);
  wrapper.appendChild(body);
  container.prepend(wrapper);
};

const renderSuggestions = (suggestions) => {
  ui.suggestionList.innerHTML = "";
  if (!suggestions.length) {
    ui.suggestionList.textContent = "No compliant suggestions yet.";
    return;
  }

  for (const item of suggestions) {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.innerHTML = `
      <div class="head">
        <div>
          <div class="code">${item.code}</div>
          <strong>${item.title || "CPT/HCPCS suggestion"}</strong>
        </div>
        <div class="confidence">${Math.round((item.confidence || 0) * 100)}% confidence</div>
      </div>
      <p>${item.rationale || "No rationale."}</p>
      <p><b>Documentation:</b> ${item.documentationNeeded || "Document medical necessity."}</p>
      <p><b>Compliance:</b> ${item.complianceNotes || "Coder review required."}</p>
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

const refreshComplianceStatus = async () => {
  const status = await api("/api/compliance/status");
  const age = status.codebook?.ageDays ?? "unknown";
  const stale = status.codebook?.stale ? "Yes" : "No";
  ui.compliancePanel.innerHTML = `
    <p><b>Codebook Version:</b> ${status.codebook?.version || "n/a"}</p>
    <p><b>Codebook Age:</b> ${age} days</p>
    <p><b>Codebook Stale:</b> ${stale}</p>
    <p><b>OpenAI Realtime:</b> ${status.integrations?.openAiRealtimeConfigured ? "Configured" : "Not configured"}</p>
    <p><b>Azure Speech:</b> ${status.integrations?.azureSpeechConfigured ? "Configured" : "Not configured"}</p>
    <p><b>Azure Blob:</b> ${status.integrations?.azureBlobConfigured ? "Configured" : "Not configured"}</p>
  `;
};

const parseJsonSuggestions = (text) => {
  if (!text || typeof text !== "string") return [];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return [];
  try {
    const parsed = JSON.parse(text.slice(first, last + 1));
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  } catch {
    return [];
  }
};

const sendRealtimeEvent = (event) => {
  if (state.dataChannel && state.dataChannel.readyState === "open") {
    state.dataChannel.send(JSON.stringify(event));
  }
};

const submitRealtimeSuggestions = async (suggestions) => {
  if (!state.appointment || !suggestions.length) return;
  const data = await api(`/api/appointments/${state.appointment.id}/realtime-suggestions`, {
    method: "POST",
    body: JSON.stringify({ suggestions }),
  });
  renderSuggestions(data.allSuggestions || []);
  renderRevenueTracker(data.revenueTracker || {});
};

const handleRealtimeMessage = async (payload) => {
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return;
  }

  if (typeof event.delta === "string" && event.type?.includes("delta")) {
    state.realtimeBuffer += event.delta;
  }

  if (event.type === "response.output_text.done" || event.type === "response.done") {
    let text = "";
    if (typeof event.text === "string") text = event.text;
    if (!text && state.realtimeBuffer) text = state.realtimeBuffer;
    if (!text && event.response?.output_text) text = event.response.output_text;
    if (!text && Array.isArray(event.response?.output)) {
      text = event.response.output
        .map((item) => item?.content?.map((c) => c?.text || "").join(" "))
        .join(" ");
    }
    if (text) {
      addEntry(ui.chatFeed, "assistant", text);
      const suggestions = parseJsonSuggestions(text);
      if (suggestions.length) {
        await submitRealtimeSuggestions(suggestions);
      }
    }
    state.realtimeBuffer = "";
  }
};

const connectRealtimeAssistant = async () => {
  if (!state.appointment) return;

  try {
    const session = await api("/api/realtime/session", {
      method: "POST",
      body: JSON.stringify({
        appointmentId: state.appointment.id,
        insurancePlan: state.appointment.insurancePlan,
      }),
    });

    if (!session.clientSecret) {
      addLog("OpenAI Realtime not configured on server.");
      return;
    }

    const peer = new RTCPeerConnection();
    state.peerConnection = peer;
    const dataChannel = peer.createDataChannel("oai-events");
    state.dataChannel = dataChannel;

    if (state.micStream) {
      for (const track of state.micStream.getTracks()) {
        peer.addTrack(track, state.micStream);
      }
    } else {
      peer.addTransceiver("audio", { direction: "recvonly" });
    }

    peer.ontrack = (event) => {
      ui.assistantAudio.srcObject = event.streams[0];
    };

    dataChannel.onopen = () => {
      addLog("Realtime data channel connected.");
      sendRealtimeEvent({
        type: "session.update",
        session: {
          instructions:
            "You are a compliant medical coding copilot. Never upcode. Return JSON with top 3 evidence-based suggestions only.",
        },
      });
    };
    dataChannel.onmessage = (event) => {
      handleRealtimeMessage(event.data).catch((error) => addLog(`Realtime parse error: ${error.message}`));
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Realtime SDP failed (${response.status}): ${body}`);
    }

    const answer = await response.text();
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
    addLog(`Realtime session active (${session.model}).`);
  } catch (error) {
    addLog(`Realtime disabled: ${error.message}`);
  }
};

const pushTranscriptToAssistant = (text) => {
  sendRealtimeEvent({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: `Transcript evidence: ${text}` }],
    },
  });
  sendRealtimeEvent({
    type: "response.create",
    response: {
      modalities: ["text"],
      instructions:
        "Return JSON only. Suggest compliant CPT/HCPCS opportunities backed by transcript evidence. If uncertain, return empty list.",
    },
  });
};

const submitTranscriptSegment = async (text, source) => {
  if (!state.appointment) return;
  const payload = await api(`/api/appointments/${state.appointment.id}/transcript`, {
    method: "POST",
    body: JSON.stringify({ segment: text, source }),
  });
  renderSuggestions(payload.allSuggestions || []);
  renderRevenueTracker(payload.revenueTracker || {});
};

const handleTranscriptSegment = async (text, source) => {
  addEntry(ui.transcriptFeed, source, text);
  await submitTranscriptSegment(text, source);
  pushTranscriptToAssistant(text);
};

const startAzureSpeech = async () => {
  if (!window.SpeechSDK) return false;

  try {
    const tokenData = await api("/api/azure/speech-token");
    if (!tokenData.configured || !tokenData.token || !tokenData.region) {
      addLog("Azure Speech not configured. Falling back to browser speech recognition.");
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
            addLog(`Transcript submission failed: ${error.message}`)
          );
        }
      }
    };

    recognizer.canceled = (_sender, event) => {
      addLog(`Azure recognizer canceled: ${event.errorDetails || event.reason}`);
    };

    recognizer.startContinuousRecognitionAsync();
    state.speechRecognizer = recognizer;
    addLog("Azure speech recognition started.");
    return true;
  } catch (error) {
    addLog(`Azure speech failed: ${error.message}`);
    return false;
  }
};

const startBrowserSpeechFallback = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addLog("No speech recognition available in this browser.");
    return false;
  }

  const recognizer = new SpeechRecognition();
  recognizer.continuous = true;
  recognizer.interimResults = false;
  recognizer.lang = "en-US";

  recognizer.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        const text = result[0]?.transcript?.trim();
        if (text) {
          handleTranscriptSegment(text, "browser-fallback").catch((error) =>
            addLog(`Fallback transcript failed: ${error.message}`)
          );
        }
      }
    }
  };
  recognizer.onerror = (event) => addLog(`Speech fallback error: ${event.error}`);
  recognizer.start();
  state.browserRecognizer = recognizer;
  addLog("Browser speech fallback started.");
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
  addLog("Encounter recording started.");
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
  addLog(`Recording uploaded to ${uploaded.recording.provider}.`);
};

const startEncounter = async () => {
  if (!ui.consentGiven.checked) {
    alert("Consent is required before starting encounter recording.");
    return;
  }

  const patientRef = ui.patientRef.value.trim() || "anonymous";
  const insurancePlan = ui.insurancePlan.value;
  const visitType = ui.visitType.value;

  const created = await api("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientRef,
      insurancePlan,
      visitType,
      consentGiven: true,
    }),
  });
  state.appointment = created.appointment;
  addLog(`Appointment created: ${state.appointment.id}`);
  ui.sessionBadge.textContent = `Live: ${state.appointment.id}`;

  state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  startRecording();
  const azureStarted = await startAzureSpeech();
  if (!azureStarted) {
    startBrowserSpeechFallback();
  }
  await connectRealtimeAssistant();

  ui.startBtn.disabled = true;
  ui.stopBtn.disabled = false;
};

const stopEncounter = async () => {
  ui.stopBtn.disabled = true;

  if (state.speechRecognizer) {
    state.speechRecognizer.stopContinuousRecognitionAsync(
      () => addLog("Azure speech stopped."),
      (error) => addLog(`Error stopping Azure speech: ${error}`)
    );
    state.speechRecognizer = null;
  }

  if (state.browserRecognizer) {
    state.browserRecognizer.stop();
    state.browserRecognizer = null;
    addLog("Browser fallback speech stopped.");
  }

  if (state.dataChannel) {
    state.dataChannel.close();
    state.dataChannel = null;
  }

  if (state.peerConnection) {
    state.peerConnection.close();
    state.peerConnection = null;
  }

  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
  }

  try {
    await stopRecordingAndUpload();
  } catch (error) {
    addLog(error.message);
  }

  ui.sessionBadge.textContent = "Session Idle";
  ui.startBtn.disabled = false;
  addLog("Encounter ended.");
};

ui.startBtn.addEventListener("click", () => {
  startEncounter().catch((error) => addLog(`Start failed: ${error.message}`));
});

ui.stopBtn.addEventListener("click", () => {
  stopEncounter().catch((error) => addLog(`Stop failed: ${error.message}`));
});

refreshComplianceStatus().catch((error) => addLog(`Compliance status error: ${error.message}`));

