const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const asArray = (value) => (Array.isArray(value) ? value : []);
const normalizeProvider = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

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

export const parseTelehealthTranscriptPayload = (payload = {}) => {
  const providerId =
    normalizeProvider(payload?.provider || payload?.platform || payload?.vendor || "telehealth") ||
    "telehealth";

  const candidateSegments = asArray(
    payload?.segments ||
      payload?.transcriptSegments ||
      payload?.lines ||
      payload?.results ||
      payload?.items
  );

  const segments = candidateSegments
    .map((item) => {
      if (typeof item === "string") {
        return {
          text: normalizeText(item),
          isPartial: false,
          speaker: "",
          startTime: 0,
          endTime: 0,
        };
      }
      const text = normalizeText(
        item?.text || item?.transcript || item?.content || item?.utterance || item?.message || ""
      );
      return {
        text,
        isPartial: Boolean(item?.isPartial || item?.partial),
        speaker: normalizeText(item?.speaker || item?.participant || item?.role || ""),
        startTime: Number(item?.startTime || item?.start || 0),
        endTime: Number(item?.endTime || item?.end || 0),
      };
    })
    .filter((segment) => Boolean(segment.text));

  return {
    provider: `telehealth-${providerId}`,
    platform: providerId,
    segments,
  };
};
