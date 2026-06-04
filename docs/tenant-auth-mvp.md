# Tenant portal auth MVP (Product PR 2)

Separate from staff **NextAuth**. Tenants with `TenancyContact.portalAccessEnabled = true` on an **active** tenancy in the public portal org (`MAINTENANCE_PUBLIC_ORG_SLUG`) can sign in with email + one-time code.

## Approach: email + OTP (option B)

| Option | Security | Complexity | Schema fit | MVP speed | Scale |
|--------|----------|------------|------------|-----------|-------|
| A. Magic link | High | High (email infra) | Good | Slow | Best |
| **B. Email + OTP** | Medium–high | Low–medium | **Best** | **Fast** | Good (add email sender) |
| C. Password | Medium | High (needs password field) | Poor | Slow | OK |
| D. Reference + email only | Low | Lowest | OK | Fast | Poor |

**Selected: B** — matches staff-enrolled contacts, no Prisma changes, OTP store swappable for real email later.

## Flow

1. `POST /api/portal/auth/start` `{ email }` — generic success if no match (no enumeration).
2. Server finds eligible `TenancyContact`, stores hashed 6-digit OTP in memory (10 min TTL).
3. Dev/staging: response may include `devCode` when `NODE_ENV !== production` or `TENANT_AUTH_DEV_SHOW_CODE=true`.
4. `POST /api/portal/auth/verify` `{ email, code, next? }` — sets signed session cookie; redirects to validated `next` or `/portal/dashboard`.
5. `GET /portal/logout` — clears cookie, redirects to `/portal`.

### Login redirect (`next`)

Protected pages may redirect to `/portal/login?next=/portal/documents` (etc.). The `next` value is validated server-side (`lib/portal/portal-login-redirect.ts`):

- Must be an internal `/portal/...` path on the allowlist (dashboard, documents, maintenance, notice).
- Open redirects, traversal, and `/portal/login` loops are rejected (fallback: dashboard).

## Session cookie

| Property | Value |
|----------|--------|
| Name | `rocket_pm_tenant_session` |
| Format | HMAC-signed JSON (`contactId`, `tenancyId`, `organizationId`, `email`, `exp`) |
| Signing | `TENANT_PORTAL_SESSION_SECRET` or `NEXTAUTH_SECRET` / `AUTH_SECRET` |
| Flags | `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`, 7-day max age |

Server helpers: `getTenantSession()`, `getVerifiedTenantSession()` in `lib/portal/tenant-auth.ts` (re-checks DB on each read).

## Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/portal/login` | Public | Email + code UI |
| `/portal/logout` | Public | Clear session |
| `/portal/dashboard` | Tenant session | Home — recent maintenance + links |
| `/portal/documents` | Tenant session | Executed lease list + download |
| `/portal/maintenance` | Tenant session | List scoped maintenance requests |
| `/portal/maintenance/[requestId]` | Tenant session | Tenant-safe detail (PR 3) |
| `POST /api/portal/auth/start` | Public | Issue OTP |
| `POST /api/portal/auth/verify` | Public | Verify OTP, set cookie |

Public maintenance intake (`/portal/maintenance/new`, `POST /api/maintenance`) and reference lookup remain **unchanged** and **unauthenticated**.

## Staff / Gmail / AI

- Staff `/login` and NextAuth JWT unchanged.
- No changes to `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, or maintenance service logic.

## Middleware

All `/portal/*` and `/api/portal/*` remain public (same as PR 11). Protected pages enforce session in the page handler (redirect to `/portal/login`).

## Rate limits

- `auth/start`: 5/min per IP
- `auth/verify`: 10/min per IP

In-memory limiter (see `docs/deployment-checklist.md`).

## Local testing

1. `npm run db:seed` — enables `portalAccessEnabled` for `tenant.seed@axford.test`.
2. Open `/portal/login`, enter that email, use `devCode` from the API response.
3. Land on `/portal/dashboard`.

## Security limitations (MVP)

- OTP challenges are stored in Postgres (`TenantOtpChallenge`) with hashed codes only.
- Transactional email (Resend) delivers OTP codes and lease signing links in production.
- `TENANT_AUTH_DEV_SHOW_CODE` must never be enabled in production.
- One contact per email wins (`findFirst` by `updatedAt`) if duplicates exist.
- Signed-in list/detail (PR 3) does not remove public reference lookup.
- Documents require active tenancy; signing uses token link before activation.

## Future upgrades

1. Optional scheduled cleanup cron calling `deleteExpiredTenantOtps()`.
3. Magic link as alternative to typed code.
4. ~~Scope maintenance history~~ (PR 3) — ~~documents~~ (PR-C4) — attachments and additional doc types next.
5. Optional NextAuth credentials provider linked to `User` + `RoleKey.tenant` (longer term).

## Environment

| Variable | Purpose |
|----------|---------|
| `MAINTENANCE_PUBLIC_ORG_SLUG` | Org scope for eligible contacts |
| `TENANT_PORTAL_SESSION_SECRET` | Optional dedicated signing secret |
| `TENANT_AUTH_DEV_SHOW_CODE` | Force `devCode` in API response (staging) |

## PM enablement

Staff must set `portalAccessEnabled` on the tenant’s `TenancyContact` (future staff UI; today via DB/seed).
