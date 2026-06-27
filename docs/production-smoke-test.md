# Production smoke test checklist

Manual verification after deploying to staging or production. Use a real staff account with a password hash (not dev email-only login).

**Prerequisites:** deployment checklist complete, `GET /dashboard/api/health` returns `ok: true`.

**Base path:** The PM Dashboard is served under `/dashboard`. Prefix all routes below unless noted otherwise. Direct Vercel testing (before marketing rewrites): `https://rocket-pm-dashboard-app.vercel.app/dashboard/...`

---

## 1. Staff login

- [ ] Open `/login`
- [ ] Sign in with email + password (seed accounts are **local only**)
- [ ] Session persists; redirect to `/inbox` or dashboard home
- [ ] Sign out / invalid password rejected

## 2. Gmail connect

- [ ] Signed-in user with org access opens `/email` (or Gmail settings surface)
- [ ] Connect Gmail → Google OAuth completes
- [ ] Connected mailbox appears; no vault/encryption error when `GMAIL_TOKEN_ENCRYPTION_KEY` is set

## 3. Gmail sync

- [ ] Trigger manual sync from email hub
- [ ] Threads appear in `/inbox` for the active organization
- [ ] No OAuth or token decrypt errors in logs

## 4. AI draft generation

- [ ] Open a thread at `/inbox/[threadId]`
- [ ] Generate responder draft (Gemini)
- [ ] Draft text appears; errors surface clearly if `GEMINI_API_KEY` missing

## 5. Load to Gmail drafts

- [ ] From thread responder panel, load/save draft to Gmail
- [ ] Draft visible in Gmail web UI for connected account

## 6. Maintenance submit (tenant)

- [ ] Open `/portal/maintenance/new` (no staff login)
- [ ] Complete intake form with valid tenancy from submit-options
- [ ] Submit succeeds; reference id shown on success UX

## 7. Manager maintenance queue

- [ ] Staff user opens `/maintenance`
- [ ] New public request appears in list for active org
- [ ] Open detail `/maintenance/[requestId]`; triage/actions work

## 8. Tenant status lookup

- [ ] Open `/portal/maintenance/status`
- [ ] Lookup with request id + email from step 6
- [ ] Status returned; wrong email returns generic not-found
- [ ] Rapid repeated POSTs eventually return `429` (rate limit)

## 9. PM context links (inbox)

- [ ] On thread page, add PM context link (property / unit / tenancy)
- [ ] Regenerate AI draft; PM snippets appear in context (or documented behavior)
- [ ] Remove link; draft context updates on next generation

---

## Quick API checks

| Endpoint | Expected |
|----------|----------|
| `GET /dashboard/api/health` | `200`, `ok: true` |
| `POST /dashboard/api/maintenance` (public body) | `200` or validation `400`; not unauthenticated `401` |
| `POST /dashboard/api/portal/maintenance/lookup` | `200` / `404`; not `401` |

## Failure triage

| Symptom | Check |
|---------|--------|
| Boot fails on deploy | `DEV_CREDENTIALS_LOGIN`, `ALLOW_INSECURE_GMAIL_TOKEN_STORAGE` not `true` in prod |
| Gmail connect error | `GMAIL_TOKEN_ENCRYPTION_KEY`, redirect URI, `GOOGLE_GMAIL_*` |
| AI draft fails | `GEMINI_API_KEY`, model quota |
| Maintenance 400 tenancy | `MAINTENANCE_PUBLIC_ORG_SLUG`, seed data / org slug |
| Health `503` | `DATABASE_URL`, DB reachable from app |
