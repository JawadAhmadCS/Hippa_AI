const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "may",
  "not",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with",
]);

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) =>
  normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const uniqueStrings = (items) => {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const scoreSegment = (segmentText, cueText, cueTokens) => {
  if (!segmentText) return 0;

  let score = 0;
  if (cueText && segmentText.includes(cueText)) {
    score += 12;
  }

  if (cueTokens.length) {
    const overlap = cueTokens.filter((token) => segmentText.includes(token)).length;
    score += overlap * 2;
  }

  return score;
};

export const mergeEvidenceRefs = (...collections) => {
  const merged = [];
  const seen = new Set();

  for (const collection of collections) {
    for (const ref of collection || []) {
      const segmentId = String(ref?.segmentId || "").trim();
      if (!segmentId || seen.has(segmentId)) continue;
      seen.add(segmentId);
      merged.push({
        segmentId,
        source: String(ref?.source || "").trim(),
        at: ref?.at || "",
        excerpt: String(ref?.excerpt || "").trim(),
        sequence: Number(ref?.sequence || 0),
      });
    }
  }

  return merged;
};

export const buildEvidenceRefs = ({
  transcriptSegments = [],
  cueTexts = [],
  maxRefs = 2,
  fallbackToLatest = true,
} = {}) => {
  const segments = Array.isArray(transcriptSegments) ? transcriptSegments : [];
  if (!segments.length) return [];

  const normalizedCues = uniqueStrings(cueTexts);
  const cues = normalizedCues.map((cueText) => ({
    cueText,
    cueTokens: tokenize(cueText),
  }));

  const ranked = segments
    .map((segment) => {
      const excerpt = String(segment?.cleanedText || segment?.text || "").trim();
      const normalizedSegment = normalizeText(excerpt);
      const score = cues.reduce(
        (best, cue) => Math.max(best, scoreSegment(normalizedSegment, cue.cueText, cue.cueTokens)),
        0
      );

      return {
        segmentId: String(segment?.id || "").trim(),
        source: String(segment?.source || "transcript").trim(),
        at: segment?.at || "",
        excerpt,
        sequence: Number(segment?.sequence || 0),
        score,
      };
    })
    .filter((item) => item.segmentId);

  const matched = ranked
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.sequence - left.sequence)
    .slice(0, Math.max(1, maxRefs))
    .map(({ score: _score, ...rest }) => rest);

  if (matched.length) {
    return matched;
  }

  if (!fallbackToLatest) {
    return [];
  }

  const latest = [...ranked].sort((left, right) => right.sequence - left.sequence)[0];
  if (!latest) return [];

  const { score: _score, ...fallback } = latest;
  return [fallback];
};

export const attachEvidenceRefsToItems = (
  items,
  { transcriptSegments = [], cueSelector, maxRefs = 2, fallbackToLatest = true } = {}
) => {
  if (!Array.isArray(items) || typeof cueSelector !== "function") return [];

  return items.map((item) => {
    const existing = Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : [];
    const cues = cueSelector(item)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean);

    return {
      ...item,
      evidenceRefs: mergeEvidenceRefs(
        existing,
        buildEvidenceRefs({
          transcriptSegments,
          cueTexts: cues,
          maxRefs,
          fallbackToLatest,
        })
      ),
    };
  });
};
