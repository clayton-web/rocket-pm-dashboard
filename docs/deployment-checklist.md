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
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Yes* | *Required in production before storing Gmail refresh tokens (`openssl rand -base64 32`). |
| `GEMINI_API_KEY` | Yes* | *Required if AI responder drafts are used. |
| `MAINTENANCE_PUBLIC_ORG_SLUG` | Recommended | Org slug for public `POST /api/maintenance` (default: `axford`). |

## Must be disabled in production

| Variable | Production value |
|----------|------------------|
| `DEV_CREDENTIALS_LOGIN` | `false` (or unset) |
| `NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN` | `false` (or unset) — set at **build** time |
| `ALLOW_INSECURE_GMAIL_TOKEN_STORAGE` | unset / never `true` |

The server refuses to start in production if any dangerous dev flag above is `true` (`instrumentation.ts` → `validateProductionRuntimeConfig`).

## Optional / environment-specific

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Staff Google sign-in (separate from Gmail mailbox OAuth). |
| `GEMINI_MODEL` | Override default `gemini-2.5-flash`. |
| `GMAIL_SYNC_MAX_THREADS` | Cap per manual sync (1–100). |
| `GMAIL_SYNC_LABEL_IDS` | Comma-separated Gmail label ids. |
| `GMAIL_OAUTH_STATE_SECRET` | Defaults to auth secret. |
| `SEED_STAFF_PASSWORD` | **Local seed only** — never set in production runtime. |
| `LOCAL_DOCUMENT_STORAGE_ROOT` | **Dev/single-node only** — default `.data/documents`. Not durable on serverless; migrate to S3 before production leasing. See [leasing-production-readiness.md](./leasing-production-readiness.md). |
| `TENANT_AUTH_DEV_SHOW_CODE` | **Never in production** — exposes OTP in API JSON. |

## Pre-deploy steps

1. [ ] PostgreSQL provisioned; run `npx prisma migrate deploy` (or `db push` only for ephemeral staging).
2. [ ] All required secrets set in the hosting provider (not in git).
3. [ ] `DEV_CREDENTIALS_LOGIN=false` and `NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN=false` on production build.
4. [ ] `GMAIL_TOKEN_ENCRYPTION_KEY` set before any user connects Gmail.
5. [ ] Gmail OAuth client redirect URI matches `{NEXTAUTH_URL}/api/integrations/gmail/callback`.
6. [ ] Do **not** run `npm run db:seed` in production (seed blocked unless `ALLOW_PRODUCTION_SEED=true` for intentional staging resets).
7. [ ] Staff users have `passwordHash` set (no email-only dev login in production).

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

## Related docs

- [Agent job framework](./agent-job-framework.md)
- [Staff auth](./auth.md)
- [Production smoke test](./production-smoke-test.md)
- [Tenant portal MVP](./tenant-portal-mvp.md)
- [Maintenance PR7 notes](./maintenance-pr7-supabase-remaining.md)
