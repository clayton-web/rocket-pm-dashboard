# Daily Briefing — Implementation Plan

**Project:** Daily Property Manager Briefing for Rocket PM  
**Status:** MVP implemented (PRs 1–6)  
**Last updated:** 2026-06-26

---

## Overview

Rocket PM already has Gmail OAuth, mailbox sync, inbox classification, Gemini JSON completions, a Postgres-backed job queue, and Resend transactional email. The Daily Briefing feature builds on that stack to deliver a **twice-daily staff summary** of important property-management activity.

**Product direction:** This is not an "Email Digest" feature. Gmail is the **first data source**, but the architecture must support future sources (rent payments, maintenance, move-outs, inspections, applications, notices, vacancies, RTB deadlines, etc.) without a schema rewrite.

**MVP scope:** Email-only source. Twice-daily cron → sync → filter → one Gemini call per run → store → dashboard → Resend email.

**Explicitly out of MVP:** Gmail Pub/Sub push, Twilio SMS, SendGrid, per-email Gemini calls, auto-linking all domain records.

---

## 1. Recommended naming

### Options considered

| Name | Pros | Cons |
|------|------|------|
| **Daily Briefing** | Broad; covers morning + afternoon; room for non-email sources | Slightly generic |
| PM Briefing | PM-specific | Awkward when sources aren't PM-only |
| Operations Brief | Ops-focused | Conflicts with existing "Operations" nav section |
| Morning Briefing | Familiar | Misleading for afternoon slot; too narrow long-term |

### Recommendation: **Daily Briefing**

Use **Daily Briefing** everywhere — UI label, docs, and primary user-facing copy. It communicates the product intent (a command-center summary, not a mailbox tool) and scales when maintenance, rent, and notices are added.

### Codebase naming conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Routes | kebab-case | `/briefing`, `/briefing/[runId]`, `/briefing/settings` |
| Prisma models | PascalCase | `BriefingSettings`, `BriefingRun`, `BriefingItem` |
| Prisma enums | SCREAMING_SNAKE | `BriefingSourceType`, `BriefingSlot` |
| Library path | kebab-case dir | `lib/briefing/`, `lib/ai/briefing/` |
| Job types | dot notation | `briefing.schedule`, `briefing.generate` |
| Env vars | SCREAMING_SNAKE | `BRIEFING_AUTOMATION_ENABLED` |
| Nav module id | camelCase | `dailyBriefing` in `config/navigation.ts` |
| Audit events | dot notation | `briefing.started`, `briefing.completed`, `briefing.email.sent` |

UI copy examples:
- Page title: **Daily Briefing**
- Tab labels: **Morning** / **Afternoon**
- Email subject: `Rocket PM Daily Briefing — Morning — {org name} — {date}`

---

## 2. Architecture

### Existing infrastructure to reuse

| Component | Path | Briefing role |
|-----------|------|---------------|
| Gmail OAuth | `app/api/integrations/gmail/*`, `lib/gmail/oauth-config.ts` | Authorized mailbox connection |
| Token vault | `lib/crypto/token-vault.ts`, `ConnectedEmailAccount` | Encrypted refresh tokens |
| Gmail sync | `lib/gmail/gmail-sync-core.ts`, `lib/jobs/handlers/gmail-sync.ts` | Pull threads before briefing |
| Sync enqueue | `lib/gmail/enqueue-gmail-sync.ts` | Pattern for scheduled sync |
| Email data | `EmailThread`, `EmailMessage` in `prisma/schema.prisma` | Source records (not duplicated) |
| Deterministic filters | `lib/ai/inbox-classification/deterministic-filters.ts` | PM relevance gate (owner/tenant/strata) |
| Inbox categories | `EmailThreadCategory` enum | Pre-classification signal |
| Context links | `lib/ai/email-context-links.ts`, `EmailThread.contextLinks` | Entity resolution hints |
| Gemini client | `lib/ai/gemini-client.ts` → `createChatJsonCompletion()` | Single structured JSON per run |
| Job queue | `BackgroundJob`, `lib/jobs/enqueue.ts`, `lib/jobs/processor.ts` | Orchestration + retries |
| Job processor API | `app/api/internal/jobs/process/route.ts` | Cron entry point |
| Resend email | `lib/email/email.service.ts`, `lib/email/send-transactional-emails.ts` | Staff delivery |
| Org scoping | `getStaffContextFromSession()`, `getActiveOrganizationContext()` | Multi-tenant isolation |
| Staff nav | `config/navigation.ts` | New Command section item |

### Frozen modules (do not modify in MVP)

Per `docs/next-pr-migration-order.md`:

- `lib/gmail/**`
- `lib/ai/gemini-client.ts`
- `lib/ai/generate-responder-draft.ts`
- `lib/crypto/token-vault.ts`

Add new code under `lib/briefing/` and `lib/ai/briefing/` instead. Scheduled Gmail sync should call existing `enqueueGmailSyncJob()` with `triggerSource: "CRON"` — no changes to sync core.

