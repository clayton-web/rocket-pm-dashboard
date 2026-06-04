# Agent job framework (Phase 1)

Postgres-backed background jobs for Gmail sync and future email triage/draft agents. Phase 1 adds the first production workload: **`gmail.sync`**.

## Architecture

| Component | Path | Role |
|-----------|------|------|
| Queue | `BackgroundJob` (Prisma) | Durable jobs, idempotency, retries |
| Agent runs | `AgentRun` (Prisma) | Future versioned AI executions (unused in Phase 1) |
| Policy | `OrganizationAiPolicy` | Per-org flags (all off by default) |
| Enqueue | `lib/jobs/enqueue.ts` | Create jobs + `job.enqueued` audit |
| Gmail enqueue | `lib/gmail/enqueue-gmail-sync.ts` | Staff sync + `gmail.sync.enqueued` audit |
| Sync core | `lib/gmail/gmail-sync-core.ts` | Shared Gmail API sync (manual + jobs) |
| Claim | `lib/jobs/claim.ts` | `FOR UPDATE SKIP LOCKED` |
| Processor | `lib/jobs/processor.ts` | Run handlers + `job.completed` / `job.failed` audit |
| Handlers | `lib/jobs/handlers/registry.ts` | Allowlisted `jobType` → handler |
| API | `POST /api/internal/jobs/process` | Vercel Cron / manual drain |

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `JOB_PROCESSOR_SECRET` or `CRON_SECRET` | Production (processor) | Bearer token or `x-cron-secret` header |
| `JOB_PROCESSOR_ACTOR_USER_ID` | When cron drains without `triggeredByUserId` | Valid `User.id` for `AuditLog` |
| `AGENT_AUTOMATION_ENABLED` | No (default off) | Must be `true` before any `agent.*` job type is allowed |
| `GMAIL_SYNC_OVERDUE_HOURS` | No (default 24) | Inbox freshness "Sync overdue" threshold |

See `.env.example` for templates.

## Phase 1 allowed job types

- `system.noop` — framework health check; no side effects
- `gmail.sync` — pulls recent Gmail threads into the dashboard (production workload)

Blocked until a later phase (even if `AGENT_AUTOMATION_ENABLED=true`):

- `agent.triage`
- `agent.draft.generate`

## Gmail sync flow

1. Staff clicks **Sync now** on `/inbox` → `enqueueGmailSyncJob()` creates a `gmail.sync` job.
2. Vercel Cron (every 15 min) or manual `POST /api/internal/jobs/process` claims pending jobs.
3. `handleGmailSync` loads the mailbox, validates org ownership, runs `runGmailMailboxSync()`, updates `lastSyncedAt`.
4. Audit events: `gmail.sync.enqueued`, `gmail.sync.started`, `gmail.sync.completed` / `gmail.sync.failed` (no message bodies). Job layer also writes `job.enqueued`, `job.completed`, `job.failed`.

Active sync deduplication: if a PENDING/RUNNING `gmail.sync` already exists for the mailbox, **Sync now** returns immediately without enqueueing a duplicate.

## Security

- **No automatic email sending** — job layer has no send handlers; Gmail send APIs are not used by jobs.
- **No Gemini from jobs** — handlers do not import `lib/ai/*`.
- **Processor auth** — route bypasses session middleware but requires shared secret.
- **Agent safeguard** — `AGENT_AUTOMATION_ENABLED` defaults false; `agent.*` types rejected at enqueue and process time.

## Manual smoke (local)

1. Set `JOB_PROCESSOR_SECRET`, `JOB_PROCESSOR_ACTOR_USER_ID` (e.g. seed admin user id).
2. Connect Gmail, open `/inbox`, click **Sync now**.
3. Drain the queue:
   ```bash
   curl -X POST http://localhost:3000/api/internal/jobs/process \
     -H "Authorization: Bearer $JOB_PROCESSOR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit":5}'
   ```
4. Confirm `AuditLog` rows: `gmail.sync.enqueued`, `gmail.sync.started`, `gmail.sync.completed`, `job.completed`.

## Vercel Cron

`vercel.json` schedules `POST /api/internal/jobs/process` every 15 minutes. Set `CRON_SECRET` in Vercel; the platform sends `Authorization: Bearer <CRON_SECRET>` on cron invocations when configured.

An empty queue is cheap; cron only drains work that was explicitly enqueued.

## Future agent plug-in (Phase 3+)

1. Add handler in `lib/jobs/handlers/` and register in `registry.ts`.
2. Expand allowed job types (or replace with phase-aware allowlist).
3. Create `AgentRun` at start of handler; link via `backgroundJobId`.
4. Triage: write suggestions table (not `contextLinks` directly).
5. Draft: call `generateAndPersistResponderDraft` from a new `lib/ai/agents/` adapter only.
6. Enqueue from staff UI or approved automation when `OrganizationAiPolicy` allows.

Frozen modules (`lib/ai/generate-responder-draft.ts`, Gmail draft load) remain user-initiated until explicitly unfrozen.

## Regression checklist (job changes)

- [ ] `npx prisma generate`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Processor returns 401 without secret
- [ ] `system.noop` completes and audits
- [ ] `gmail.sync` enqueues from inbox and completes via processor
- [ ] Inbox generate / load Gmail draft unchanged
