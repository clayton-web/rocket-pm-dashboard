# Deployment checklist (production / staging)

Use this before deploying the unified Rocket PM app. Copy `.env.example` to your host’s secret store; never commit real `.env` files.

## Required environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Pooled PostgreSQL URL for app runtime (e.g. Neon pooler). |
| `DIRECT_URL` | Yes | Direct URL for Prisma migrations (`prisma migrate deploy`). |
| `NEXTAUTH_URL` or `AUTH_URL` | Yes | Public app origin, e.g. `https://app.example.com` (no trailing slash). |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Yes | Long random string for JWT/session signing. |
| `GOOGLE_GMAIL_CLIENT_ID` | Yes* | *Required if Gmail connect/sync/drafts are used. |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Yes* | Same OAuth client as redirect URI below. |
| `GOOGLE_GMAIL_REDIRECT_URI` | Optional | Defaults to `{NEXTAUTH_URL}/api/integrations/gmail/callback` when unset. |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Yes* | *Required in production before storing Gmail refresh tokens or Buildium API secrets (`openssl rand -base64 32`). |
| `GEMINI_API_KEY` | Yes* | *Required if AI responder drafts are used. |
| `MAINTENANCE_PUBLIC_ORG_SLUG` | Recommended | Org slug for public `POST /api/maintenance` (default: `axford`). |
| `DOCUMENT_STORAGE_BACKEND` | **Yes (prod)** | Must be `s3` in production. `local` is dev-only. |
| `S3_BUCKET` | **Yes (prod)** | Private bucket for RTB-1 PDFs and signature images. |
| `S3_REGION` | **Yes (prod)** | AWS region or `auto` for R2. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | **Yes (prod)** | App credentials with GetObject/PutObject on the bucket. |
| `S3_ENDPOINT` | Optional | Cloudflare R2 or other S3-compatible endpoint URL. |
| `S3_FORCE_PATH_STYLE` | Optional | Often `true` for R2. |

## Must be disabled in production

| Variable | Production value |
|----------|------------------|
| `DEV_CREDENTIALS_LOGIN` | `false` (or unset) |
| `NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN` | `false` (or unset) — set at **build** time |
| `ALLOW_INSECURE_GMAIL_TOKEN_STORAGE` | unset / never `true` |

The server refuses to start in production if dangerous dev flags are set or if `DOCUMENT_STORAGE_BACKEND` is missing/`local` (`instrumentation.ts` → `validateProductionRuntimeConfig`).

## Optional / environment-specific

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Staff Google sign-in (separate from Gmail mailbox OAuth). |
| `GEMINI_MODEL` | Override default `gemini-2.5-flash`. |
| `GMAIL_SYNC_MAX_THREADS` | Cap per manual sync (1–100). |
| `GMAIL_SYNC_LABEL_IDS` | Comma-separated Gmail label ids. |
| `GMAIL_OAUTH_STATE_SECRET` | Defaults to auth secret. |
| `BUILDIUM_READ_ONLY` | Recommended | Keep `true` (default) until Buildium write integration is explicitly approved. |
| `BUILDIUM_BASE_URL` | Optional | Override API host for local sandbox testing; org setting selects production vs sandbox. |
| `SEED_STAFF_PASSWORD` | **Local seed only** — never set in production runtime. |
| `LOCAL_DOCUMENT_STORAGE_ROOT` | **Dev only** — default `.data/documents` when `DOCUMENT_STORAGE_BACKEND=local`. |
| `TENANT_AUTH_DEV_SHOW_CODE` | **Never in production** — exposes OTP in API JSON. |
| `EMAIL_ENABLED` | **Yes (prod)** | Must be `true`. |
| `EMAIL_PROVIDER` | **Yes (prod)** | Must be `resend`. |
| `RESEND_API_KEY` | **Yes (prod)** | Resend API key for transactional email. |
| `EMAIL_FROM` | **Yes (prod)** | Verified sender, e.g. `Rocket PM <noreply@your-domain.com>`. |
| `APP_PUBLIC_URL` | **Yes (prod)** | Public app origin for absolute links in email (falls back to `NEXTAUTH_URL`). |

## Pre-deploy steps

