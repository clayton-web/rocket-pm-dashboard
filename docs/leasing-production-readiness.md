# Leasing production readiness

Informational notes on known limitations before running the leasing workflow in production. This is not a deployment checklist — see [deployment-checklist.md](./deployment-checklist.md) and [leasing-smoke-test-runbook.md](./leasing-smoke-test-runbook.md).

---

## Document storage

| Topic | Current state | Production requirement |
|-------|---------------|------------------------|
| Abstraction | `getDocumentStorage()` in `lib/storage/document-storage.ts` | Same API in all environments |
| Dev backend | `DOCUMENT_STORAGE_BACKEND=local` (default) | Local filesystem under `.data/documents` |
| Prod backend | `DOCUMENT_STORAGE_BACKEND=s3` | **Required** — app refuses to boot in production with local storage |
| Providers | `@aws-sdk/client-s3` | AWS S3, Cloudflare R2, or any S3-compatible endpoint |
| RTB-1 drafts | Written on generate | Must survive deploys and scale horizontally |
| Executed leases | Locked PDFs after PM counter-sign | **Durable, backed up, access-controlled** |
| Signature PNGs | Same storage layer as PDFs | Migrated with documents |

### Environment variables (production)

| Variable | Required | Notes |
|----------|----------|-------|
| `DOCUMENT_STORAGE_BACKEND` | Yes | Must be `s3` in production |
| `S3_BUCKET` | Yes | Private bucket; app credentials only |
| `S3_REGION` | Yes | e.g. `us-east-1` or `auto` for R2 |
| `S3_ACCESS_KEY_ID` | Yes | IAM or R2 API token |
| `S3_SECRET_ACCESS_KEY` | Yes | Keep in host secrets |
| `S3_ENDPOINT` | Optional | Required for Cloudflare R2 |
| `S3_FORCE_PATH_STYLE` | Optional | Often `true` for R2 / MinIO |

### Recommended bucket settings

- **Private bucket** — block all public access; downloads only via authenticated app routes
- **Encryption at rest** — SSE-S3 or SSE-KMS enabled
- **Versioning enabled** — executed RTB-1 leases are legal records
- **App-only IAM** — least privilege: `s3:GetObject`, `s3:PutObject` on bucket prefix if scoped
- **Backup / lifecycle** — document retention policy outside the app (console or IaC)

### Migrating existing local files

Before switching production to S3, upload files preserving `storageKey` paths:

```bash
DOCUMENT_STORAGE_BACKEND=s3 \
S3_BUCKET=... S3_REGION=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
npx tsx scripts/migrate-documents-to-s3.ts
```

Dry run: `DRY_RUN=true npx tsx scripts/migrate-documents-to-s3.ts`

Staff and tenant download routes remain thin proxies — they never expose raw storage keys.

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
