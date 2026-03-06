# Helix Revenue Copilot (Prototype)

HIPAA-first medical AI assistant prototype that combines:

- Live transcript capture (Azure Speech token flow + browser fallback)
- OpenAI Realtime assistant (`gpt-4o-realtime-preview`)
- Compliant CPT/HCPCS opportunity suggestions
- Revenue projection with insurance multiplier + Medicare fallback
- Audio recording capture and storage (Azure Blob + local fallback)

## Important Scope

This is a prototype for compliant workflow design. It is **not** legal advice and is **not** a finished billing product. Every suggestion must be reviewed by certified coders and billing staff.

## Tech Stack

- Backend: Node.js + Express
- Frontend: Vanilla JS + modern CSS (responsive)
- AI: OpenAI Realtime session minting (`/v1/realtime/sessions`)
- Speech/Storage: Azure Speech token + Azure Blob hooks

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and fill secrets:

```bash
cp .env.example .env
```

3. (Optional) Validate CPT codebook:

```bash
npm run check
```

4. Start server:

```bash
npm run dev
```

5. Open:

`http://localhost:8787`

## Run + Validation (Must Do)

1. Validate codebook integrity:

```bash
npm run check
```

2. Start app:

```bash
npm run dev
```

3. Verify runtime health:

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/compliance/status
```

Expected:

- `/api/health` returns `"ok": true`
- `/api/compliance/status` returns integration flags and codebook freshness

Validation run completed in this workspace on **March 7, 2026**:

- `npm run check`: passed
- source syntax checks (`node --check`): passed
- `/api/health`: passed
- `/api/compliance/status`: passed

## Environment Variables

See `.env.example`.

Minimum for full prototype behavior:

- `OPENAI_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `AZURE_STORAGE_CONNECTION_STRING`

Also used by this prototype:

- `PORT` (default `8787`)
- `OPENAI_REALTIME_MODEL` (default `gpt-4o-realtime-preview`)
- `OPENAI_REALTIME_VOICE` (default `alloy`)
- `AZURE_STORAGE_CONTAINER` (default `appointment-audio`)
- `COMPLIANCE_LOG_RETENTION_DAYS`
- `CODEBOOK_STALE_DAYS`

If keys are missing, app still runs in fallback mode:

- Realtime session endpoint returns config error when `OPENAI_API_KEY` is empty
- Azure speech falls back to browser speech recognition
- Audio upload falls back to local `uploads/` storage

## API Summary

- `POST /api/appointments` create encounter
- `POST /api/realtime/session` create OpenAI ephemeral realtime client secret
- `GET /api/azure/speech-token` get Azure speech auth token
- `POST /api/appointments/:id/transcript` ingest live transcript segment and run rule suggestions
- `POST /api/appointments/:id/realtime-suggestions` normalize/accept realtime model output
- `POST /api/appointments/:id/audio` upload encounter audio
- `GET /api/compliance/status` integration and codebook freshness status
- `GET /api/codes/search?q=` CPT lookup

## HIPAA Notes

Implementation notes: [docs/HIPAA-IMPLEMENTATION.md](docs/HIPAA-IMPLEMENTATION.md)

The current prototype includes:

- Consent gate
- PHI-minimized logging
- Hash-chained audit events
- Compliance-forward prompts

For production HIPAA readiness, complete BAAs, formal security controls, and legal/compliance review.

## Troubleshooting

- `EADDRINUSE: 8787`
  - Another process already uses port `8787`.
  - Stop that process or change `PORT` in `.env`.
- Azure transcription not starting
  - Verify `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`.
  - Browser fallback can still work if supported.
- No realtime assistant responses
  - Verify `OPENAI_API_KEY`.
  - Ensure realtime model is `gpt-4o-realtime-preview` (or your approved replacement).
