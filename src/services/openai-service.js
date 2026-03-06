import { env } from "../config/env.js";

const analysisSystemInstructions = `
You are a medical coding support assistant.
Your task is to produce compliance-safe, evidence-based coding opportunities from transcript text.

Rules:
- Never upcode.
- Never suggest medically unnecessary services.
- Only suggest codes supported by explicit transcript evidence.
- If evidence is weak, do not suggest the code.
- Keep rationale short and concrete.
- Return JSON that matches schema.
`.trim();

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          rationale: { type: "string" },
          documentationNeeded: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
        },
        required: ["code", "rationale", "documentationNeeded", "confidence", "evidence"],
      },
    },
  },
  required: ["suggestions"],
};

const parseStructuredOutput = (result) => {
  const candidate = result?.output_text;
  if (candidate && typeof candidate === "string") {
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    } catch {
      return [];
    }
  }

  const chunks = result?.output ?? [];
  const text = chunks
    .flatMap((item) => item?.content || [])
    .map((content) => content?.text || "")
    .join(" ")
    .trim();

  if (!text) return [];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return [];

  try {
    const parsed = JSON.parse(text.slice(first, last + 1));
    return Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  } catch {
    return [];
  }
};

export const analyzeTranscriptForSuggestions = async ({
  appointmentId,
  insurancePlan,
  visitType,
  segment,
  existingCodes = [],
}) => {
  if (!env.openAiApiKey) {
    return { model: null, suggestions: [] };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiAnalysisModel,
      temperature: 0.1,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "coding_suggestions",
          schema: outputSchema,
          strict: true,
        },
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: analysisSystemInstructions }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Appointment ID: ${appointmentId}`,
                `Insurance Plan: ${insurancePlan}`,
                `Visit Type: ${visitType}`,
                `Existing codes already selected: ${existingCodes.join(", ") || "none"}`,
                "Transcript segment:",
                segment,
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI analysis failed (${response.status}): ${body}`);
  }

  const result = await response.json();
  const suggestions = parseStructuredOutput(result);

  return {
    model: result?.model || env.openAiAnalysisModel,
    suggestions,
  };
};
