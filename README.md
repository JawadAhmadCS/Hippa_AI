# Helix Revenue Copilot (Prototype)

HIPAA-first medical AI assistant prototype for live doctor-patient encounters.

## Access Model (Doctor-Only)

- Doctor has full access to recordings, transcripts, suggestions, and coding output.
- Patient has no portal access in this prototype.
- Patient action is only intake consent signing before recording starts.
- Encounter creation now requires `doctorRef`, `consentFormId`, and `consentGiven=true`.

## Core Features

- Live speech-to-text transcription (Azure Speech token flow + browser fallback)
- AWS Transcribe Medical transcript event ingestion (backend endpoint)
- Transcript cleanup for noisy ASR lines before analysis
- Live doctor guidance prompts for what to ask next during appointment
- ICD-10 suggestion, documentation gap detection, and missed billable component alerts
- E/M guardrail: baseline code is not double-counted in compliant opportunity revenue
- Transcript analysis with OpenAI text models (no WebRTC realtime dependency)
- Compliant CPT/HCPCS opportunity suggestions
- Revenue projection with insurance multiplier + Medicare fallback, including current billable code breakdown
- Audio recording storage (Azure Blob + local fallback)
- SSE streaming channel for real-time backend analysis updates

## Important Scope

This is a prototype for compliant workflow design. It is not legal advice and not a finished billing product. Every coding suggestion must be reviewed by certified coders/billing staff.

## Current Model Strategy

- Live analysis model: `OPENAI_ANALYSIS_MODEL` (default `gpt-4.1-mini`)
- Transcript cleanup model: `OPENAI_TRANSCRIPT_CLEANUP_MODEL` (default `gpt-4.1-mini`)
- Optional deeper review model: `OPENAI_FINAL_REVIEW_MODEL` (default `gpt-4.1`)
- Transcription: Azure Speech (recommended) or browser fallback

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy env and add secrets:

```bash
cp .env.example .env
```

3. Validate codebook:

```bash
npm run check
```

4. Start app:

```bash
npm run dev
```

5. Open:

`http://localhost:8787`

## Run + Validation

```bash
npm run check
curl http://localhost:8787/api/health
curl http://localhost:8787/api/compliance/status
```

Expected:

- `/api/health` => `ok: true`
- `/api/compliance/status` => integration flags + doctor-only access model

## Environment Variables

See `.env.example`.

Required for full functionality:

- `OPENAI_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `AZURE_STORAGE_CONNECTION_STRING`

Also used:

- `OPENAI_ANALYSIS_MODEL` (default `gpt-4.1-mini`)
- `OPENAI_TRANSCRIPT_CLEANUP_MODEL` (default `gpt-4.1-mini`)
- `ENABLE_AI_TRANSCRIPT_CLEANUP` (default `false`)
- `AI_MIN_ANALYSIS_INTERVAL_MS` (default `3500`)
- `AI_MIN_WORDS_FOR_ANALYSIS` (default `6`)
- `AI_REQUEST_TIMEOUT_MS` (default `2800`)
- `AI_TARGET_LATENCY_MS` (default `3000`)
- `AI_CONTEXT_WINDOW_SEGMENTS` (default `6`)
- `OPENAI_FINAL_REVIEW_MODEL` (default `gpt-4.1`)
- `PORT` (default `8787`)
- `AZURE_STORAGE_CONTAINER` (default `appointment-audio`)
- `COMPLIANCE_LOG_RETENTION_DAYS`
- `CODEBOOK_STALE_DAYS`

## API Summary

- `POST /api/appointments` create encounter (doctor + intake consent required)
- `GET /api/appointments/:id` encounter status
- `GET /api/azure/speech-token` Azure speech token for live transcription
- `POST /api/appointments/:id/transcript` ingest transcript + cleanup + coding + doctor guidance + live revenue/code breakdown
- `POST /api/appointments/:id/transcript/aws-transcribe` ingest AWS Transcribe Medical `TranscriptEvent` payloads
- `GET /api/appointments/:id/stream` SSE live events (`transcript.accepted`, `analysis.update`, `transcript.partial`)
- `POST /api/appointments/:id/audio` upload encounter audio
- `GET /api/compliance/status` integration, access model, and codebook freshness
- `GET /api/codes/search?q=` CPT lookup

## Transcript Quality Notes

- Browser fallback speech recognition can distort medical terms.
- Server applies deterministic cleanup immediately; optional AI cleanup can be enabled with `ENABLE_AI_TRANSCRIPT_CLEANUP=true`.
- For best quality and lowest latency, configure Azure Speech keys.

## Latency Tuning

- Transcript lines render instantly in UI, then sync to backend in the background.
- OpenAI coding analysis is throttled by `AI_MIN_ANALYSIS_INTERVAL_MS` to reduce lag.
- Very short segments skip model analysis using `AI_MIN_WORDS_FOR_ANALYSIS`.

## HIPAA Notes

Implementation notes: [docs/HIPAA-IMPLEMENTATION.md](docs/HIPAA-IMPLEMENTATION.md)

Current controls include:

- Intake consent gate before transcription/recording
- PHI-minimized audit payloads
- Hash-chained audit events
- Compliance-safe coding prompt policy

Production HIPAA readiness still requires BAAs, security hardening, and legal/compliance review.

