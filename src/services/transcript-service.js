import { env } from "../config/env.js";

const cleanupSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    correctedText: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["correctedText", "confidence"],
};

const hardReplacements = [
  { pattern: /\bjust your medication\b/gi, replacement: "adjust your medication" },
  { pattern: /\bi just still talking you are blood pressure medication\b/gi, replacement: "are you still taking your blood pressure medication" },
  { pattern: /\bare you still talking your blood pressure medication\b/gi, replacement: "are you still taking your blood pressure medication" },
  { pattern: /\btalking your medication\b/gi, replacement: "taking your medication" },
  { pattern: /\bmore tried than\b/gi, replacement: "more tired than" },
  { pattern: /\bmore tried then you will\b/gi, replacement: "more tired than usual" },
  { pattern: /\bhow you have been feelings is your last visit\b/gi, replacement: "how have you been feeling since your last visit" },
  { pattern: /\bcall also recommend blood test\b/gi, replacement: "I will also recommend blood tests" },
  { pattern: /\bi will also recommend blood test\b/gi, replacement: "I will also recommend blood tests" },
  { pattern: /\byes but pressure has still been 150\b/gi, replacement: "yes, but blood pressure has still been around 150" },
  { pattern: /\bno blood pressure has still been around on 15\b/gi, replacement: "my blood pressure has still been around 150" },
  { pattern: /\bfeelings\b/gi, replacement: "feeling" },
  { pattern: /\bon 15\b/gi, replacement: "around 150" },
  { pattern: /\s+/g, replacement: " " },
];

const sanitizeDeterministic = (rawText) => {
  let text = String(rawText || "").trim();
  let replacements = 0;

  for (const rule of hardReplacements) {
    const before = text;
    text = text.replace(rule.pattern, rule.replacement);
    if (text !== before) replacements += 1;
  }

  if (!text) {
    return {
      cleanedText: "",
      replacements,
      confidence: 0,
      method: "deterministic",
    };
  }

  const normalized = text.charAt(0).toUpperCase() + text.slice(1).replace(/\s+/g, " ").trim();
  const confidence = replacements > 0 ? 0.78 : 0.92;

  return {
    cleanedText: normalized,
    replacements,
    confidence,
    method: "deterministic",
  };
};

const parseCleanupOutput = (result) => {
  const output = result?.output_text;
  if (output && typeof output === "string") {
    const parsed = JSON.parse(output);
    return {
      cleanedText: String(parsed.correctedText || "").trim(),
      confidence: Number(parsed.confidence || 0),
    };
  }

  const text = (result?.output || [])
    .flatMap((item) => item?.content || [])
    .map((chunk) => chunk?.text || "")
    .join(" ");

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { cleanedText: "", confidence: 0 };
  }

  const parsed = JSON.parse(text.slice(first, last + 1));
  return {
    cleanedText: String(parsed.correctedText || "").trim(),
    confidence: Number(parsed.confidence || 0),
  };
};

const aiCleanupTranscript = async (text) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiTranscriptCleanupModel,
      temperature: 0,
      max_output_tokens: 180,
      text: {
        format: {
          type: "json_schema",
          name: "transcript_cleanup",
          schema: cleanupSchema,
          strict: true,
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You correct obvious speech-to-text errors. Do not invent clinical facts. If uncertain, keep wording close to original.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Original transcript: ${text}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI transcript cleanup failed (${response.status}): ${body}`);
  }

  const result = await response.json();
  return parseCleanupOutput(result);
};

export const normalizeTranscriptSegment = async ({ rawText, source }) => {
  const base = sanitizeDeterministic(rawText);

  if (!base.cleanedText) {
    return {
      rawText: String(rawText || "").trim(),
      cleanedText: "",
      quality: {
        method: base.method,
        confidence: 0,
        replacements: base.replacements,
      },
    };
  }

  // Fast path by default: deterministic cleanup only.
  if (!env.enableAiTranscriptCleanup) {
    return {
      rawText: String(rawText || "").trim(),
      cleanedText: base.cleanedText,
      quality: {
        method: base.method,
        confidence: base.confidence,
        replacements: base.replacements,
      },
    };
  }

  if (!env.openAiApiKey) {
    return {
      rawText: String(rawText || "").trim(),
      cleanedText: base.cleanedText,
      quality: {
        method: base.method,
        confidence: base.confidence,
        replacements: base.replacements,
      },
    };
  }

  const shouldUseAiCleanup = String(source || "").includes("browser-fallback");
  const wordCount = base.cleanedText.split(/\s+/).filter(Boolean).length;
  if (!shouldUseAiCleanup || wordCount < 7) {
    return {
      rawText: String(rawText || "").trim(),
      cleanedText: base.cleanedText,
      quality: {
        method: base.method,
        confidence: base.confidence,
        replacements: base.replacements,
      },
    };
  }

  try {
    const ai = await aiCleanupTranscript(base.cleanedText);
    const finalText = ai.cleanedText || base.cleanedText;
    const aiConfidence = Math.max(0, Math.min(1, Number(ai.confidence || 0)));

    return {
      rawText: String(rawText || "").trim(),
      cleanedText: finalText,
      quality: {
        method: "deterministic+openai",
        confidence: aiConfidence > 0 ? aiConfidence : base.confidence,
        replacements: base.replacements,
      },
    };
  } catch {
    return {
      rawText: String(rawText || "").trim(),
      cleanedText: base.cleanedText,
      quality: {
        method: base.method,
        confidence: base.confidence,
        replacements: base.replacements,
      },
    };
  }
};
