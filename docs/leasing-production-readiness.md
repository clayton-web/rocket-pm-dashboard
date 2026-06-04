# Leasing production readiness

Informational notes on known limitations before running the leasing workflow in production. This is not a deployment checklist — see [deployment-checklist.md](./deployment-checklist.md) and [leasing-smoke-test-runbook.md](./leasing-smoke-test-runbook.md).

---

## Document storage

| Topic | Current state | Production requirement |
|-------|---------------|------------------------|
| Backend | Local filesystem (`.data/documents` or `LOCAL_DOCUMENT_STORAGE_ROOT`) | **S3-compatible object storage** |
| RTB-1 drafts | Written on generate | Must survive deploys and scale horizontally |
| Executed leases | Locked PDFs after PM counter-sign | **Durable, backed up, access-controlled** |
| Serverless | Ephemeral disk | Local storage **will lose files** on redeploy |

**Action before production leasing:** migrate `lib/storage/local-document-storage.ts` usage to object storage; keep staff and tenant download routes as thin proxies that never expose raw storage keys.

---

## Email and notifications

- Tenant OTP sign-in codes are **not emailed** in production yet (dev/staging may return code in API JSON).
- No automated emails for: signing links, activation, lease ready, move-in reminders.
- Staff must share signing links and login instructions manually.

---

## Signing scope

- **Single primary tenant** signs the RTB-1 in-app.
- **No co-tenant signing** workflow.
- **No cancel signature request** — staff cannot void an in-flight request from UI.
- Token-based signing link works before tenancy activation; portal login requires `active` status.

---

## Forms and compliance

- **RTB-26** (additional occupants) checkbox is mapped when >2 signers on data model; **no RTB-26 PDF generation**.
- **No lease amendment** workflow after execution.
- **No renewal** or lease extension workflow.
- Addendum library not built.

---

## Onboarding and activation

- Activation is **manual** — staff clicks **Mark active** after executed RTB-1 exists.
- No staff override UI for activation without executed lease (helper reserved internally).
- Portal documents show **executed RTB-1 only** (no drafts, no unsigned files).

---

## Security model (current)

| Resource | Staff | Tenant |
|----------|-------|--------|
| RTB-1 draft PDF | Staff download route | Signing token only |
| Executed RTB-1 | Staff download route | Portal download after active + sign-in |
| Document IDs | PM property access | Session tenancy scope |

Open redirect protection on portal login `next` parameter — see `lib/portal/portal-login-redirect.ts`.

---

## Recommended pre-production sequence

1. Object storage migration for documents
2. Email delivery for tenant OTP and signing links
3. Run [leasing smoke test runbook](./leasing-smoke-test-runbook.md) on staging
4. Confirm `DEV_CREDENTIALS_LOGIN` and `TENANT_AUTH_DEV_SHOW_CODE` disabled in production
5. Backup and retention policy for executed lease objects

---

## Out of scope (future work)

- Payment / rent ledger
- Automated move-in/move-out workflows beyond status tracking
- Co-tenant portal accounts and multi-signer execution
- E-signature provider integration (current: in-app canvas signatures)
