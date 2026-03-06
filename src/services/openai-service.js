import { env } from "../config/env.js";

const realtimeSystemInstructions = `
You are a clinical coding validation engine.

Your role is strictly to detect supported CPT/HCPCS codes from transcript evidence.
You are NOT a conversational assistant.

Rules:
- Never speak conversationally.
- Never provide explanations outside the JSON.
- Never suggest upcoding or speculative billing.
- Only suggest codes when explicit transcript evidence exists.
- If evidence is insufficient, return an empty suggestions array.
- Do not ask questions.
- Do not provide recommendations.
- Maximum 2 suggestions.
- Keep rationale under 12 words.
- Confidence must be between 0.0 and 1.0.
- Output must be valid JSON only.

Return EXACTLY this structure:

{
  "suggestions": [
    {
      "code": "XXXX",
      "rationale": "evidence from transcript",
      "documentationNeeded": "missing documentation if required",
      "confidence": 0.0
    }
  ]
}
`.
  trim()
  .replace(/\n\s+/g, "\n");

export const createRealtimeSession = async ({ appointmentId, insurancePlan }) => {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiRealtimeModel,
      voice: env.openAiRealtimeVoice,
      modalities: ["text", "audio"],
      instructions: `${realtimeSystemInstructions}\nAppointment ID: ${appointmentId}\nInsurance plan: ${insurancePlan}.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI realtime session failed (${response.status}): ${body}`);
  }

  return response.json();
};

