# Daily Briefing — Active Email Items Enhancement Plan

**Status:** Planning  
**Last updated:** 2026-06-26  
**Depends on:** Daily Briefing MVP (PRs 1–6)

---

## Problem

Today, Daily Briefing only summarizes **email threads with activity in the current window** (`collectEmailBriefingCandidates` filters by `lastMessageAt` / `updatedAt` between `windowStart` and `windowEnd`). Once the window passes, an unresolved PM email disappears from the next briefing even if staff never replied, forwarded, archived, or marked it handled.

**Goal:** Unresolved PM email items should **persist across briefings** until staff action or reliable system detection clears them.

---

## Current state (code inspection)

### What exists today

| Area | Current behaviour |
|------|-------------------|
| **Candidate collection** | `lib/briefing/collect-email-candidates.ts` — window-scoped threads only |
| **PM filter** | `lib/briefing/briefing-filters.ts` — deterministic gate; skips outbound-only threads |
| **BriefingItem** | One row per run; `emailThreadId` FK; no resolution/attention fields |
| **BriefingRun** | Run-level `reviewedAt` / `reviewedByUserId` only (whole run, not per thread) |
| **Inbox UI** | Derived `needsReply` = latest message is inbound (`!isOutbound`); not persisted |
| **Gmail sync** | `EmailMessage.isOutbound` = Gmail `SENT` label; `labelIds` stored on thread/message |
| **Inbox actions** | Category edit, PM context links, AI draft — **no** mark-resolved/archive/review on threads |

### Detection signals available without new Gmail scope

| Signal | Source | Reliability | Notes |
|--------|--------|-------------|-------|
| **Outbound reply** | `EmailMessage.isOutbound === true` with `sentAt > surfacedAt` | **High** | Already synced; same thread ID in Gmail |
| **Needs reply (inbox)** | Latest message inbound | **High** | Same as inbox list; recomputable each run |
| **Unread inbound** | `EmailThread.isUnread` + latest inbound | **Medium** | Cleared when staff reads in Gmail; not proof of action |
| **Archived in Gmail** | Thread/message `labelIds` missing `INBOX` | **Medium** | Labels synced on persist; thread may leave sync set if only INBOX-synced |
| **Draft created** | `AiDraftResponse` on thread | **Low for “handled”** | Draft ≠ sent reply; use as “in progress” hint only |
| **Forwarded** | No dedicated field | **Low in MVP** | Forwards may be new thread or outbound with `Fwd:` subject; header metadata not stored |

### What does NOT exist

- No `EmailThread.resolvedAt` or inbox “mark done” action
- No per-item briefing resolution
- No carry-forward from prior runs
- Forward detection not implemented in parser (only `SENT` / `UNREAD` labels)

---

## Recommended approach (MVP)

**Use a thread-level attention registry**, not run-scoped duplication.

### Core idea

1. When a thread is first included in a briefing → create/update **`EmailThreadBriefingAttention`** (one row per `organizationId + emailThreadId`).
2. Each subsequent run → **re-include unresolved rows** in a **“Still needs attention”** section without creating duplicate registry rows.
3. Before carry-forward → **re-evaluate deterministic signals** (outbound reply, optional archive).
4. Staff can **Mark resolved** from briefing UI → sets `resolvedAt` and removes from future carry-forward.
5. **Do not re-call Gemini** for carried-forward items in MVP — reuse cached summary from last surfacing (refresh subject/status only).

This avoids:
- Duplicating the same thread as many unrelated `BriefingItem` rows over time
- Asking AI whether something was “handled”
- Storing raw email bodies

### Why not only extend `BriefingItem`?

`BriefingItem` is **immutable history per run**. Resolution state belongs on the **thread**, not on a single run’s snapshot. Run items should reference attention state via `attentionStatus` + `emailThreadId`.

### Why not only inbox `actionState`?

Inbox state is **computed at read time** and not persisted. Briefing jobs need durable, org-scoped state that survives between cron runs without coupling to inbox UI refactors.

---

## Schema changes (PR 1)

### New enum: `BriefingAttentionStatus`

