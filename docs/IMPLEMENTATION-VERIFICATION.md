# Live Analysis Upgrade - Implementation Verification

Last verified: 2026-03-18

This document captures the implemented upgrade items and their verification status in code.

## What I added (Verified)

1. Unified live analysis pipeline service with CPT + ICD suggestions, missed billables, documentation gaps/improvements, reimbursement estimates, and latency metadata.
   - Status: Verified
   - Evidence: `src/services/live-analysis-service.js`

2. OpenAI prompt/schema upgraded for strict JSON outputs (`cptSuggestions`, `icdSuggestions`, `missedBillables`, `documentationGaps`, `realTimePrompts`) with timeout guard for low latency.
   - Status: Verified
   - Evidence: `src/services/openai-service.js`

3. Rule engine expanded for ICD inference, missed billable detection, documentation gap detection, and documentation improvements fallback.
   - Status: Verified
   - Evidence: `src/services/suggestion-service.js`

4. AWS Transcribe Medical payload ingestion parser with `TranscriptEvent` support.
   - Status: Verified
   - Evidence: `src/services/stt-service.js`

5. Real-time streaming (SSE) event hub for ongoing appointment updates.
   - Status: Verified
   - Evidence: `src/services/streaming-service.js`

6. API routes rewired to use the new pipeline, including:
   - `GET /api/appointments/:appointmentId/stream`
   - `POST /api/appointments/:appointmentId/transcript/aws-transcribe`
   - richer structured response payloads (`outputs`, ICD, gaps, missed billables)
   - Status: Verified
   - Evidence: `src/routes/api.js`

7. Appointment state now stores ICD suggestions + live insights.
   - Status: Verified
   - Evidence: `src/services/appointment-store.js`

8. Frontend consumes SSE `analysis.update` and `transcript.partial` while encounter is active.
   - Status: Verified
   - Evidence: `public/app.js`

9. New latency/env knobs added and documented:
   - `AI_REQUEST_TIMEOUT_MS`
   - `AI_TARGET_LATENCY_MS`
   - `AI_CONTEXT_WINDOW_SEGMENTS`
   - Status: Verified
   - Evidence: `src/config/env.js`, `.env.example`, `README.md`

10. Transcript evidence linking added so suggested CPT codes, current billable codes, and compliance prompts can open the supporting transcript excerpt.
   - Status: Verified
   - Evidence: `src/services/evidence-service.js`, `src/services/live-analysis-service.js`, `public/app.js`, `public/index.html`

11. Doctor-facing live panel now shows AI chart notes while transcript text is retained in the background and exposed through an evidence drawer.
   - Status: Verified
   - Evidence: `src/services/chart-note-service.js`, `public/app.js`, `public/index.html`

12. Compliance prompt output normalized to short charting actions (for example duration, chronicity, medication management) with transcript-backed evidence refs.
   - Status: Verified
   - Evidence: `src/services/suggestion-service.js`, `public/app.js`

13. Live encounter start flow reordered so speech recognition starts before recorder upload handling, reducing cases where transcription only appears after ending the encounter.
   - Status: Verified
   - Evidence: `public/app.js`

## Old documentation verification

1. README verification
   - Streaming endpoint and AWS Transcribe endpoint are documented.
   - Latency/environment knobs are documented.
   - Status: Verified (`README.md`)

2. Environment sample verification
   - All three AI latency knobs exist in `.env.example`.
   - Status: Verified (`.env.example`)

3. Naming note
   - README uses `:id` in API summary, while routes use `:appointmentId` in code.
   - This is only a naming difference in docs; route behavior is aligned.

## Suggested quick validation commands

```bash
npm run check
npm run readiness
curl http://localhost:8787/api/compliance/status
curl http://localhost:8787/api/production/readiness
```

---

# Provider Editing, Finalization, and Billing Gate - Comprehensive Requirements

Last updated: 2026-03-25

This section defines implementation requirements for the provider-facing note editing workflow, coding recalculation, finalization lock, billing visibility controls, and secure access (login + 2FA).

## 1) Scope and goals

- Ensure provider has final authority over the clinical note and coding outcome.
- Keep coding suggestions synchronized with the current note content during editing.
- Prevent billing from seeing or editing draft/AI-only content.
- Preserve complete auditability for compliance and dispute defense.
- Enforce secure authenticated access with required two-factor authentication (2FA).

## 2) User roles and permissions (RBAC)

- Provider
  - Can view AI draft notes, edit all note sections, add clarifications, finalize note, and submit optional code override reason.
  - Can view coding recommendations, confidence, rationale, evidence links, and missing-documentation prompts.
