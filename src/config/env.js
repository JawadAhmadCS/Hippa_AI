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

const asStringArray = (value, fallback = []) => {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
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
  requestBodyLimitMb: Math.max(1, asNumber(process.env.REQUEST_BODY_LIMIT_MB, 2)),
  corsAllowedOrigins: asStringArray(process.env.CORS_ALLOWED_ORIGINS, []),
  trustProxy: asBoolean(process.env.TRUST_PROXY, false),
  requireApiKey: asBoolean(process.env.REQUIRE_API_KEY, false),
  internalApiKey: process.env.INTERNAL_API_KEY ?? "",
  rateLimitEnabled: asBoolean(process.env.RATE_LIMIT_ENABLED, true),
  rateLimitWindowMs: Math.max(1000, asNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000)),
  rateLimitMaxRequests: Math.max(10, asNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 120)),
};

export const featureFlags = {
  hasOpenAi: Boolean(env.openAiApiKey),
  hasAzureSpeech: Boolean(env.azureSpeechKey && env.azureSpeechRegion),
  hasAzureBlobStorage: Boolean(env.azureStorageConnectionString),
  hasApiKeyConfigured: Boolean(env.internalApiKey),
  corsAllowlistEnabled: env.corsAllowedOrigins.length > 0,
};
