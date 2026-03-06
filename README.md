# Helix Revenue Copilot (Prototype)

HIPAA-first medical AI assistant prototype for live doctor-patient encounters:

- Live speech-to-text transcription (Azure Speech token flow + browser fallback)
- Transcript cleanup for noisy ASR lines before analysis
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

Reason: for this workflow, low-latency text analysis over transcript chunks is enough; realtime WebRTC model is not required.

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
- `/api/compliance/status` => integration flags + codebook freshness

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

Fallback behavior:

- Missing OpenAI key => app still runs with rule-engine suggestions
- Missing Azure speech keys => browser speech recognition fallback
- Missing Azure storage => local `uploads/` fallback

## API Summary

- `POST /api/appointments` create encounter
- `GET /api/appointments/:id` encounter status
- `GET /api/azure/speech-token` Azure speech token for live transcription
- `POST /api/appointments/:id/transcript` ingest transcript segment + cleanup + analyze with rule engine and OpenAI model
- `POST /api/appointments/:id/audio` upload encounter audio
- `GET /api/compliance/status` integration and codebook freshness
- `GET /api/codes/search?q=` CPT lookup

## Transcript Quality Notes

- Browser fallback speech recognition can distort medical terms.
- Server now applies transcript cleanup before coding analysis.
- For best quality and production use, configure Azure Speech keys.

## HIPAA Notes

Implementation notes: [docs/HIPAA-IMPLEMENTATION.md](docs/HIPAA-IMPLEMENTATION.md)

Current controls include:

- Consent gate before transcription/recording
- PHI-minimized audit payloads
- Hash-chained audit events
- Compliance-safe coding prompt policy

Production HIPAA readiness still requires BAAs, security hardening, and legal/compliance review.

## Troubleshooting

- `EADDRINUSE: 8787`
  - Another process already uses port `8787`
  - Stop that process or change `PORT` in `.env`
- Azure transcription not starting
  - Check `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`
- No OpenAI analysis suggestions
  - Check `OPENAI_API_KEY` and `OPENAI_ANALYSIS_MODEL`
- Transcript text still noisy
  - Configure Azure Speech (browser fallback quality is limited)
  - Keep mic close and reduce room noise