### MVP architecture diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Trigger: Vercel Cron (2× daily) or staff "Run briefing now"          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  briefing.schedule job                                                  │
│  • Find orgs with BriefingSettings.enabled + slot due                   │
│  • Enqueue gmail.sync (CRON) per briefingEnabled ConnectedEmailAccount │
│  • Enqueue briefing.generate (scheduledAt +5 min)                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  gmail.sync job (existing handler)                                      │
│  • runGmailMailboxSync() → EmailThread / EmailMessage upsert            │
│  • Optional: agent.triage if autoTriageEnabled (independent of briefing)│
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  briefing.generate job (new handler)                                    │
│  1. Resolve time window [lastRun.windowEnd, now)                        │
│  2. Query new/changed EmailThreads in window                            │
│  3. Deterministic PM relevance filter                                   │
│  4. Build briefing context payload (grouped, truncated)                 │
│  5. Single Gemini call → structured BriefingOutput JSON                 │
│  6. Persist BriefingRun + BriefingItem rows                             │
│  7. Send Resend email to configured recipients                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
│  /briefing dashboard │  │  Resend staff email  │  │  AuditLog events   │
└──────────────────────┘  └──────────────────────┘  └────────────────────┘
```

### Briefing generate pipeline (detail)

```
collectCandidateThreads(orgId, windowStart, windowEnd)
  → filter: connectedAccount.briefingEnabled = true
  → filter: lastMessageAt within window OR updatedAt within window
  → deterministic PM gate (see §5)
  → enrich: category, contextLinks, property/tenancy labels from DB
  → buildBriefingContext(threads[])   // single JSON document for Gemini
  → generateBriefingWithGemini(context)
  → parse + validate BriefingOutput schema
  → persistBriefingRun + BriefingItems
  → sendBriefingEmail(run)
```

### Job type registration

Extend `lib/jobs/types.ts`:

```typescript
export const JOB_TYPES = {
  // ...existing
  BRIEFING_SCHEDULE: "briefing.schedule",
  BRIEFING_GENERATE: "briefing.generate",
} as const;
```

Add to `PHASE1_ALLOWED_JOB_TYPES` (or a new `PHASE2_ALLOWED_JOB_TYPES` set). Gate `briefing.*` jobs with a new env flag `BRIEFING_AUTOMATION_ENABLED` **and** `OrganizationAiPolicy.briefingEnabled` (new field, default `false`).

**Note:** `briefing.*` jobs are **not** `agent.*` jobs — they should not require `AGENT_AUTOMATION_ENABLED`. They use Gemini but are a distinct product surface. Implement `isBriefingJobType()` and `isBriefingAutomationEnabled()` in `lib/jobs/policy.ts` mirroring the agent pattern.

---

## 3. Future-proof data model

The schema is **source-agnostic**. Email is one `BriefingSourceType`; future sources plug in via the same `BriefingItem` table with polymorphic references.

### Enums

```prisma
enum BriefingSourceType {
  EMAIL
  MAINTENANCE
  RENT_PAYMENT
  DEPOSIT
  APPLICATION
  VIEWING_REQUEST
  INSPECTION
  NOTICE
  MOVE_OUT
  VACANCY
  SYSTEM
}

enum BriefingSlot {
  MORNING
  AFTERNOON
}

enum BriefingRunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  PARTIAL   // Gemini succeeded but email failed, etc.
}

enum BriefingItemCategory {
  URGENT
  LANDLORD
  TENANT
  MAINTENANCE
  RENT_DEPOSIT
  STRATA
  GENERAL_ADMIN
}