- Billing user
  - Can view only finalized notes and approved codes.
  - Cannot view draft notes, intermediate versions, or raw AI output.
  - Cannot edit clinical note content.
- Admin/Compliance
  - Can view audit logs and version history per policy.
  - Cannot alter historical audit records.
- System service account
  - Can deliver finalized artifacts to EHR and billing integrations.

## 3) Functional requirements

### FR-01 Editable note interface

- System must render AI-generated note in structured sections:
  - HPI
  - ROS
  - Exam
  - Assessment
  - Plan
- Provider must be able to:
  - edit inline (click to edit text in place),
  - edit by section (open section editor),
  - insert free text at arbitrary positions (before/after sections and within sections).
- Auto-save must persist draft edits at a short interval or on blur/enter.

### FR-02 Additional provider notes area

- System must provide a dedicated input labeled exactly:
  - "Additional Provider Notes / Clarifications"
- Provider-entered content must be merged into the working note context used for coding analysis.
- This area must support documentation use cases:
  - missed details,
  - diagnosis clarification,
  - coding support justification,
  - findings not spoken during encounter.

### FR-03 AI vs provider content tracking

- Every note segment must store source metadata:
  - `sourceType`: `ai_generated` | `provider_added` | `provider_edited`
  - `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
  - `versionId`
- System must track provider edits as diffs against prior version.
- UI highlighting of origin (AI vs provider) is optional but metadata storage is required.

### FR-04 Recalculate coding after edits (critical)

- Any provider edit to note content or additional notes must trigger coding re-evaluation.
- Re-evaluation must update:
  - CPT recommendations,
  - ICD recommendations,
  - confidence scores,
  - code justification text,
  - risk/compliance flags.
- Recalculation must be near real-time and debounced to avoid excessive calls.
- UI must visibly indicate analysis state (`updating`, `ready`, `error`).

### FR-05 Finalization lock

- Provider must explicitly click `Finalize` to mark note complete.
- On finalize:
  - current note snapshot is locked as `final`,
  - finalized version ID is immutable,
  - finalized note is sent to configured EHR destination,
  - approved coding package is sent to billing destination.
- After finalization:
  - note is read-only for non-versioned edits,
  - further changes require a controlled amendment workflow that creates a new version with reason.

### FR-06 Version control and auditability (high value)

- System must store:
  - original AI-generated draft version,
  - each provider-edited draft version,
  - final version.
- Each version record must include:
  - timestamp,
  - user identity,
  - role,
  - change summary/diff,
  - analysis snapshot (codes, confidence, flags at that time).
- Version history must be queryable for audits and dispute review.

### FR-07 Coding visibility during editing

- While provider edits, UI must display:
  - current recommended CPT/ICD,
  - justification per code,
  - transcript evidence references.
- Values must refresh whenever recalculation completes.
- Evidence references must resolve to transcript excerpts with stable identifiers.

### FR-08 Missing documentation prompts

- During editing, system must show non-blocking prompts when coding support is weak.
- Prompt examples:
  - "Add duration to support time-based coding"
  - "Clarify severity of condition"
  - "Document medication management"
- Prompts must be dismissible and must not block finalization.

### FR-09 Billing visibility rules (critical)

- Billing UI/API must expose only:
  - finalized note content,
  - approved codes,
  - final justification package.
- Billing must not access:
  - draft versions,
  - intermediate edits,
  - raw AI outputs/transcripts unless explicitly approved by policy and role.
- Any access violation attempt must be denied and audit logged.

### FR-10 Provider override reason (optional but recommended)

- If provider changes/overrides suggested code, system should offer optional field:
  - `overrideReason`
- Suggested values include:
  - clinical judgment,
  - documentation limitation,
  - payer-specific interpretation.
- Override reason must be included in audit history and final coding packet when present.

### FR-11 Authentication and 2FA (required)

- All users must authenticate before accessing PHI.
- 2FA must be enforced for all interactive users (provider, billing, admin).
- Supported factors:
  - TOTP authenticator app (required baseline),
  - optional backup method per org policy (for example hardware key or secure backup codes).
- Login flow must include:
  - username/password verification,
  - second-factor challenge,
  - device/session binding with expiration,
  - lockout/rate limiting after repeated failures.
- Recovery flow must require identity verification and be audit logged.

### FR-12 Session and access security

- Session tokens must be short-lived and securely stored.
- Re-authentication required for high-risk actions:
  - finalization,
  - access to audit exports,
  - changing authentication settings.
- Automatic session timeout must be enforced after inactivity.

## 4) HIPAA and security requirements

- Encryption in transit:
  - TLS 1.2+ for all client/server and service/service communication.
- Encryption at rest:
  - notes, transcripts, versions, and audit logs encrypted with managed key service.
- Minimum necessary access:
  - enforce least-privilege RBAC on UI and APIs.
- Audit log must capture:
  - who performed action,
  - what changed,
  - when it changed,
  - source IP/device/session where applicable.
- Audit records must be append-only and tamper-evident.
- PHI must never be included in client logs, analytics beacons, or unsecured error traces.

## 5) Data model requirements (minimum)

- `Note`
  - `noteId`, `appointmentId`, `status` (`draft`, `finalized`, `amended`), `currentVersionId`
- `NoteVersion`
  - `versionId`, `noteId`, `versionNumber`, `isFinal`, `contentJson`, `sourceMetadata`, `diffFromPrior`, `createdBy`, `createdAt`
- `CodingAnalysis`
  - `analysisId`, `versionId`, `cptCodes[]`, `icdCodes[]`, `confidence`, `justification`, `riskFlags[]`, `evidenceRefs[]`, `generatedAt`
- `OverrideRecord`
  - `overrideId`, `versionId`, `originalCode`, `finalCode`, `reason`, `providerId`, `timestamp`
- `AuditEvent`
  - `eventId`, `entityType`, `entityId`, `action`, `actorId`, `actorRole`, `timestamp`, `metadata`

## 6) API and workflow requirements

- Draft editing endpoints must be provider-auth only.
- Recalculation endpoint/event must accept current draft version and return updated coding package.
- Finalization endpoint must:
  - verify provider authorization,
  - verify 2FA-authenticated session freshness,
  - atomically lock final version and publish to downstream integrations.
- Billing retrieval endpoint must filter to finalized artifacts only.

## 7) Non-functional requirements

- Availability target for editing and coding refresh: >= 99.9% (excluding planned maintenance).
- P95 recalculation response target: <= 3 seconds under normal load.
- Autosave durability: no confirmed edit loss after successful save response.
- Concurrency control: prevent silent overwrite using version checks (optimistic locking).

## 8) Compliance guardrails (must-not rules)

- Billing users must never edit clinical note text.
- AI-generated draft must never be treated as final without provider action.
- Codes sent to billing must always correspond to finalized note version.
- Deleted/changed content must remain reconstructable via version history per retention policy.

## 9) Acceptance criteria checklist

- Provider can edit HPI/ROS/Exam/Assessment/Plan inline and by section.
- Provider can add free text and additional clarifications.
- System distinguishes AI text vs provider text in stored metadata.
- Coding recommendations update after note edits with changed confidence/justification/flags.
- Provider can finalize; note becomes read-only (or amendment-only).
- Original AI draft, intermediate versions, and final version are all retrievable by authorized roles.
- Billing user sees only final note and approved codes.
- Provider can enter optional code override reason.
- Login requires 2FA and logs success/failure attempts.
- Audit log shows who changed what and when for each version transition.

## 10) Implementation status in code (2026-03-25 update)

1. Provider note editing workflow implemented (structured sections + additional notes + free text + autosave).
   - Status: Implemented
   - Evidence: `public/index.html`, `public/app.js`

2. AI vs provider edit tracking metadata implemented at version level.
   - Status: Implemented
   - Evidence: `src/services/appointment-store.js`

3. Note versioning lifecycle implemented (AI original, provider edits, finalized, amendment support).
   - Status: Implemented
   - Evidence: `src/services/appointment-store.js`

4. Dynamic code recalculation from edited notes implemented (CPT/ICD, confidence, justifications, risk flags, prompts).
   - Status: Implemented
   - Evidence: `src/services/note-analysis-service.js`, `src/routes/api.js`

5. Finalization lock + read-only behavior implemented with recent-2FA requirement.
   - Status: Implemented
   - Evidence: `src/services/appointment-store.js`, `src/routes/api.js`

6. Billing visibility isolation implemented (billing queue and final-note-only endpoints).
   - Status: Implemented
   - Evidence: `src/routes/api.js`, `public/index.html`, `public/app.js`

7. Provider override reason capture implemented on finalize.
   - Status: Implemented
   - Evidence: `public/index.html`, `public/app.js`, `src/routes/api.js`, `src/services/appointment-store.js`

8. Login + 2FA authentication flow implemented (password + TOTP challenge + session tokens).
   - Status: Implemented
   - Evidence: `src/services/auth-service.js`, `src/routes/api.js`, `public/index.html`, `public/app.js`
