# Helix Revenue Copilot - Full Client Project Overview

Last updated: 2026-03-27  
Environment: Prototype (single Node.js app, SPA frontend, file-backed encounter runtime state)

## 1) Executive Summary

Helix Revenue Copilot is a HIPAA-focused medical AI prototype that supports:

- live encounter transcription and analysis,
- coding guidance (CPT + ICD),
- provider note editing and finalization workflow,
- secure billing handoff with finalized note + transcript evidence (view-only),
- role-based access with login + 2FA,
- compliance and production readiness tracking.

This project is designed for workflow validation and implementation readiness. It is not positioned as final legal/compliance certification software.

## 1.1) Client Change Set (2026-03-27 Update)

The following requested changes are now represented in the prototype scope:

- Separate clinic/hospital landing portal support
  - Path-based clinic landing (`/c/<clinicId>` or `/clinic/<clinicId>`) with clinic-scoped login validation.
  - User session includes `clientId` and `clientName`, and encounter/report/billing data is filtered to clinic scope.
- Per-client login context
  - Login now accepts clinic context and rejects cross-clinic credential usage.
- AI chart notes latency + accuracy emphasis
  - Existing low-latency pipeline preserved (throttled live AI + rule engine fallback).
  - Suggested code outputs now require explicit MDM justification and transcript evidence linkage.
- Terminology updates
  - `CPT Suggestions` renamed to `Assistant Suggestions`.
  - `Current Billable Codes` renamed to `Suggested Codes`.
- Code-to-transcription traceability
  - Suggested code chips and billing code evidence are transcript-linkable via evidence drawer references.
- Telehealth support beyond Zoom
  - Encounter setup includes `encounterMode` and `telehealthPlatform`.
  - New generic telehealth transcript ingestion endpoint supports Zoom/Teams/Meet/Webex/custom payloads.
- Suggested code MDM justification
  - All CPT/HCPCS suggestions include `mdmJustification` in rule-based and AI-normalized flows.
- Doctor ID auto-fill
  - Doctor ID is auto-derived from authenticated provider username.
- Patient ID pull from chart records
  - New patient chart search API and UI pull flow populate patient references from chart records.
- AI chart note writeback to EHR
  - Finalize flow writes finalized chart-note package to mock EHR adapter log with external record ID.
- 2FA options
  - Authenticator app flow supports QR setup rendering.
  - SMS text code flow added as second-factor option.
- Revenue split clarity
  - Revenue tracker now exposes `currentCodesRevenue` and `suggestedCodesRevenue` explicitly.
- Specialty-aware coding context
  - Doctors carry one or multiple specialties; specialties are attached to encounters and included in AI analysis context.
- Provider additions merged directly into chart notes
  - Separate additional provider notes section removed; provider additions are merged into chart-note content.
- Billing portal view-only expansion
  - Billing final packet includes finalized chart note, transcript excerpts, final approved codes, and code-level justifications/evidence.
- Read from chart notes and write to EHR on finalize
  - Note generation reads chart-note context; finalization writes finalized note/codes to EHR adapter simulation.

## 2) Technology Stack

- Backend: Node.js, Express
- Frontend: Vanilla JS SPA (`public/index.html`, `public/app.js`)
- Security middleware: Helmet, CORS policy, rate limiting, optional internal API key gate
- AI: OpenAI Responses API for structured coding/documentation outputs
- Speech/Audio:
  - Azure Speech token flow (preferred)
  - Browser speech fallback
  - AWS Transcribe Medical event ingestion endpoint
- Storage:
  - Appointment runtime: in-process map with file persistence to `data/appointments.json`
  - Platform config: `data/platform-config.json`
  - Audit log: `data/audit-log.ndjson` (hash chained)
  - Auth users: `data/auth-users.json`
  - BAA uploads: `data/baa-documents/`
  - Audio local fallback: `uploads/<appointmentId>/...`

## 3) High-Level Architecture

### Frontend (Doctor/Billing/Admin UI)

- Single-page dashboard with role-based view availability.
- Live encounter workspace:
  - transcript-aware AI chart notes,
  - compliance prompts,
  - Assistant suggestions,
  - billable code panel,
  - provider note editor and finalization controls.
- Billing queue view shows finalized artifacts only.
- Settings, codebook, preferences, HIPAA, production readiness views for operational control.

### Backend Services

