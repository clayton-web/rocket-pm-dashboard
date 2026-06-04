# Agent job framework (Phase 0)

Postgres-backed background jobs and versioned agent run records for future email triage and draft agents. Phase 0 provides infrastructure only — no automatic AI, no Gmail sync jobs, no inbox changes.

## Architecture

| Component | Path | Role |
|-----------|------|------|
| Queue | `BackgroundJob` (Prisma) | Durable jobs, idempotency, retries |
| Agent runs | `AgentRun` (Prisma) | Future versioned AI executions (unused in Phase 0) |
| Policy | `OrganizationAiPolicy` | Per-org flags (all off by default) |
| Enqueue | `lib/jobs/enqueue.ts` | Create jobs + `job.enqueued` audit |
| Claim | `lib/jobs/claim.ts` | `FOR UPDATE SKIP LOCKED` |
| Processor | `lib/jobs/processor.ts` | Run handlers + `job.completed` / `job.failed` audit |
| Handlers | `lib/jobs/handlers/registry.ts` | Allowlisted `jobType` → handler |
| API | `POST /api/internal/jobs/process` | Vercel Cron / manual drain |

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `JOB_PROCESSOR_SECRET` or `CRON_SECRET` | Production (processor) | Bearer token or `x-cron-secret` header |
| `JOB_PROCESSOR_ACTOR_USER_ID` | When cron drains without `triggeredByUserId` | Valid `User.id` for `AuditLog` |
| `AGENT_AUTOMATION_ENABLED` | No (default off) | Must be `true` before any `agent.*` job type is allowed in a future phase |

See `.env.example` for templates.

## Phase 0 allowed job types

- `system.noop` — framework health check; no side effects

Blocked until a later phase (even if `AGENT_AUTOMATION_ENABLED=true`):

- `gmail.sync`
- `agent.triage`
- `agent.draft.generate`

## Security

- **No automatic email sending** — job layer has no send handlers; Gmail send APIs are not used by jobs.
- **No Gemini from jobs** — Phase 0 handlers do not import `lib/ai/*`.
- **Processor auth** — route bypasses session middleware but requires shared secret.
- **Agent safeguard** — `AGENT_AUTOMATION_ENABLED` defaults false; `agent.*` types rejected at enqueue and process time.

## Manual smoke (local)

1. Set `JOB_PROCESSOR_SECRET`, `JOB_PROCESSOR_ACTOR_USER_ID` (e.g. seed admin user id).
2. Enqueue via script or Prisma Studio using `enqueueJob()` from a temporary script — or add a one-off API later.
3. `curl -X POST http://localhost:3000/api/internal/jobs/process \
     -H "Authorization: Bearer $JOB_PROCESSOR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit":5}'`
4. Confirm `AuditLog` rows: `job.enqueued`, `job.completed`.

## Vercel Cron (optional)

`vercel.json` may schedule `POST /api/internal/jobs/process`. Set `CRON_SECRET` in Vercel; the platform sends `Authorization: Bearer <CRON_SECRET>` on cron invocations when configured.

An empty queue is cheap; cron only drains work that was explicitly enqueued.

## Future agent plug-in (Phase 3+)

1. Add handler in `lib/jobs/handlers/` and register in `registry.ts`.
2. Expand `PHASE0_ALLOWED_JOB_TYPES` (or replace with phase-aware allowlist).
3. Create `AgentRun` at start of handler; link via `backgroundJobId`.
4. Triage: write suggestions table (not `contextLinks` directly) — table not in Phase 0.
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
- [ ] Inbox generate / load Gmail draft unchanged