```prisma
enum BriefingAttentionStatus {
  ACTIVE          // surfaced, still needs attention
  REPLIED         // outbound detected after surface (system)
  FORWARDED       // forward detected (phase 2 / heuristic)
  REVIEWED        // staff marked reviewed (optional phase 2)
  RESOLVED        // staff marked resolved
  ARCHIVED        // Gmail archived / left INBOX (system, phase 2)
}
```

### New model: `EmailThreadBriefingAttention`

```prisma
model EmailThreadBriefingAttention {
  id             String @id @default(cuid())
  organizationId String
  emailThreadId  String

  status BriefingAttentionStatus @default(ACTIVE)

  /// When this thread first appeared in a briefing
  firstSurfacedAt DateTime
  /// Last briefing run that included this thread
  lastSurfacedRunId String?
  lastSurfacedAt    DateTime?

  /// Staff resolution
  resolvedAt       DateTime?
  resolvedByUserId String?
  resolutionReason String?   // e.g. "manual", "outbound_reply_detected"

  /// Cached display from last Gemini item (no bodies)
  summaryTitle String
  category     BriefingItemCategory
  urgency      BriefingItemUrgency
  subject      String?
  summaryJson  Json?          // keyFacts, requiredAction, etc.

  /// Reply detection baseline
  surfacedAtOutboundCount Int @default(0)
  lastOutboundAt            DateTime?

  organization Organization @relation(...)
  emailThread  EmailThread  @relation(...)
  resolvedBy   User?          @relation(...)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, emailThreadId])
  @@index([organizationId, status])
}
```

### Extend `BriefingItem` (display only)

```prisma
/// NEW | STILL_ACTIVE — per-run presentation label
attentionLabel BriefingAttentionLabel @default(NEW)

/// Optional link to attention registry row
emailThreadBriefingAttentionId String?
```

```prisma
enum BriefingAttentionLabel {
  NEW
  STILL_ACTIVE
  REPLIED
  FORWARDED
  REVIEWED
  RESOLVED
}
```

`attentionLabel` on the run item is the **status shown that day** (may differ from registry if auto-updated mid-run). Registry `status` is source of truth for carry-forward eligibility.

### Optional phase 2: `EmailThread` inbox flags

If Gmail archive detection proves flaky, add persisted inbox workflow fields later:

```prisma
// EmailThread — future, not MVP
staffReviewedAt DateTime?
staffResolvedAt DateTime?
```

Prefer briefing-specific table first to avoid overloading inbox domain.

---

## Status rules (deterministic)

Evaluated in `lib/briefing/evaluate-attention-status.ts` **before each generate run**:

| Status | Rule |
|--------|------|
| **NEW** | Thread first included in this run’s briefing output |
| **STILL_ACTIVE** | Registry `ACTIVE`, carried forward, no clearing signal |
| **REPLIED** | Exists outbound `EmailMessage` in thread with `sentAt > firstSurfacedAt` (and optionally after last inbound that triggered briefing) |
| **FORWARDED** | **Phase 2:** outbound + subject matches `/^fwd:/i` OR new thread linked by `References` (not stored today) |
| **REVIEWED** | Staff clicked “Mark reviewed” on item (optional; may map to soft resolve or separate from RESOLVED) |
| **RESOLVED** | Staff “Mark resolved” OR auto-resolve when REPLIED if org setting `autoResolveOnReply` (default **true** for MVP) |
| **ARCHIVED** | **Phase 2:** thread `labelIds` no longer includes `INBOX` while connected account syncs INBOX |

**Carry-forward eligibility:** registry status is `ACTIVE` or `STILL_ACTIVE` equivalent — i.e. not `RESOLVED`, `REVIEWED` (if treated as closed), or auto-cleared `REPLIED` when auto-resolve enabled.

**Do not carry forward if:**
- Staff marked resolved
- Auto-replied detected and policy clears item
- Thread fails PM filter on re-check (e.g. became outbound-only with no open inbound) — mark `RESOLVED` with reason `no_inbound_remaining`

---

## Job / generation changes (PR 2)

### Pipeline update (`run-briefing-generate.ts`)

