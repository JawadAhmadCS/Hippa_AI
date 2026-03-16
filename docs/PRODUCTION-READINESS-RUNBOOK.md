# Production Readiness Runbook

This project now supports a formal readiness workflow for BAAs, security hardening, and legal/compliance approvals.

## 1) Configure Security Baseline

Set these in `.env` for production:

- `REQUIRE_API_KEY=true`
- `INTERNAL_API_KEY=<strong-random-secret>`
- `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com`
- `RATE_LIMIT_ENABLED=true`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX_REQUESTS=120`
- `TRUST_PROXY=true` (if behind load balancer)

## 2) Upload BAA Evidence

Use `POST /api/hipaa/baa-documents` with multipart form:

- `document` (file)
- `vendor` (example: `openai`, `azure`, `hosting`, `logging`)
- `agreementType` (default `BAA`)
- `uploadedBy`

Uploading vendor-tagged BAAs automatically updates vendor readiness status.

## 3) Record Legal + Compliance Review

Use `PUT /api/production/readiness` and set:

- `legalReview.status` to `completed`
- `complianceReview.status` to `completed`
- `reviewedBy` and `reviewedAt` fields

## 4) Mark Security Hardening Controls

Update these booleans in `securityHardening` via `PUT /api/production/readiness`:

- `iamRbacEnabled`
- `ssoEnabled`
- `mfaEnforced`
- `keyRotationEnabled`
- `immutableAuditExportEnabled`
- `vulnerabilityScanCompleted`
- `penetrationTestCompleted`

## 5) Go/No-Go Decision

When blockers reach zero:

- set `goLive.approved=true`
- set `goLive.approvedBy`
- set `goLive.approvedAt`

Production is considered ready when:

- all blocker checks pass
- `goLive.approved=true`

## 6) Verification Commands

```bash
npm run readiness
npm run readiness:strict
curl http://localhost:8787/api/production/readiness
curl http://localhost:8787/api/compliance/status
```
