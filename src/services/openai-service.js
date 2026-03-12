import { env } from "../config/env.js";

const analysisSystemInstructions = `
You are a medical encounter copilot for doctors.
You produce:
1) compliance-safe CPT/HCPCS coding opportunities
2) likely ICD-10 diagnosis suggestions
3) missed billable component warnings
4) documentation gap detection with concrete fixes
5) practical real-time prompts for what doctor should ask next.

Rules:
- Never upcode.
- Never suggest medically unnecessary services.
- Only suggest codes supported by explicit transcript evidence.
- Do not suggest baseline E/M code if it is already assumed for the visit.
- Guidance must be brief, concrete, and phrased as doctor prompts.
- If a code may be billable but documentation is incomplete, list it under missedBillables and documentationGaps.
- ICD suggestions should reflect likely clinical assessment language in transcript, not definitive diagnosis if evidence is weak.
- If evidence is weak, return empty arrays.
- Return JSON that matches schema.
`.trim();

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cptSuggestions: {
      type: "array",
      maxItems: 5,
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
    icdSuggestions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          description: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
        },
        required: ["code", "description", "rationale", "confidence", "evidence"],
      },
    },
    missedBillables: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          component: { type: "string" },
          potentialCode: { type: "string" },
          reason: { type: "string" },
          nextPrompt: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["component", "potentialCode", "reason", "nextPrompt", "confidence"],
      },
    },
    documentationGaps: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          gap: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          impact: { type: "string" },
          recommendedPrompt: { type: "string" },
        },
        required: ["gap", "severity", "impact", "recommendedPrompt"],
      },
    },
    realTimePrompts: {
      type: "array",
      maxItems: 6,
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
  required: ["cptSuggestions", "icdSuggestions", "missedBillables", "documentationGaps", "realTimePrompts"],
};

const emptyStructuredResponse = () => ({
  cptSuggestions: [],
  icdSuggestions: [],
  missedBillables: [],
  documentationGaps: [],
  realTimePrompts: [],
});

const normalizeStructuredOutput = (parsed) => {
  if (!parsed || typeof parsed !== "object") return emptyStructuredResponse();
  return {
    cptSuggestions: Array.isArray(parsed.cptSuggestions)
      ? parsed.cptSuggestions
      : Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : [],
    icdSuggestions: Array.isArray(parsed.icdSuggestions) ? parsed.icdSuggestions : [],
    missedBillables: Array.isArray(parsed.missedBillables) ? parsed.missedBillables : [],
    documentationGaps: Array.isArray(parsed.documentationGaps) ? parsed.documentationGaps : [],
    realTimePrompts: Array.isArray(parsed.realTimePrompts)
      ? parsed.realTimePrompts
      : Array.isArray(parsed.guidance)
        ? parsed.guidance
        : [],
  };
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
  if (fromOutputText) return normalizeStructuredOutput(fromOutputText);

  const chunks = result?.output ?? [];
  const text = chunks
    .flatMap((item) => item?.content || [])
    .map((content) => content?.text || "")
    .join(" ")
    .trim();

  if (!text) return emptyStructuredResponse();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return emptyStructuredResponse();
  }

  const parsed = parseCandidate(text.slice(first, last + 1));
  if (!parsed) return emptyStructuredResponse();

  return normalizeStructuredOutput(parsed);
};

export const analyzeTranscriptForSuggestions = async ({
  appointmentId,
  insurancePlan,
  visitType,
  transcriptContext,
  latestSegment,
  baselineCode = "99213",
  existingCodes = [],
}) => {
  if (!env.openAiApiKey) {
    const empty = emptyStructuredResponse();
    return { model: null, suggestions: [], guidance: [], ...empty };
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), env.aiRequestTimeoutMs);

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: timeoutController.signal,
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.openAiAnalysisModel,
        temperature: 0,
        max_output_tokens: 520,
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
                  `Latest segment: ${latestSegment || "n/a"}`,
                  "Transcript context (most recent first):",
                  transcriptContext,
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("OpenAI analysis timed out.");
    }
    throw error;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI analysis failed (${response.status}): ${body}`);
  }

  const result = await response.json();
  const parsed = parseStructuredOutput(result);

  return {
    model: result?.model || env.openAiAnalysisModel,
    cptSuggestions: parsed.cptSuggestions,
    icdSuggestions: parsed.icdSuggestions,
    missedBillables: parsed.missedBillables,
    documentationGaps: parsed.documentationGaps,
    realTimePrompts: parsed.realTimePrompts,
    suggestions: parsed.cptSuggestions,
    guidance: parsed.realTimePrompts,
  };
};