```
1. Load window candidates (existing)
2. Load active attention rows for org where status ∈ { ACTIVE }
3. For each active row:
   a. Reload thread metadata (subject, snippet, messages: isOutbound, sentAt, labelIds)
   b. Run evaluateAttentionStatus()
   c. If cleared → update registry, skip carry-forward
   d. Else → add to carryForwardThreads set
4. Filter window candidates (existing PM filter)
5. Dedupe: window threads already in carryForward → treat as STILL_ACTIVE not NEW
6. Build Gemini context from **window-only new threads** (exclude carry-forward from Gemini input in MVP)
7. Merge output:
   - Gemini items → NEW
   - carryForwardThreads → STILL_ACTIVE (from registry cache)
8. Upsert registry for newly included window threads
9. Persist BriefingItem rows with attentionLabel
10. Email delivery (existing) — include Still needs attention section
```

### New modules

| File | Role |
|------|------|
| `lib/briefing/load-active-attention.ts` | Query unresolved registry rows |
| `lib/briefing/evaluate-attention-status.ts` | Reply/archive heuristics |
| `lib/briefing/upsert-attention-registry.ts` | Create/update on new items |
| `lib/briefing/merge-briefing-items.ts` | Combine new + carried items for persist |
| `lib/briefing/collect-email-candidates.ts` | Add optional `threadIds[]` loader for active rows |

### Gemini scope (MVP)

- **New threads in window:** full Gemini summarization (existing).
- **Carried threads:** no Gemini call; reuse `EmailThreadBriefingAttention.summaryTitle` / `summaryJson`; refresh subject + status label only.
- Optional later: one lightweight Gemini pass “anything changed?” — out of MVP scope.

### Counts

- `threadsScanned` = window candidates + active carry-forward considered
- `itemsIncluded` = new + still active items shown
- Executive summary: template line — “N items still need attention from prior briefings”

---

## UI changes (PR 3)

### `/briefing` and `/briefing/[runId]`

1. **Section: “Still needs attention”** above or after “New in this window” (product choice: attention first).
2. **Status badge** on each item: New | Still active | Replied | Resolved | etc.
3. **Actions per item** (email threads only):
   - **Mark resolved** → server action → registry `RESOLVED`
   - Optional: **Mark reviewed** → `REVIEWED` (or keep run-level reviewed as today)
4. **Inbox link** — existing `/inbox/[threadId]` (unchanged).
5. **Disabled when** thread already resolved — show resolved state read-only.

### Components

| Component | Change |
|-----------|--------|
| `briefing-item-list.tsx` | Split sections; attention badge |
| `briefing-attention-badge.tsx` | New |
| `briefing-mark-resolved-button.tsx` | New (per item) |
| `briefing-run-card.tsx` | Show carry-forward count |

### Server actions (`app/(dashboard)/briefing/actions.ts`)

- `markBriefingItemResolvedAction({ runId, itemId })` — resolves by `emailThreadId`
- `markBriefingItemReviewedAction` — optional phase 2

Audit events:
- `briefing.attention.resolved`
- `briefing.attention.replied_detected`

---

## Email template changes (PR 4)

Update `lib/email/templates/daily-briefing-email.ts`:

1. Split items into:
   - **New in this briefing**
   - **Still needs attention**
2. Each item line includes:
   - Status label (e.g. `Still active`, `Replied`)
   - `summaryTitle`, subject, key facts (from cache)
   - Link: `{APP_PUBLIC_URL}/inbox/{threadId}`
   - Link: `{APP_PUBLIC_URL}/briefing/{runId}`
3. Footer disclaimer unchanged (no raw bodies; email mentions note).

Update `BriefingItemView` / query layer to expose `attentionLabel` and section grouping.

---

## Reply detection detail (MVP implementation)

Use existing synced data in `collect-email-candidates` or attention loader:

```typescript
function detectOutboundReplyAfter(args: {
  messages: Array<{ isOutbound: boolean; sentAt: Date }>;
  after: Date;
}): Date | null {
  const outbound = messages
    .filter((m) => m.isOutbound && m.sentAt > after)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  return outbound[0]?.sentAt ?? null;
}
```

Baseline `after` = `firstSurfacedAt` (or timestamp of newest inbound at first surface — slightly more accurate).

