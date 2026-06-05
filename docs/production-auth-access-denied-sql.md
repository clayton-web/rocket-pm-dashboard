# Production SQL verification — Google `AccessDenied`

Use this after deploying diagnostic logging in `auth.ts` (prefix `[auth:google-signin]`).

**Do not modify data** until SQL results and Vercel logs are reviewed.

---

## 1. Confirm Vercel `DATABASE_URL` matches the DB with historical Gmail data

1. Vercel → Project → **Settings** → **Environment Variables** → **Production** → copy `DATABASE_URL` (host only, e.g. `ep-….neon.tech`).
2. Neon Console → project/branch that contains synced threads → connection string host.
3. Hosts must **match**. If they differ, Production is not reading the database where Gmail history was created (fix env separately; out of scope for this note).

Local audit reference host: `ep-little-morning-amjnso33-pooler.c-5.us-east-1.aws.neon.tech`

---

## 2. Read-only SQL (run on Production `DATABASE_URL`)

```sql
-- A) User row for Google staff login email
SELECT id, email, "isActive", "platformAccessLevel",
       "passwordHash" IS NOT NULL AS has_password,
       "createdAt", "updatedAt"
FROM "User"
WHERE LOWER(email) = LOWER('clayton@theaxfords.com');

-- B) All inactive users (any email can cause AccessDenied if they sign in with Google)
SELECT id, email, "isActive", "createdAt"
FROM "User"
WHERE "isActive" = false
ORDER BY email;

-- C) Who owns the Gmail mailbox (may differ from login email)
SELECT u.id AS user_id,
       u.email AS login_email,
       u."isActive",
       cea.id AS connected_account_id,
       cea.email AS mailbox_email,
       cea.status,
       cea."organizationId",
       cea."createdAt"
FROM "ConnectedEmailAccount" cea
JOIN "User" u ON u.id = cea."userId"
WHERE LOWER(cea.email) = LOWER('clayton@theaxfords.com');

-- D) Historical sync + AI drafts for mailbox owner (replace :user_id from C)
SELECT
  (SELECT COUNT(*) FROM "EmailThread" et
   JOIN "ConnectedEmailAccount" cea ON cea.id = et."connectedAccountId"
   WHERE cea."userId" = :user_id) AS thread_count,
  (SELECT COUNT(*) FROM "EmailMessage" em
   JOIN "EmailThread" et ON et.id = em."threadId"
   JOIN "ConnectedEmailAccount" cea ON cea.id = et."connectedAccountId"
   WHERE cea."userId" = :user_id) AS message_count,
  (SELECT COUNT(*) FROM "AiDraftResponse" adr
   JOIN "EmailThread" et ON et.id = adr."threadId"
   JOIN "ConnectedEmailAccount" cea ON cea.id = et."connectedAccountId"
   WHERE cea."userId" = :user_id) AS ai_draft_count;
```

### Expected patterns (from local Neon audit)

| Finding | Meaning |
|---------|---------|
| No row in **A**, mailbox in **C** owned by `admin@axford.test` | Gmail history is under **admin** login, not `clayton@` **User** row |
| Row in **A**, `isActive = false` | Matches `denied_inactive_user` log → AccessDenied |
| No row in **A**, no inactive in **B** | Google login should upsert; if still AccessDenied, check Vercel for `upsert_error` |

---

## 3. Vercel logs

Filter Production logs for:

- Path: `/api/auth/callback/google`
- Text: `[auth:google-signin]`

See `docs/production-smoke-test.md` and deployment checklist for general health checks.

---

## 4. After diagnosis

| Result | Next step (manual, not automatic) |
|--------|----------------------------------|
| `denied_inactive_user` | Set `"isActive" = true` for that `User.id` in Production DB (when approved) |
| `upsert_error` | Fix schema/migrations or DB connectivity; do not change OAuth |
| `upsert_success` but still AccessDenied | Investigate Auth.js layer outside `signIn` (rare); check full callback stack |
| No `clayton@` user; Gmail under `admin@axford.test` | Sign in as **admin@axford.test** to see old data, or accept new user for Google `clayton@` |

Remove temporary `[auth:google-signin]` logging once resolved.
