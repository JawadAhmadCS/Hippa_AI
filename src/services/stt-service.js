const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const asArray = (value) => (Array.isArray(value) ? value : []);

const extractAwsResults = (payload) => {
  if (!payload || typeof payload !== "object") return [];

  const transcriptEventResults = asArray(
    payload?.TranscriptEvent?.Transcript?.Results || payload?.transcriptEvent?.transcript?.results
  );
  if (transcriptEventResults.length) return transcriptEventResults;

  const directResults = asArray(payload?.Results || payload?.results);
  if (directResults.length) return directResults;

  return [];
};

const extractTextFromAwsResult = (result) => {
  const alternatives = asArray(result?.Alternatives || result?.alternatives);
  if (!alternatives.length) return "";
  return normalizeText(alternatives[0]?.Transcript || alternatives[0]?.transcript);
};

const isAwsPartial = (result) => {
  if (typeof result?.IsPartial === "boolean") return result.IsPartial;
  if (typeof result?.isPartial === "boolean") return result.isPartial;
  return false;
};

export const parseAwsTranscribeMedicalPayload = (payload) => {
  const results = extractAwsResults(payload);
  const segments = results
    .map((result) => ({
      text: extractTextFromAwsResult(result),
      isPartial: isAwsPartial(result),
      startTime: Number(result?.StartTime || result?.startTime || 0),
      endTime: Number(result?.EndTime || result?.endTime || 0),
    }))
    .filter((segment) => Boolean(segment.text));

  return {
    provider: "aws-transcribe-medical",
    segments,
  };
};

export const normalizeIncomingTranscript = (body) => {
  const rawSegment = normalizeText(body?.segment || body?.text || "");
  const source = normalizeText(body?.source || "unknown") || "unknown";
  return {
    source,
    segment: rawSegment,
  };
};

