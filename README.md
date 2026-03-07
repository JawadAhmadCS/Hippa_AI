# Helix Revenue Copilot (Prototype)

HIPAA-first medical AI assistant prototype for live doctor-patient encounters.

## Access Model (Doctor-Only)

- Doctor has full access to recordings, transcripts, suggestions, and coding output.
- Patient has no portal access in this prototype.
- Patient action is only intake consent signing before recording starts.
- Encounter creation now requires `doctorRef`, `consentFormId`, and `consentGiven=true`.

## Core Features

- Live speech-to-text transcription (Azure Speech token flow + browser fallback)
- Transcript cleanup for noisy ASR lines before analysis
- Doctor guidance prompts for what to ask next during appointment
- E/M guardrail: baseline code is not double-counted in compliant opportunity revenue
- Transcript analysis with OpenAI text models (no WebRTC realtime dependency)
- Compliant CPT/HCPCS opportunity suggestions
- Revenue projection with insurance multiplier + Medicare fallback
- Audio recording storage (Azure Blob + local fallback)

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
- `OPENAI_FINAL_REVIEW_MODEL` (default `gpt-4.1`)
- `PORT` (default `8787`)
- `AZURE_STORAGE_CONTAINER` (default `appointment-audio`)
- `COMPLIANCE_LOG_RETENTION_DAYS`
- `CODEBOOK_STALE_DAYS`

## API Summary

- `POST /api/appointments` create encounter (doctor + intake consent required)
- `GET /api/appointments/:id` encounter status
- `GET /api/azure/speech-token` Azure speech token for live transcription
- `POST /api/appointments/:id/transcript` ingest transcript + cleanup + coding + doctor guidance
- `POST /api/appointments/:id/audio` upload encounter audio
- `GET /api/compliance/status` integration, access model, and codebook freshness
- `GET /api/codes/search?q=` CPT lookup

## Transcript Quality Notes

- Browser fallback speech recognition can distort medical terms.
- Server applies transcript cleanup before coding analysis.
- For best quality, configure Azure Speech keys.

## HIPAA Notes

Implementation notes: [docs/HIPAA-IMPLEMENTATION.md](docs/HIPAA-IMPLEMENTATION.md)

Current controls include:

- Intake consent gate before transcription/recording
- PHI-minimized audit payloads
- Hash-chained audit events
- Compliance-safe coding prompt policy

Production HIPAA readiness still requires BAAs, security hardening, and legal/compliance review.