enum BriefingItemUrgency {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

### Models

```prisma
model BriefingSettings {
  id             String @id @default(cuid())
  organizationId String @unique

  enabled              Boolean @default(false)
  morningEnabled       Boolean @default(true)
  afternoonEnabled     Boolean @default(true)
  timezone             String  @default("America/Vancouver")
  morningLocalTime     String  @default("07:00")   // HH:mm, 24h
  afternoonLocalTime   String  @default("14:00")

  emailRecipients      String[] @default([])  // staff emails; empty = org admins
  autoSyncBeforeBriefing Boolean @default(true)
  lookbackHours        Int     @default(12)    // first-run fallback

  organization Organization @relation(...)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BriefingRun {
  id             String            @id @default(cuid())
  organizationId String
  slot           BriefingSlot
  status         BriefingRunStatus @default(PENDING)

  windowStart    DateTime
  windowEnd      DateTime

  // Aggregates for dashboard + email header
  executiveSummary     String?  @db.Text
  estimatedReadingMinutes Int?
  threadsScanned       Int      @default(0)
  itemsIncluded        Int      @default(0)
  itemsSkipped         Int      @default(0)   // non-PM / filtered out
  geminiCallCount      Int      @default(0)
  confidenceNote       String?  // e.g. "3 threads skipped as non-PM"

  // Full structured Gemini output (sections, follow-ups) — no raw email bodies
  briefingJson         Json?

  reviewedAt     DateTime?
  reviewedByUserId String?

  backgroundJobId String?  @unique
  errorMessage    String?  @db.Text
  emailSentAt     DateTime?

  organization  Organization  @relation(...)
  backgroundJob BackgroundJob? @relation(...)
  reviewedBy    User?         @relation(...)
  items         BriefingItem[]

  @@unique([organizationId, slot, windowEnd])
  @@index([organizationId, createdAt])
  @@index([organizationId, slot, createdAt])
}

model BriefingItem {
  id             String @id @default(cuid())
  briefingRunId  String
  organizationId String

  sourceType     BriefingSourceType
  category       BriefingItemCategory
  urgency        BriefingItemUrgency @default(NORMAL)

  // Display fields (minimal content — no raw email bodies)
  title          String              // summary title
  summary        String?  @db.Text   // 1–3 sentence summary
  senderLabel    String?             // email sender display
  keyFacts       String[] @default([])
  requiredAction String?  @db.Text
  suggestedFollowUp String? @db.Text
  dueDate        DateTime?

  // Polymorphic source reference — populate the relevant pair only
  emailThreadId       String?
  emailMessageId      String?   // newest inbound message in window
  providerThreadId    String?   // Gmail audit
  providerMessageId   String?

  maintenanceRequestId String?
  applicationId        String?
  tenancyId            String?
  propertyId           String?
  noticeId             String?
  // Future: add columns as sources ship, or use sourceRefJson (see below)

  sourceRefJson Json?  // escape hatch: { "kind": "viewing_request", "id": "..." }

  sortOrder      Int     @default(0)

  briefingRun  BriefingRun  @relation(...)
  organization Organization @relation(...)
  emailThread  EmailThread? @relation(...)

  @@index([briefingRunId, urgency, sortOrder])
  @@index([briefingRunId, category])
  @@index([organizationId, sourceType])
}
```

### Extend existing models

**`OrganizationAiPolicy`** — add:

```prisma
briefingEnabled            Boolean @default(false)
maxBriefingRunsPerDay      Int     @default(2)
maxBriefingGeminiCallsPerRun Int   @default(5)
```

**`ConnectedEmailAccount`** — add:

```prisma
briefingEnabled Boolean @default(true)  // per-mailbox opt-in for briefing sync
```

**`Organization`** — add relation:

```prisma
briefingSettings BriefingSettings?
briefingRuns     BriefingRun[]
briefingItems    BriefingItem[]
```

### Design notes

- **`BriefingRun.briefingJson`** stores the full Gemini section output (executive summary, grouped sections, follow-up actions). Individual **`BriefingItem`** rows are denormalized for UI sorting/filtering and future mixed-source items.
- **MVP items** always have `sourceType: EMAIL` and populate `emailThreadId` / `providerMessageId`.
- **Future maintenance item** would set `sourceType: MAINTENANCE`, `maintenanceRequestId`, and skip email fields entirely.
- **`sourceRefJson`** avoids migration churn for rare future source types until they stabilize.

### Migration file

```
prisma/migrations/YYYYMMDDHHMMSS_daily_briefing/migration.sql
```

Seed: create disabled `BriefingSettings` for existing orgs in `prisma/seed.ts` (or lazy-create on first settings visit).

---

## 4. MVP source scope

### Active in MVP

| Source | Implementation |
|--------|----------------|
| `EMAIL` | Full pipeline: sync → filter → Gemini → items |

### Schema-ready, not implemented

| Source | Future trigger |
|--------|----------------|
| `MAINTENANCE` | New/open maintenance requests in window |
| `RENT_PAYMENT` | Buildium/payment integration or manual import |
| `DEPOSIT` | Deposit due/return events |
| `APPLICATION` | New/submitted applications |
| `VIEWING_REQUEST` | New prospects/showings |
| `INSPECTION` | Scheduled/completed inspections |
| `NOTICE` | RTB notices, move-out notices |
| `MOVE_OUT` | Tenancy offboarding queue |
| `VACANCY` | Unit vacancy changes |
| `SYSTEM` | Internal alerts, job failures |

MVP **`briefing.generate`** handler should call a **`collectBriefingSources()`** function that returns `{ email: EmailThread[] }` today. Future PRs add `{ maintenance: MaintenanceRequest[], ... }` without changing the job contract.

---

## 5. Gemini strategy

### Principle: deterministic first, one Gemini call per run

Do **not** call Gemini per email. The MVP target is **1 Gemini call per briefing run** (max `BRIEFING_MAX_GEMINI_CALLS_PER_RUN`, default 5, for overflow batching only).

### Step 1 — Deterministic PM relevance filter

Reuse and extend patterns from `lib/ai/inbox-classification/deterministic-filters.ts`:

**Include thread if any of:**
- Sender matches `Property.ownerEmail` (landlord)
- Sender matches `TenancyContact.email` (tenant)
- Sender matches `Prospect.email` or `Application.email`
- Strata corporation identifier in subject/snippet (`BCS|EPS|LMS` pattern)
- `EmailThread.category` is not `UNCATEGORIZED` with `categoryConfidence >= 0.7`
- Deterministic filter returned a match
- Subject/snippet matches PM keyword list (maintenance, rent, deposit, eviction, RTB, move-out, lease, showing, application) — **secondary signal only**, never sufficient alone without sender or category match

**Exclude thread if:**
- No PM signal above
- Thread is outbound-only with no inbound reply in window
- Connected account has `briefingEnabled = false`

Skipped threads increment `BriefingRun.itemsSkipped`; they are **not** sent to Gemini and **not** stored as items.

### Step 2 — Build briefing context (no Gemini yet)

New module: `lib/ai/briefing/build-context.ts`

For each included thread, extract:
- Thread id, subject (truncated 200 chars), snippet (truncated 300 chars)
- Sender email + display name
- `EmailThread.category`, confidence, deterministic match reason
- Parsed `contextLinks` via `parseEmailThreadContextLinks()`
- Resolved labels: property name, unit, tenant name (from DB joins)
- Newest inbound message timestamp
- **No full `bodyText`/`bodyHtml`** — use snippet + last message excerpt capped at 500 chars total per thread

Cap total context:
- Max **30 threads** per run (configurable constant)
- Max **12,000 characters** total context payload
- If over cap, prioritize: urgent keywords → unread → most recent

### Step 3 — Single Gemini structured output

New module: `lib/ai/briefing/generate-briefing.ts`

Call `createChatJsonCompletion()` (from frozen `gemini-client.ts`) with system + user prompts.

**Output schema** (`lib/ai/briefing/briefing-output.schema.ts`, Zod-validated):

```typescript
type BriefingOutput = {
  executiveSummary: string;
  estimatedReadingMinutes: number;
  confidenceNote?: string;       // e.g. "Excluded 4 non-PM threads"
  skippedCount: number;

  urgentItems: BriefingOutputItem[];
  landlordItems: BriefingOutputItem[];
  tenantItems: BriefingOutputItem[];
  maintenanceItems: BriefingOutputItem[];
  rentDepositItems: BriefingOutputItem[];
  strataItems: BriefingOutputItem[];
  generalAdminItems: BriefingOutputItem[];

  suggestedFollowUpActions: Array<{
    action: string;
    relatedThreadId?: string;    // EmailThread.id
    priority: "low" | "normal" | "high" | "urgent";
    dueDate?: string;            // ISO date
  }>;
};

type BriefingOutputItem = {
  threadId: string;              // EmailThread.id — required for EMAIL source
  title: string;
  sender: string;
  urgency: "low" | "normal" | "high" | "urgent";
  category: BriefingItemCategory;
  keyFacts: string[];            // max 5
  requiredAction?: string;
  suggestedFollowUp?: string;
  dueDate?: string;
  propertyLabel?: string;
  tenantOrLandlordLabel?: string;
};
```

Gemini instructions (system prompt highlights):
- BC property management context; RTB-aware language
- Never invent facts not present in context
- Never include raw email quotes longer than one short phrase
- If insufficient PM context, return empty section arrays
- Map each item to a valid `threadId` from input

### Step 4 — Persist

- Store full `BriefingOutput` in `BriefingRun.briefingJson`
- Flatten sections into `BriefingItem` rows with `sourceType: EMAIL`, appropriate category/urgency, and email reference fields
- Set `geminiCallCount: 1`

### Overflow batching (edge case)

If included threads exceed 30, split into batches of 30, call Gemini per batch, merge section arrays in code. Cap at `BRIEFING_MAX_GEMINI_CALLS_PER_RUN`. Log `PARTIAL` if cap hit with remaining threads deferred to next run.

### Relationship to `agent.triage`

`agent.triage` classifies individual threads (up to 5 Gemini calls per job). Briefing does **not** depend on triage completing first — deterministic filters + existing category fields are sufficient for MVP. Optional enhancement: run triage before briefing when `autoTriageEnabled` is on (already chained from `gmail.sync`).

---

## 6. UI pages

### Navigation

Add to `config/navigation.ts` in **command** section (alongside Inbox and Gmail):

```typescript
{
  id: "nav-daily-briefing",
  moduleId: "dailyBriefing",
  label: "Daily Briefing",
  href: "/briefing",
  enabled: true,
  section: "command",
  minimumRole: "MEMBER",
}
```

Add `"dailyBriefing"` to `NavModuleId` union.

### `/briefing` — Command center (main page)

**Layout:** Morning / Afternoon tabs (default tab = current slot based on org timezone).

**Sections (per tab, most recent run for that slot today):**
1. **Header** — executive summary, estimated reading time, run timestamp, sync freshness indicator
2. **Urgent** — red/amber badge, items first
3. **Grouped categories** — Landlord, Tenant, Maintenance, Rent/Deposit, Strata, General Admin
4. **Suggested follow-ups** — action list from `briefingJson`

**Actions:**
- **Run briefing now** — Server Action enqueues `briefing.generate` for current slot (admin or MEMBER with permission)
- **Mark reviewed** — sets `BriefingRun.reviewedAt` + `reviewedByUserId` (simple MVP; no per-item review)
- Link each item → `/inbox/[threadId]`

**Empty states:**
- Feature disabled → link to `/briefing/settings`
- No Gmail connected → link to `/email`
- No run yet today → "Next briefing at {time}" + Run now button

**Files:**
- `app/(dashboard)/briefing/page.tsx`
- `app/(dashboard)/briefing/actions.ts`
- `components/briefing/briefing-command-center.tsx`
- `components/briefing/briefing-run-header.tsx`
- `components/briefing/briefing-item-list.tsx`
- `components/briefing/briefing-slot-tabs.tsx`
- `lib/briefing/briefing-queries.ts` — server-side data loading

Follow patterns from `app/(dashboard)/inbox/page.tsx` and `components/inbox/inbox-command-center.tsx`.

### `/briefing/[runId]` — Run detail

Historical run view: full sections, metadata (window, skipped count, email sent status), mark reviewed, link back to `/briefing`.

**Files:**
- `app/(dashboard)/briefing/[runId]/page.tsx`

### `/briefing/settings` — Admin configuration

**Fields:**
- Enable Daily Briefing (master toggle → `BriefingSettings.enabled` + `OrganizationAiPolicy.briefingEnabled`)
- Morning / Afternoon enable + local times
- Timezone (default `America/Vancouver`)
- Email recipients (multi-input; default org admins)
- Per-mailbox toggles (list `ConnectedEmailAccount` with `briefingEnabled`)
- Auto-sync before briefing toggle

**Access:** `minimumRole: "ADMIN"` (match Organization settings pattern).

**Files:**
- `app/(dashboard)/briefing/settings/page.tsx`
- `app/(dashboard)/briefing/settings/actions.ts`
- `components/briefing/briefing-settings-form.tsx`

---

## 7. Email delivery

Use existing Resend stack — **not SendGrid**.

### New files

- `lib/email/templates/daily-briefing.ts` — `buildDailyBriefingEmail(run, items, appUrl)`
- `lib/briefing/send-briefing-email.ts` — orchestrates send via `sendEmail()`

### Email content rules

- **Subject:** `Daily Briefing — {Morning|Afternoon} — {Organization name} — {Mon DD, YYYY}`
- **Body includes:**
  - Executive summary (2–4 sentences)
  - Urgent items first (title, sender, key facts, action)
  - Grouped sections (Landlord, Tenant, Maintenance, etc.)
  - Suggested follow-up actions
  - Link: `{APP_PUBLIC_URL}/briefing/{runId}`
  - Link: `{APP_PUBLIC_URL}/briefing`
- **Never include:** raw email bodies, full message text, attachment content
- **Dev:** falls through to console provider when `EMAIL_PROVIDER=console`

### Recipients

From `BriefingSettings.emailRecipients`. If empty, resolve org `ADMIN` membership emails at send time.

### Send timing

After `briefing.generate` persists run with status `COMPLETED`. If email fails, set status `PARTIAL`, store error, retry email only (not full Gemini) on job retry.

---

## 8. Privacy safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Authorized mailboxes only | Query `ConnectedEmailAccount` where `organizationId` matches, `status = CONNECTED`, `briefingEnabled = true` |
| PM-relevant only | Deterministic filter gate before Gemini; skipped count tracked |
| Minimal content storage | `BriefingItem.summary` is Gemini-generated summary, not `EmailMessage.bodyText`; subject truncated; no HTML bodies in briefing tables |
| Audit references | Store `emailThreadId`, `emailMessageId`, `providerThreadId`, `providerMessageId` for staff review in inbox |
| Skip personal email | Threads failing PM gate never reach Gemini or briefing items |
| Org-level disable | `BriefingSettings.enabled = false` (default) + `OrganizationAiPolicy.briefingEnabled = false` (default) |
| Env master switch | `BRIEFING_AUTOMATION_ENABLED=false` (default) blocks job enqueue and processing |
| Audit trail | `AuditLog` events without bodies: `briefing.started`, `briefing.completed`, `briefing.email.sent`, `briefing.failed` |
| Gemini isolation | Briefing prompts include only truncated context; system prompt forbids reproducing full emails |

Staff can always open the full thread in `/inbox/[threadId]` for review — briefing is a summary layer, not a mailbox replacement.

---

## 9. Job design

### Job types

| Job type | Handler | Purpose |
|----------|---------|---------|
| `briefing.schedule` | `handleBriefingSchedule` | Cron fan-out: find due orgs/slots, enqueue sync + generate |
| `briefing.generate` | `handleBriefingGenerate` | Single org briefing run |
| `gmail.sync` (existing) | `handleGmailSync` | Called with `triggerSource: "CRON"` before briefing |

No separate `gmail.sync.scheduled` type needed — reuse `gmail.sync` with `triggerSource: "CRON"` (already supported; `getSyncMaxThreadsForTriggerSource()` in `gmail-sync-core.ts` may use different thread caps).

### `briefing.schedule` payload

```typescript
{ slot: "MORNING" | "AFTERNOON" }
```

**Logic:**
1. Query orgs where `BriefingSettings.enabled`, slot enabled, and local time is within schedule window (or forced by cron)
2. For each org: enqueue `gmail.sync` for each `briefingEnabled` connected account (dedupe via existing active-job check in `enqueueGmailSyncJob`)
3. Enqueue `briefing.generate` with `scheduledAt: now + 5 minutes` to allow sync to complete

**Idempotency key:** `briefing-schedule:{orgId}:{slot}:{YYYY-MM-DD}`

### `briefing.generate` payload

```typescript
{
  slot: "MORNING" | "AFTERNOON";
  windowStart?: string;  // ISO; computed if omitted
  windowEnd?: string;
  skipSync?: boolean;    // true for manual "Run now" after recent sync
}
```

**Idempotency key:** `briefing-generate:{orgId}:{slot}:{windowEnd-iso-date}`

Uses existing `BackgroundJob` unique constraint: `@@unique([organizationId, jobType, idempotencyKey])`.

### Retry strategy

Inherit from `lib/jobs/processor.ts`:
- `maxAttempts: 3` (default)
- `RETRY_DELAY_MS: 60_000` between retries
- Gemini rate limit errors: catch via `isGeminiRateLimitError()` from `lib/ai/gemini-errors.ts`, allow retry
- Email-only failure on final attempt: mark run `PARTIAL`, do not re-call Gemini on retry (store `briefingJson` first, then email)

### Cron schedule

**MVP decision (2026-06):** Vercel Hobby allows only **one cron invocation per day**. This repo already uses that slot for job draining (`vercel.json` → `GET /api/internal/jobs/process` at `0 6 * * *` UTC). **Do not add twice-daily briefing crons to `vercel.json` on Hobby** — use external cron instead.

**External cron endpoint (implemented):**

| Route | Purpose |
|-------|---------|
| `GET/POST /api/internal/briefing/schedule?slot=MORNING\|AFTERNOON` | Enqueues one `briefing.schedule` job per eligible org |

Auth: same as job processor (`Authorization: Bearer $CRON_SECRET` or `x-cron-secret`).

**Suggested UTC schedule (PDT / `America/Vancouver` defaults):**

| Local time | Slot | UTC (PDT) | Cron expression |
|------------|------|-----------|-----------------|
| 07:00 | MORNING | 14:00 | `0 14 * * *` |
| 14:00 | AFTERNOON | 21:00 | `0 21 * * *` |

During PST (UTC−8), adjust to 15:00 and 22:00 UTC. Long-term: hourly check against `BriefingSettings.timezone` + local times.

**After schedule enqueue, drain jobs:**

```bash
curl -X POST "$APP/api/internal/jobs/process" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

**GitHub Actions example:** two workflow schedules calling `/api/internal/briefing/schedule`, plus a follow-up job-processor drain (or rely on existing daily Vercel cron if queue depth is acceptable).

**Not implemented on Vercel Hobby:**

```json
// Do NOT add these to vercel.json until plan supports multiple daily crons:
{ "path": "/api/internal/briefing/schedule?slot=MORNING", "schedule": "0 14 * * *" },
{ "path": "/api/internal/briefing/schedule?slot=AFTERNOON", "schedule": "0 21 * * *" }
```

UTC times assume `America/Vancouver` PDT (07:00 local ≈ 14:00 UTC; 14:00 local ≈ 21:00 UTC). **Production:** implement hourly schedule check against `BriefingSettings.timezone` + local times to handle PST/PDT and per-org overrides.

**Legacy plan note:** extending `app/api/internal/jobs/process` with `mode=briefing-schedule` was considered; the dedicated `/api/internal/briefing/schedule` route keeps job draining separate.

### Handler registration

Add to `lib/jobs/handlers/registry.ts`:

```typescript
[JOB_TYPES.BRIEFING_SCHEDULE]: handleBriefingSchedule,
[JOB_TYPES.BRIEFING_GENERATE]: handleBriefingGenerate,
```

### New library modules

```
lib/briefing/
  constants.ts
  enqueue-briefing-generate.ts
  enqueue-briefing-schedule.ts
  enqueue-scheduled-gmail-sync.ts      # wraps enqueueGmailSyncJob(triggerSource: CRON)
  collect-email-sources.ts
  persist-briefing-run.ts
  send-briefing-email.ts
  briefing-queries.ts
  audit.ts

lib/ai/briefing/
  build-context.ts
  build-prompt.ts
  briefing-output.schema.ts
  parse-briefing-output.ts
  generate-briefing.ts
  pm-relevance-filter.ts
  pm-relevance-filter.test.ts

lib/jobs/handlers/
  briefing-schedule.ts
  briefing-generate.ts
```

---

## 10. Environment variables

### Existing (required for MVP)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_GMAIL_CLIENT_ID` | Gmail OAuth |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Gmail OAuth |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Token storage |
| `GEMINI_API_KEY` | Briefing generation |
| `GEMINI_MODEL` | Optional; default `gemini-2.5-flash` |
| `RESEND_API_KEY` | Staff email delivery |
| `EMAIL_FROM` | Sender address |
| `APP_PUBLIC_URL` | Links in email |
| `CRON_SECRET` / `JOB_PROCESSOR_SECRET` | Job processor auth |
| `JOB_PROCESSOR_ACTOR_USER_ID` | Audit actor for cron jobs |

### New (add to `.env.example`)

```bash
# --- Daily Briefing automation ---
# Master switch for briefing.* job types (default off)
BRIEFING_AUTOMATION_ENABLED="false"

# Max Gemini calls per briefing run (default 5; MVP uses 1)
# BRIEFING_MAX_GEMINI_CALLS_PER_RUN="5"

# Lookback hours when no prior successful briefing run exists (default 12)
# BRIEFING_DEFAULT_LOOKBACK_HOURS="12"

# Max email threads included in briefing context (default 30)
# BRIEFING_MAX_THREADS_PER_RUN="30"
```

### Not in MVP

- Twilio / SMS vars
- SendGrid
- Gmail Pub/Sub vars

### Production guards

Add briefing vars to `lib/runtime/production-guards.ts` validation: if `BRIEFING_AUTOMATION_ENABLED=true`, require `GEMINI_API_KEY` and email config for orgs with briefing enabled.

---

## 11. Implementation sequence

Six small PRs, each independently reviewable and deployable behind feature flags.

### PR 1 — Schema + migration

**Objective:** Data model only; no runtime behavior.

**Files:**
- `prisma/schema.prisma` — enums, models, `OrganizationAiPolicy` + `ConnectedEmailAccount` extensions
- `prisma/migrations/*_daily_briefing/`
- `prisma/seed.ts` — optional disabled `BriefingSettings` for seed org

**Verify:** `npm run db:migrate`, build passes, no behavior change.

---

### PR 2 — Briefing core library

**Objective:** Pure functions — filter, context build, prompt, parse, persist helpers.

**Files:**
- `lib/ai/briefing/*`
- `lib/briefing/pm-relevance-filter.ts` (or under ai/briefing)
- `lib/briefing/persist-briefing-run.ts`
- `lib/briefing/collect-email-sources.ts`
- `lib/briefing/constants.ts`
- Unit tests: `lib/ai/briefing/*.test.ts`, `lib/briefing/*.test.ts`

**Verify:** `npm test`; no job or UI wiring yet.

---

### PR 3 — Job handlers + cron

**Objective:** End-to-end background pipeline behind flags.

**Files:**
- `lib/jobs/types.ts` — new job types
- `lib/jobs/policy.ts` — `isBriefingAutomationEnabled()`, allowlist
- `lib/jobs/handlers/briefing-schedule.ts`
- `lib/jobs/handlers/briefing-generate.ts`
- `lib/jobs/handlers/registry.ts`
- `lib/briefing/enqueue-*.ts`
- `lib/briefing/audit.ts`
- `app/api/internal/jobs/process/route.ts` — optional `mode=briefing-schedule`
- `vercel.json` — cron entries
- `.env.example` — new vars

**Verify:** Manual curl drain with test org, flags enabled; `BriefingRun` row created.

---

### PR 4 — Dashboard UI

**Objective:** Staff-facing briefing command center.

**Files:**
- `app/(dashboard)/briefing/page.tsx`
- `app/(dashboard)/briefing/[runId]/page.tsx`
- `app/(dashboard)/briefing/settings/page.tsx`
- `app/(dashboard)/briefing/actions.ts`
- `app/(dashboard)/briefing/settings/actions.ts`
- `components/briefing/*`
- `lib/briefing/briefing-queries.ts`
- `config/navigation.ts`

**Verify:** View briefing run, mark reviewed, run now, settings save.

---

### PR 5 — Resend email template

**Objective:** Staff email delivery after run completion.

**Files:**
- `lib/email/templates/daily-briefing.ts`
- `lib/briefing/send-briefing-email.ts`
- Wire into `handleBriefingGenerate`

**Verify:** Console log in dev; Resend delivery in staging.

---

### PR 6 — Tests + docs

**Objective:** Integration tests, smoke runbook, update deployment checklist.

**Files:**
- `lib/jobs/handlers/briefing-generate.test.ts`
- `docs/daily-briefing-smoke-test.md`
- `docs/deployment-checklist.md` — briefing env vars
- Update `docs/agent-job-framework.md` — reference briefing jobs

**Verify:** Full staging smoke (see §12).

---

## 12. Test plan

### Unit tests

| Module | Cases |
|--------|-------|
| `pm-relevance-filter` | Owner email → include; unknown sender → exclude; strata pattern → include; keyword-only → exclude |
| `build-context` | Truncation limits; max thread cap; priority ordering |
| `parse-briefing-output` | Valid JSON; missing fields; invalid threadId |
| `briefing-output.schema` | Zod validation edge cases |
| `persist-briefing-run` | Idempotent upsert on same windowEnd |
| `buildDailyBriefingEmail` | Urgent-first ordering; no raw bodies in HTML |

Run: `npm test`

### Integration tests

| Test | Setup |
|------|-------|
| `handleBriefingGenerate` | Seed org + connected account + email threads; mock `createChatJsonCompletion`; assert `BriefingRun` + `BriefingItem` rows |
| Privacy gate | Seed personal-email thread (unknown sender); assert `itemsSkipped` incremented, no items created |
| Job idempotency | Enqueue same idempotency key twice; assert single run |
| Email partial failure | Mock send failure; assert `PARTIAL` status, `briefingJson` preserved |

### Staging smoke test

Document in `docs/daily-briefing-smoke-test.md`:

1. **Prerequisites**
   - `BRIEFING_AUTOMATION_ENABLED=true`
   - `GEMINI_API_KEY` set
   - Gmail connected on `/email`
   - `RESEND_API_KEY` + verified domain (or console provider)

2. **Enable feature**
   - `/briefing/settings` → enable Daily Briefing
   - Add staff recipient email
   - Confirm mailbox `briefingEnabled`

3. **Trigger**
   - Click **Run briefing now** on `/briefing`
   - Or: `curl -X POST $APP/api/internal/jobs/process -H "Authorization: Bearer $CRON_SECRET" -d '{"limit":10}'`

4. **Verify dashboard**
   - `/briefing` shows Morning or Afternoon tab with executive summary
   - Urgent items appear first
   - Item links open correct `/inbox/[threadId]`
   - **Mark reviewed** sets reviewed timestamp

5. **Verify email**
   - Staff recipient receives summary email
   - Email contains link to `/briefing/{runId}`
   - No raw email body text in email HTML

6. **Verify privacy**
   - Personal unrelated thread (if present in mailbox) not in briefing
   - `BriefingItem` rows have no `bodyText` columns
   - `AuditLog` has briefing events without message content

7. **Verify cron path**
   - Confirm `briefing.schedule` enqueues `gmail.sync` then `briefing.generate`
   - Check `ConnectedEmailAccount.lastSyncedAt` updated

---

## 13. Risk review

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Gemini summarizes personal/irrelevant email** | Medium | High | Strict deterministic gate before Gemini; never send uncategorized unknown-sender threads; confidenceNote + skipped count visible to staff |
| **Gemini rate limits** | Medium | Medium | 1 call per run; reuse `isGeminiRateLimitError()` + job retry; cap threads at 30; stagger org runs in schedule job |
| **Stale Gmail sync** | Medium | Medium | `autoSyncBeforeBriefing` enqueues sync 5 min before generate; show sync freshness on `/briefing`; skip generate if sync failed and `lastSyncedAt` older than lookback |
| **Vercel cron limits (Hobby = 1/day)** | High | High | Document external cron (GitHub Actions, Upstash QStash) hitting `/api/internal/jobs/process`; or upgrade Vercel plan; MVP may use manual "Run now" + daily cron only |
| **Privacy / data retention** | Low | High | No raw bodies in briefing tables; minimal summaries; audit refs only; future retention job (post-MVP) |
| **Overbuilding too early** | Medium | Medium | Email-only source in MVP; schema-ready enums; no Pub/Sub, SMS, or per-source collectors until briefing quality proven |
| **Frozen module conflicts** | Low | Medium | Do not edit `lib/gmail/**` or `gemini-client.ts`; wrap existing enqueue/sync functions |
| **Job processor timeout** | Medium | Medium | `maxDuration = 60` on processor route; keep Gemini context bounded; if needed, split generate into persist-then-email steps within handler |
| **Duplicate briefings** | Low | Low | Idempotency keys on `organizationId + slot + windowEnd`; UI shows latest run per slot per day |

---

## Appendix A — Gemini prompt sketch

**System:**
> You are a property management briefing assistant for a BC-based PM company. Given a JSON list of email thread summaries, produce a structured daily briefing for staff. Only use facts present in the input. Do not quote full emails. Flag urgency for RTB deadlines, safety issues, eviction, flood/fire, or explicit same-day requests. Return valid JSON matching the provided schema.

**User:**
> Organization: {name}. Briefing slot: {MORNING|AFTERNOON}. Window: {start} to {end}. Threads: [{...}]

---

## Appendix B — Audit events

| Event | Metadata |
|-------|----------|
| `briefing.schedule.enqueued` | orgId, slot, syncJobIds |
| `briefing.started` | runId, slot, windowStart, windowEnd |
| `briefing.completed` | runId, itemsIncluded, itemsSkipped, geminiCallCount |
| `briefing.failed` | runId, error (truncated) |
| `briefing.email.sent` | runId, recipientCount |
| `briefing.email.failed` | runId, error (truncated) |
| `briefing.reviewed` | runId, userId |

---

## Appendix C — Future expansion checklist

When adding a non-email source (e.g. maintenance):

1. Implement `collectMaintenanceSources(orgId, window)` returning candidates
2. Map to `BriefingItem` with `sourceType: MAINTENANCE`, `maintenanceRequestId`
3. Include maintenance rows in briefing context JSON for Gemini (no email fields)
4. Add dashboard links to `/maintenance/[id]`
5. No schema migration if `maintenanceRequestId` column already exists

---

## Appendix D — Key file index

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` |
| Gmail sync handler | `lib/jobs/handlers/gmail-sync.ts` |
| Job enqueue | `lib/jobs/enqueue.ts` |
| Job processor | `lib/jobs/processor.ts` |
| Job policy | `lib/jobs/policy.ts` |
| Cron route | `app/api/internal/jobs/process/route.ts` |
| Vercel cron | `vercel.json` |
| Deterministic filters | `lib/ai/inbox-classification/deterministic-filters.ts` |
| Gemini client | `lib/ai/gemini-client.ts` |
| Context links | `lib/ai/email-context-links.ts` |
| Resend service | `lib/email/email.service.ts` |
| Navigation | `config/navigation.ts` |
| Inbox UI reference | `app/(dashboard)/inbox/page.tsx` |
| Env template | `.env.example` |
| Frozen module policy | `docs/next-pr-migration-order.md` |

---

## 14. MVP operations runbook

### Required environment variables

| Variable | Required for briefing | Notes |
|----------|----------------------|-------|
| `BRIEFING_AUTOMATION_ENABLED` | Yes | Must be `true` to enqueue/process `briefing.*` jobs |
| `GEMINI_API_KEY` | Yes | Briefing generation |
| `GOOGLE_GMAIL_*` + `GMAIL_TOKEN_ENCRYPTION_KEY` | Yes | Gmail sync source |
| `EMAIL_ENABLED` | For email delivery | Must be `true` in production |
| `EMAIL_PROVIDER` | For email delivery | `resend` in production |
| `RESEND_API_KEY` | For email delivery | |
| `EMAIL_FROM` | For email delivery | Verified sender domain |
| `APP_PUBLIC_URL` | For email links | Same origin as staff app |
| `JOB_PROCESSOR_SECRET` or `CRON_SECRET` | For cron + manual drain | Protects `/api/internal/jobs/process` and `/api/internal/briefing/schedule` |
| `JOB_PROCESSOR_ACTOR_USER_ID` | For cron jobs | Valid staff `User.id` for audit when no user trigger |

**Not required for briefing MVP:** `AGENT_AUTOMATION_ENABLED` (agent.* jobs are separate).

Optional tuning: `BRIEFING_MAX_GEMINI_CALLS_PER_RUN`, `BRIEFING_DEFAULT_LOOKBACK_HOURS`, `GEMINI_MODEL`.

### Organization settings (in app)

Per org, via **`/briefing/settings`** (admin):

1. **Enable Daily Briefing** (`BriefingSettings.enabled`) — off by default for new orgs.
2. **Morning / afternoon slots** — default on; disable individually if needed.
3. **Email recipients** — required for Resend delivery; comma-separated.
4. **Auto-briefing** (`OrganizationAiPolicy.autoBriefingEnabled`) — required for scheduled automation.
5. **Auto-sync before briefing** — enqueues `gmail.sync` before generate (5-minute delay).

First save creates `BriefingSettings` via upsert; seed does not enable briefing by default.

### Manual run

1. Staff: **`/briefing`** → **Run briefing now** (requires settings enabled).
2. Drain queue:

```bash
curl -X POST "$APP_PUBLIC_URL/api/internal/jobs/process" \
  -H "Authorization: Bearer $JOB_PROCESSOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

### Scheduled run (external cron)

```bash
curl -X POST "$APP_PUBLIC_URL/api/internal/briefing/schedule?slot=MORNING" \
  -H "Authorization: Bearer $CRON_SECRET"
# then drain /api/internal/jobs/process (repeat until idle)
```

### Verify email delivery

- Run must be **COMPLETED** or **PARTIAL** with `itemsIncluded > 0`.
- Recipients configured and `EMAIL_ENABLED=true`.
- Check `BriefingRun.emailSentAt` and audit `briefing.email.sent`.
- Zero-item runs skip email by design.

### Disable briefing

- App: **`/briefing/settings`** → disable Daily Briefing and auto-briefing.
- Env: `BRIEFING_AUTOMATION_ENABLED=false` blocks all briefing jobs globally.

### Privacy safeguards

- EMAIL-only MVP: all items are `sourceType: EMAIL`, `dataProvenance: EMAIL_MENTION`.
- No raw email bodies in `BriefingRun`, `BriefingItem`, dashboard, or staff email.
- Rent/deposit/payment references are **email mentions**, not Buildium/accounting facts.
- Skipped personal threads increment `itemsSkipped` only — never listed.

### Buildium / future sources

`BriefingSourceType` includes RENT_PAYMENT, DEPOSIT, MAINTENANCE, etc. for schema readiness. MVP ignores non-EMAIL sources. UI labels future types as “Coming later with Buildium / future integrations.”

### Smoke test doc

See **`docs/daily-briefing-smoke-test.md`** for step-by-step checklist.