When detected:
1. Set registry `status = REPLIED`
2. If `autoResolveOnReply` (default true): set `RESOLVED` + `resolutionReason = outbound_reply_detected`
3. Item in **current** run may still show `Replied` for visibility even if dropped next run

**Caveat:** Gmail draft saved to thread is not synced as sent until actually sent — only `SENT` label counts (correct for MVP).

---

## Forward & archive (phase 2 — document, defer)

| Signal | MVP | Phase 2 |
|--------|-----|---------|
| Outbound reply | Yes | — |
| Manual resolve | Yes | — |
| Forwarded | No | Subject `Fwd:` + outbound; or parse `References` header in sync |
| Gmail archived | No | `!labelIds.includes('INBOX')` on thread after sync |
| Inbox “reviewed” | No | Persist `staffReviewedAt` on `EmailThread` if product wants cross-feature |

---

## Test plan

### Unit tests

| Module | Cases |
|--------|-------|
| `evaluate-attention-status` | Outbound after surface → REPLIED; no outbound → ACTIVE; resolved manual → excluded |
| `merge-briefing-items` | Dedupe window + active same thread; NEW vs STILL_ACTIVE labels |
| `load-active-attention` | Org scoped; excludes RESOLVED |
| `upsert-attention-registry` | Idempotent on same thread |
| Email template | Still needs attention section; status labels; inbox links |

### Integration tests

| Test | Assert |
|------|--------|
| Generate run 1 includes thread | Registry row created ACTIVE |
| Generate run 2 no window activity | Thread appears STILL_ACTIVE |
| Outbound message synced | Registry REPLIED/RESOLVED; absent run 3 |
| Manual resolve action | Registry RESOLVED; absent next run |
| No duplicate registry rows | One row per thread per org |

### Manual smoke

1. Include thread in briefing → verify “Still needs attention” next run.
2. Send reply from connected Gmail → sync → next briefing shows Replied or drops.
3. Mark resolved → gone from subsequent briefings.
4. Email contains both sections with inbox links.

---

## Suggested PR sequence

| PR | Scope | Risk |
|----|-------|------|
| **PR A — Schema + attention lib** | Migration, enum, `EmailThreadBriefingAttention`, evaluate/upsert/load helpers, unit tests | Low |
| **PR B — Generate pipeline** | Carry-forward merge, dedupe, skip Gemini for active, persist `attentionLabel` | Medium |
| **PR C — UI + actions** | Still needs attention section, badges, Mark resolved | Low |
| **PR D — Email template** | Section split + status labels | Low |
| **PR E — Phase 2 (optional)** | Archive detection, forward heuristic, auto-resolve settings, inbox reviewed | Medium |

Each PR independently deployable behind existing `BRIEFING_AUTOMATION_ENABLED` gate. No new env vars required for MVP.

---

## Non-goals (this enhancement)

- Buildium / non-email sources
- AI judgment of “handled vs not”
- Storing raw email bodies in attention registry
- Gmail Pub/Sub realtime resolution
- Replacing inbox queues with briefing state

---

## Open product questions

1. **REVIEWED vs RESOLVED** — Is “Mark reviewed” on a run enough, or do we need per-thread reviewed distinct from resolved?
2. **Auto-resolve on reply** — Default on (recommended) or keep showing as Replied for one more run?
3. **Urgency escalation** — Should carried items bump urgency after N days? (Defer.)
4. **Max carry-forward age** — Auto-expire after 30 days? (Defer; document as future.)

---

## Key files to touch

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` |
| Collect | `lib/briefing/collect-email-candidates.ts` |
| Generate | `lib/briefing/run-briefing-generate.ts` |
| Persist | `lib/briefing/persist-briefing-run.ts` |
| Queries/UI | `lib/briefing/briefing-queries.ts`, `components/briefing/*` |
| Email | `lib/email/templates/daily-briefing-email.ts` |
| Actions | `app/(dashboard)/briefing/actions.ts` |
| Inbox reference | `lib/inbox/inbox-thread-display.ts` (reply logic mirror) |
| Gmail | `lib/gmail/gmail-message-parser.ts` (phase 2 headers) |
