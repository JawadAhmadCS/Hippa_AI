# HIPAA Implementation Notes (Prototype)

This prototype is designed for HIPAA-aligned architecture, not automatic legal certification.

## Implemented Controls

- Consent gate before recording/transcription starts.
- Minimum-necessary data handling:
  - UI requests patient reference ID, not full name.
  - Audit logs redact transcript/body content.
- Tamper-evident audit chain (`data/audit-log.ndjson`) with hash linking.
- Segregated audio storage flow:
  - Azure Blob Storage when configured.
  - Local fallback for demo only.
- Production-readiness control plane:
  - Vendor-level BAA tracking (`/api/hipaa/baa-documents` with `vendor`)
  - Legal/compliance review state tracking (`/api/production/readiness`)
  - Security hardening status checklist and blocker reporting
- Compliance-focused suggestion policy:
  - Rule engine avoids unsupported upcoding behavior.
  - Realtime assistant prompt explicitly blocks fabricated billing.
- Codebook freshness checks with stale threshold.

## Required for Production HIPAA

- Execute BAAs with all subprocessors (OpenAI, Azure, hosting, logging vendors).
- Enforce strong IAM/RBAC + SSO + MFA.
- Encrypt all PHI at rest with managed keys and rotation.
- Encrypt in transit everywhere (TLS 1.2+).
- Implement immutable centralized audit logging/SIEM.
- Add retention/deletion lifecycle policies and legal hold procedures.
- Run formal risk assessment and penetration test.
- Add coder review workflow before claim submission.
- Add policy controls to prevent medical necessity violations and upcoding.