- `live-analysis-service.js`: live transcript analysis pipeline.
- `note-analysis-service.js`: coding recalculation based on edited provider note content.
- `appointment-store.js`: encounter runtime state, note versions, finalization state.
- `auth-service.js`: login, password verification, TOTP + SMS 2FA, session management.
- `audit-service.js`: append-only hash-linked audit events with PHI minimization.
- `platform-config-service.js`: settings persistence for HIPAA/readiness/preferences/codebook extensions.

## 4) Implemented User Roles and Access

- Provider
  - Can run encounters, edit notes, recalculate coding, finalize notes.
- Billing
  - Can access billing queue and finalized note packets only.
  - Cannot access draft note editing endpoints.
- Admin
  - Can access provider-level capabilities plus broader settings/readiness/HIPAA controls.

Role checks are enforced server-side on API routes, not only in UI.

## 5) Authentication and 2FA (Implemented)

### Flow

1. Username/password login (`/api/auth/login`)
2. 2FA challenge verification (`/api/auth/2fa/verify`)
3. Session token issued for authorized API usage
4. Session required for PHI APIs
5. Fresh 2FA session required for high-risk action (`note/finalize`)

### 2FA details

- TOTP (SHA1, 6 digits, 30s period) with QR setup URI
- SMS text-code option (prototype delivery flow)
- first login supports setup-required flow with secret + QR
- replay protection using `lastUsedCounter`
- failed attempt lockout policy included

### Demo seed users (prototype)

- `provider1 / Provider@123`
- `billing1 / Billing@123`
- `admin1 / Admin@123`

Important: these are bootstrap/demo credentials and must be rotated/removed in production.

## 6) Clinical Encounter and AI Workflow

### 6.1 Encounter start and consent gate

- Provider starts encounter only after consent fields are present.
- Backend enforces consent before transcript ingestion.

### 6.2 Live transcription and analysis

- Speech capture can use Azure Speech token flow or browser fallback.
- Transcript segments are normalized and analyzed in near real time.
- SSE stream pushes:
  - `transcript.accepted`
  - `analysis.update`
  - `transcript.partial`

### 6.3 Coding intelligence outputs

- Assistant suggestions
- ICD suggestions
- missed billables
- documentation gaps
- compliance/documentation prompts
- transcript evidence references for traceability

## 7) Provider Note Editor and Finalization Workflow

### 7.1 Editable note interface

Implemented structured provider note sections:

- HPI
- ROS
- Exam
- Assessment
- Plan
- Provider additions merged directly into chart notes content

Behavior:

- inline contenteditable section editing,
- section-based editing,
- autosave on input/blur with debounce.

### 7.2 AI vs provider content tracking

Each note version stores source metadata per field:

- `ai_generated`, `provider_added`, `provider_edited`
- created/updated by
- timestamps
- diff against prior version

### 7.3 Dynamic coding recalculation after edits

On note edit/save/recalculate:

- CPT/ICD recommendations refresh,
- confidence score refreshes,
- justification text refreshes,
- risk flags refresh,
- missing documentation prompts refresh.

### 7.4 Finalization lock

On provider finalize:

- current version marked final,
- note status set to finalized/locked,
- draft editing blocked unless amendment workflow explicitly invoked via API,
- delivery timestamps for EHR/billing packet simulation recorded.

### 7.5 Version control

Stores:

- initial AI version (`ai_original`),
- provider edit versions,
- finalized version,
- optional amendment versions.

## 8) Billing Visibility Enforcement

Implemented billing isolation:

- Billing queue endpoint returns finalized notes only.
- Billing final endpoint returns finalized note packet + approved codes + transcript/code evidence.
- Draft/intermediate notes are not exposed via billing routes.
- Billing role is blocked from provider draft-edit endpoints.

## 9) Provider Override Capture

Provider can submit:

- final CPT override list (optional),
- override reason (optional),

which is recorded in override records and audit history.

## 10) Audit and Compliance Controls

### Audit

- Hash-chained audit log (`prevHash`, `hash`) in NDJSON.
- Event logging for encounter, settings, note edits/finalization, auth events, uploads.
- PHI redaction/minimization on sensitive payload fields.

### HIPAA-oriented controls implemented in prototype

- consent gate before transcription,
- role-based access controls,
- audit trails,
- encryption status tracking in settings,
- BAA document upload and readiness linkage.

## 11) Production Readiness Subsystem

Tracks and scores go-live blockers across:

- required BAAs by vendor,
- legal review status,
- compliance review status,
- security hardening checklist (RBAC, SSO/MFA, key rotation, immutable audit export, scans),
- coder review workflow,
- codebook freshness.

APIs:

- `GET /api/production/readiness`
- `PUT /api/production/readiness`
- `GET /api/compliance/status`

## 12) API Catalog (Current)

### Public

- `GET /api/health`
- `GET /api/compliance/status`
- `POST /api/auth/login`
- `POST /api/auth/2fa/sms/send`
- `POST /api/auth/2fa/verify`

### Authenticated (all roles)

- `POST /api/auth/logout`
- `GET /api/auth/me`

### Provider/Admin

- `POST /api/appointments`
- `GET /api/patient-charts/search`
- `GET /api/patient-charts/:patientRef`
- `GET /api/appointments`
- `GET /api/appointments/:appointmentId`
- `GET /api/appointments/:appointmentId/note`
- `PUT /api/appointments/:appointmentId/note`
- `POST /api/appointments/:appointmentId/note/recalculate`
- `POST /api/appointments/:appointmentId/note/finalize` (fresh MFA required)
- `GET /api/appointments/:appointmentId/note/versions`
- `GET /api/appointments/:appointmentId/transcript.pdf`
- `GET /api/appointments/:appointmentId/audit`
- `GET /api/reports/revenue`
- `GET /api/reports/revenue/export.csv`
- `GET /api/appointments/:appointmentId/stream`
- `GET /api/azure/speech-token`
- `POST /api/appointments/:appointmentId/transcript`
- `POST /api/appointments/:appointmentId/transcript/aws-transcribe`
- `POST /api/appointments/:appointmentId/transcript/telehealth`
- `POST /api/appointments/:appointmentId/audio`
- `GET /api/codebook`
- `PUT /api/codebook/codes/:code`
- `GET /api/codes/search`
- `GET /api/settings/general`
- `PUT /api/settings/general`
- `GET /api/preferences`
- `PUT /api/preferences`
- `GET /api/codebook/extensions`
- `PUT /api/codebook/extensions`

### Billing/Admin

- `GET /api/billing/queue`
- `GET /api/billing/appointments/:appointmentId/final`

### Admin/Provider (compliance ops)

- `GET /api/audit/events`
- `GET /api/hipaa/settings`
- `PUT /api/hipaa/settings`
- `POST /api/hipaa/baa-documents`
- `GET /api/production/readiness`
- `PUT /api/production/readiness`

## 13) Frontend Views (Current)

- `view-live`: encounter + AI panels + provider note editor + finalize controls
- `view-billing`: finalized billing queue and view-only final note + transcript/code evidence
- `view-past`: past encounters and encounter audit viewer
- `view-revenue`: revenue analytics and exports
- `view-settings`: general practice settings
- `view-codebook`: CPT codebook editor + extensions
- `view-preferences`: doctor/user preferences
- `view-hipaa`: policy/access/masking/BAA/audit controls
- clinic landing routes: `/c/:clientId` and `/clinic/:clientId` for client-specific portal context

## 14) Configuration and Runtime Commands

### NPM scripts

- `npm run dev` -> run with watch
- `npm run start` -> run server
- `npm run check` -> codebook validation
- `npm run readiness` -> readiness report script
- `npm run readiness:strict` -> strict readiness script

### Key runtime env vars

- OpenAI: `OPENAI_API_KEY`, `OPENAI_ANALYSIS_MODEL`, latency knobs
- Azure: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_STORAGE_CONNECTION_STRING`
- Security: `REQUIRE_API_KEY`, `INTERNAL_API_KEY`, CORS/rate limit vars

## 15) Current Limitations (Important for Client Transparency)

- Encounter runtime state is persisted to `data/appointments.json` (`appointment-store`), so encounter data survives server restarts in this environment.
- EHR/billing delivery is represented as internal finalized packet workflow (not a full external EHR integration adapter yet).
- SMS delivery is prototype-mode (production carrier integration still required).
- Prototype includes compliance controls and auditability, but formal production/legal certification steps remain in readiness workflow.

## 16) Recommended Next Steps Before Production Rollout

1. Replace file-backed encounter store with production database (versioned note tables + audit index).
2. Add enterprise identity integration (SSO/IdP), enforced MFA policy at org level.
3. Implement external EHR and billing connector adapters with retry + DLQ behavior.
4. Add immutable external audit export/SIEM sink.
5. Harden secrets management, rotate demo credentials, and remove bootstrap users.
6. Add automated integration tests for role-based route access and finalize/billing guardrails.

---

If you want, this can be converted into a branded client handoff pack (executive summary, architecture diagram section, API appendix, and implementation timeline) in a second document.