1. [ ] PostgreSQL provisioned; run `npx prisma migrate deploy` against `DIRECT_URL` **before** promoting new application code that depends on pending migrations (Vercel does not auto-migrate).
2. [ ] For the leasing release, confirm these migrations are applied in order: `20260710000000_rental_listing_foundation`, `20260710010000_property_service_relationship`, `20260710020000_listing_attribution_and_tenant_placement`. See [rental-listings.md](./rental-listings.md).
3. [ ] All required secrets set in the hosting provider (not in git).
4. [ ] `DEV_CREDENTIALS_LOGIN=false` and `NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN=false` on production build.
5. [ ] `GMAIL_TOKEN_ENCRYPTION_KEY` set before any user connects Gmail or saves Buildium credentials.
6. [ ] Gmail OAuth client redirect URI matches `{NEXTAUTH_URL}/api/integrations/gmail/callback`.
7. [ ] Do **not** run `npm run db:seed` in production (seed blocked unless `ALLOW_PRODUCTION_SEED=true` for intentional staging resets).
8. [ ] Staff users have `passwordHash` set (no email-only dev login in production).
9. [ ] S3-compatible document bucket provisioned (private, encrypted, versioning on). See [leasing-production-readiness.md](./leasing-production-readiness.md).
10. [ ] `DOCUMENT_STORAGE_BACKEND=s3` and S3 credentials set; run `scripts/migrate-documents-to-s3.ts` if migrating existing local files.
11. [ ] Leave `RENTAL_LISTING_PUBLIC_FALLBACK` unset or `true` until every advertised unit has a listing (default-on).

## Post-deploy verification

1. [ ] `GET /api/health` → `200`, `ok: true`, `database: "ok"` (no secrets in body).
2. [ ] Run [production smoke test](./production-smoke-test.md).
3. [ ] Run [leasing smoke test runbook](./leasing-smoke-test-runbook.md) if leasing is enabled.
4. [ ] Confirm public maintenance intake and portal lookup respond; abuse returns `429` when rate limited.

## Public API rate limiting (in-memory)

Routes:

- `POST /api/maintenance` — 8 requests / minute / client IP (per server process)
- `POST /api/portal/maintenance/lookup` — 15 requests / minute / client IP

Implementation: `lib/security/rate-limit.ts` (no Redis dependency).

**Limitations:**

- Counters are per Node process; serverless/multi-instance deployments do not share state.
- Limits reset on cold start / deploy.
- For strict production abuse protection, add a WAF, edge rate limit, or durable store (Redis) later.

## Health endpoint

`GET /api/health` (public, unauthenticated):

- Returns `{ ok, checks }` with booleans only (e.g. `authSecretConfigured`, `gmailTokenEncryptionConfigured`).
- Runs `SELECT 1` against the database; returns `503` if the DB is unreachable.
- Does not expose secret values or connection strings.

## Production guards (runtime)

| Risk | Mitigation |
|------|------------|
| Dev email-only login | `isDevCredentialsLoginEnabled()` is always false when `NODE_ENV=production`; mis-set env also fails server boot. |
| Insecure Gmail token storage | `ALLOW_INSECURE_GMAIL_TOKEN_STORAGE=true` throws in production; missing encryption key throws on connect/encrypt. |
| Dev plaintext Gmail tokens | `decryptSecret` refuses `dev-plain:` payloads in production. |
| Accidental production seed | `prisma/seed.ts` exits unless `ALLOW_PRODUCTION_SEED=true`. |

## Background job processor (Phase 0)

| Variable | Production |
|----------|------------|
| `JOB_PROCESSOR_SECRET` or `CRON_SECRET` | Required if Vercel Cron or scheduled drain is used |
| `JOB_PROCESSOR_ACTOR_USER_ID` | Required for cron-driven processing (valid staff `User.id`) |
| `AGENT_AUTOMATION_ENABLED` | `false` or unset until agent handlers are shipped |

Route: `POST /api/internal/jobs/process` (session bypass; Bearer secret required).

Details: [agent-job-framework.md](./agent-job-framework.md).

## Daily Briefing MVP

| Variable | When required |
|----------|----------------|
| `BRIEFING_AUTOMATION_ENABLED` | `true` to enable `briefing.schedule` / `briefing.generate` |
| `GEMINI_API_KEY` | Briefing generation |
| `EMAIL_ENABLED`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL` | Staff briefing email delivery |
| `JOB_PROCESSOR_SECRET` or `CRON_SECRET` | Manual drain + external briefing schedule cron |
| `JOB_PROCESSOR_ACTOR_USER_ID` | Audit actor for cron-triggered briefing jobs |

Per-org: enable via **`/briefing/settings`** (disabled by default). Do not enable production orgs until smoke test passes.

External schedule cron: `POST /api/internal/briefing/schedule?slot=MORNING|AFTERNOON` (see [daily-briefing-integration-plan.md](./daily-briefing-integration-plan.md#14-mvp-operations-runbook)). Vercel Hobby does not support twice-daily crons — use GitHub Actions or similar.

Smoke test: [daily-briefing-smoke-test.md](./daily-briefing-smoke-test.md).

## Related docs

- [Agent job framework](./agent-job-framework.md)
- [Staff auth](./auth.md)
- [Production smoke test](./production-smoke-test.md)
- [Tenant portal MVP](./tenant-portal-mvp.md)
- [Maintenance PR7 notes](./maintenance-pr7-supabase-remaining.md)
