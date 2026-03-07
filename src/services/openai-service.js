import { env } from "../config/env.js";

const analysisSystemInstructions = `
You are a medical encounter copilot for doctors.
You produce:
1) compliance-safe coding opportunities
2) practical conversation guidance for what doctor should ask or clarify next.

Rules:
- Never upcode.
- Never suggest medically unnecessary services.
- Only suggest codes supported by explicit transcript evidence.
- Do not suggest baseline E/M code if it is already assumed for the visit.
- Guidance must be brief, concrete, and phrased as doctor prompts.
- If evidence is weak, return empty arrays.
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
    guidance: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          rationale: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["prompt", "rationale", "priority"],
      },
    },
  },
  required: ["suggestions", "guidance"],
};

const parseStructuredOutput = (result) => {
  const parseCandidate = (candidate) => {
    if (!candidate || typeof candidate !== "string") return null;
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const fromOutputText = parseCandidate(result?.output_text);
  if (fromOutputText) {
    return {
      suggestions: Array.isArray(fromOutputText.suggestions) ? fromOutputText.suggestions : [],
      guidance: Array.isArray(fromOutputText.guidance) ? fromOutputText.guidance : [],
    };
  }

  const chunks = result?.output ?? [];
  const text = chunks
    .flatMap((item) => item?.content || [])
    .map((content) => content?.text || "")
    .join(" ")
    .trim();

  if (!text) return { suggestions: [], guidance: [] };

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { suggestions: [], guidance: [] };
  }

  const parsed = parseCandidate(text.slice(first, last + 1));
  if (!parsed) return { suggestions: [], guidance: [] };

  return {
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    guidance: Array.isArray(parsed.guidance) ? parsed.guidance : [],
  };
};

export const analyzeTranscriptForSuggestions = async ({
  appointmentId,
  insurancePlan,
  visitType,
  transcriptContext,
  baselineCode = "99213",
  existingCodes = [],
}) => {
  if (!env.openAiApiKey) {
    return { model: null, suggestions: [], guidance: [] };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiAnalysisModel,
      temperature: 0,
      max_output_tokens: 320,
      text: {
        format: {
          type: "json_schema",
          name: "encounter_guidance_and_coding",
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
                `Baseline E/M code already assumed: ${baselineCode}`,
                `Existing codes already selected: ${existingCodes.join(", ") || "none"}`,
                "Transcript context (most recent first):",
                transcriptContext,
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
  const parsed = parseStructuredOutput(result);

  return {
    model: result?.model || env.openAiAnalysisModel,
    suggestions: parsed.suggestions,
    guidance: parsed.guidance,
  };
};

