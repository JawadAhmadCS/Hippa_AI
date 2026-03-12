import dotenv from "dotenv";

dotenv.config();

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const env = {
  port: asNumber(process.env.PORT, 8787),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiAnalysisModel: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
  openAiFinalReviewModel: process.env.OPENAI_FINAL_REVIEW_MODEL ?? "gpt-4.1",
  openAiTranscriptCleanupModel: process.env.OPENAI_TRANSCRIPT_CLEANUP_MODEL ?? "gpt-4.1-mini",
  enableAiTranscriptCleanup: asBoolean(process.env.ENABLE_AI_TRANSCRIPT_CLEANUP, false),
  aiMinIntervalMs: asNumber(process.env.AI_MIN_ANALYSIS_INTERVAL_MS, 3500),
  aiMinWordsForAnalysis: asNumber(process.env.AI_MIN_WORDS_FOR_ANALYSIS, 6),
  aiRequestTimeoutMs: asNumber(process.env.AI_REQUEST_TIMEOUT_MS, 2800),
  aiTargetLatencyMs: asNumber(process.env.AI_TARGET_LATENCY_MS, 3000),
  aiContextWindowSegments: asNumber(process.env.AI_CONTEXT_WINDOW_SEGMENTS, 6),
  azureSpeechKey: process.env.AZURE_SPEECH_KEY ?? "",
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? "",
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",
  azureStorageContainer: process.env.AZURE_STORAGE_CONTAINER ?? "appointment-audio",
  complianceLogRetentionDays: asNumber(process.env.COMPLIANCE_LOG_RETENTION_DAYS, 365),
  codebookStaleDays: asNumber(process.env.CODEBOOK_STALE_DAYS, 90),
};

export const featureFlags = {
  hasOpenAi: Boolean(env.openAiApiKey),
  hasAzureSpeech: Boolean(env.azureSpeechKey && env.azureSpeechRegion),
  hasAzureBlobStorage: Boolean(env.azureStorageConnectionString),
};
