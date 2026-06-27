# Buildium Open API Integration — Technical Implementation Plan

**Project:** Rocket PM Dashboard (`rocketlogic.ca` / `rocket-pm-dashboard-app.vercel.app`)  
**Status:** Approved — planning doc only; **no code or migrations until Phase 1 is explicitly approved**  
**Last updated:** 2026-06-26  
**Direction:** Read-first; Buildium is accounting source of truth; no writes to Buildium until explicitly approved.

---

## Overview

Rocket PM already has a complete leasing workflow (properties → units → tenancies → contacts) but **no external ID columns** on core PM entities and **no rent ledger**. Buildium fills the accounting gap: rent schedules, balances, payments, deposits, and lease dates.

The integration mirrors the **Gmail pattern** (org-scoped connection record, encrypted secrets, manual sync first, `BackgroundJob` for async runs, `AuditLog` for security events) while keeping **operational tenancy data separate** from **Buildium accounting snapshots**.

**MVP path:** credentials + test connection → import properties/units → manual lease mapping → sync accounting snapshots → reconciliation UI → optional scheduled sync.

---

## Naming conventions

Aligned with `docs/daily-briefing-integration-plan.md`:

| Layer | Convention | Example |
|-------|------------|---------|
| Routes | kebab-case | `/settings/integrations/buildium` |
| Prisma models | PascalCase | `BuildiumConnection`, `TenancyBuildiumSnapshot` |
| Prisma enums | SCREAMING_SNAKE values in PascalCase enum names | `BuildiumConnectionStatus`, `BuildiumSyncStatus` |
| Library path | kebab-case dir | `lib/integrations/buildium/` |
| Job types | dot notation | `buildium.test_connection`, `buildium.sync` |
| Env vars | SCREAMING_SNAKE | `BUILDIUM_READ_ONLY`, `GMAIL_TOKEN_ENCRYPTION_KEY` (reuse for secrets) |
| Nav module id | camelCase | `buildium` in `config/navigation.ts` |
| Audit events | dot notation | `buildium.connect`, `buildium.sync.start`, `buildium.link.confirmed` |

UI copy: **Buildium** (settings), **Buildium Accounting Snapshot** (tenancy card).

---

## 1. Current Rocket PM data model review

### ORM and schema

| Item | Location |
|------|----------|
| ORM | Prisma + PostgreSQL |
| Schema | `prisma/schema.prisma` |
| Domain services | `lib/services/*.service.ts` |
| Staff auth | `lib/services/staff-context.ts`, `lib/services/property-access.ts` |

### Entity inventory

There is **no separate `Tenant`, `Rent`, `Deposit`, or `Inspection` table**. Mapping to Buildium:

| Rocket PM model | Buildium equivalent | Key fields today | Buildium relevance |
|-----------------|---------------------|------------------|-------------------|
| **`Property`** | Rental property | `name`, address, `propertyType`, owner contact | Map via address/name; store `buildiumPropertyId` |
| **`Unit`** | Rental unit | `unitNumber`, `propertyId`, `bedrooms` | Map via property + unit number; store `buildiumUnitId` |
| **`Tenancy`** | Lease | `monthlyRent`, `rentDueDay`, `securityDeposit`, `petDeposit`, lease/move dates, `status` | Map to Buildium lease; **do not overwrite** operational fields — use snapshot |
| **`TenancyContact`** | Tenant | `firstName`, `lastName`, `email`, `contactType` | Map to Buildium tenant; store `buildiumTenantId` per contact |
| **`Notice`** | (partial) move-out notice | `tenantRequestedMoveOutDate`, notice type/body | Operational only; Buildium has `MoveOutData` on leases |
| Move-out / inspection | In-app workflow on `Tenancy` | `inspectionDate`, `inspectionReportUrl`, `inspectionNotes`, status enum | **Not synced** — staff-entered |

**Rent and deposits** are scalar fields on `Tenancy`, not transactional ledgers:

```prisma
// Tenancy — operational lease setup (RTB-1), NOT accounting SoT after integration
monthlyRent     Decimal  @db.Decimal(12, 2)
rentDueDay      Int      @default(1)
securityDeposit Decimal  @db.Decimal(12, 2)
petDeposit      Decimal? @db.Decimal(12, 2)
```

### Existing Buildium touchpoints

| Location | What exists |
|----------|-------------|
| `Tenancy.buildiumResidentCenterUrl` | Manual URL field — complementary to integration; keep |
| `config/navigation.ts` | Disabled stub **Finance / Buildium** → `/modules/finance` (replace with settings route) |
| `lib/briefing/briefing-sources.ts` | Reserved `RENT_PAYMENT`, `DEPOSIT` source types — wire in Phase 6+ |
| `lib/integrations/` | Phase 0 stubs — extend with `buildium/` |

### Where Buildium IDs should be stored

**Hybrid approach:**

1. **Confirmed links** — nullable external ID columns on linked entities:
   - `Property.buildiumPropertyId` (Int, unique per org)
   - `Unit.buildiumUnitId` (Int, unique per org)
   - `Tenancy.buildiumLeaseId` (Int, unique per org)
   - `TenancyContact.buildiumTenantId` (Int, nullable)

2. **Reconciliation staging** — `BuildiumEntityLink` table for suggested/unconfirmed matches.

3. **Accounting data** — separate `TenancyBuildiumSnapshot` table so RTB-1 / lease-setup fields on `Tenancy` are never silently overwritten.

### Integration patterns to reuse

| Pattern | Gmail example | Apply to Buildium |
|---------|---------------|-------------------|
| Connection record | `ConnectedEmailAccount` | `BuildiumConnection` |
| Encrypted secrets | `lib/crypto/token-vault.ts` | `clientSecretEnc` via existing vault functions |
| Sync metadata | `lastSyncedAt`, `lastError`, `status` | Same on connection + per-entity |
| Async jobs | `BackgroundJob` | `buildium.sync`, `buildium.test_connection` |
| Audit | `AuditLog` | `buildium.*` events |
| Manual sync first | Gmail "Sync now" | "Sync from Buildium" button |

---

## 2. Proposed database changes

> **Deferred until approved phases.** Schema below is the target design; Phase 1 adds only `BuildiumConnection` + enums.

### 2.1 `BuildiumConnection` (org-scoped config)

```prisma
model BuildiumConnection {
  id             String   @id @default(cuid())
  organizationId String   @unique

  status          BuildiumConnectionStatus @default(DISCONNECTED)
  environment     BuildiumEnvironment      @default(PRODUCTION)

  clientId        String
  clientSecretEnc String                     @db.Text

  lastTestedAt    DateTime?
  lastSyncedAt    DateTime?
  lastSyncStatus  BuildiumSyncStatus?
  lastSyncError   String?                    @db.Text

  syncPropertyIds Int[]                      @default([])

  organization Organization @relation(...)
  syncRuns     BuildiumSyncRun[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum BuildiumConnectionStatus {
  DISCONNECTED
  CONNECTED
  NEEDS_REAUTH
  ERROR
}

enum BuildiumEnvironment {
  PRODUCTION   // https://api.buildium.com
  SANDBOX      // https://apisandbox.buildium.com
}
```

Per-org credentials (not global env vars) for multi-tenant SaaS.

### 2.2 External ID fields on core entities (Phase 2+)

| Model | New field | Notes |
|-------|-----------|-------|
| `Property` | `buildiumPropertyId Int?` | `@@unique([organizationId, buildiumPropertyId])` |
| `Unit` | `buildiumUnitId Int?` | `@@unique([organizationId, buildiumUnitId])` |
| `Tenancy` | `buildiumLeaseId Int?` | `@@unique([organizationId, buildiumLeaseId])` |
| `TenancyContact` | `buildiumTenantId Int?` | Multiple contacts may map to one Buildium tenant |

Per-entity sync metadata: `buildiumLastSyncedAt`, `buildiumSyncStatus`, `buildiumSyncError`, `sourceSystem`.

```prisma
enum BuildiumSyncStatus {
  NEVER_SYNCED
  SYNCED
  PARTIAL
  ERROR
  STALE
}
```

### 2.3 `TenancyBuildiumSnapshot` (Phase 4)

Read-only accounting mirror — **never** write Buildium values into `Tenancy.monthlyRent` unless staff explicitly opts in (future phase).

| Field | Source |
|-------|--------|
| `monthlyRent` | Rent schedule |
| `rentDueDay` | `PaymentDueDay` / schedule |
| `securityDepositAmount` | `AccountDetails.SecurityDeposit` |
| `petDepositAmount` | TBD — see blockers |
| `balanceOwing` | Outstanding balances |
| `lastPaymentDate` / `lastPaymentAmount` | Latest Payment transaction |
| `leaseStartDate` / `leaseEndDate` | Lease record |
| `lastSyncedAt`, `syncStatus`, `syncError`, `sourceSystem` | Sync metadata |

### 2.4 `BuildiumEntityLink` (Phase 2+)

Reconciliation staging: `entityType`, `rocketEntityId?`, `buildiumEntityId`, `linkStatus`, `matchMethod`, `matchScore`, labels, reviewer fields.

### 2.5 `BuildiumSyncRun` + `BuildiumSyncLogEntry` (Phase 2+)

Sync history: scope, status, summary JSON, per-entry log lines.

---

## 3. API architecture

### 3.1 Server-only Buildium client

```
lib/integrations/buildium/
  client.ts           # HTTP wrapper, auth headers, pagination, read-only guard
  types.ts            # Response DTOs
  errors.ts           # BuildiumApiError, rate limit, auth failures
  pagination.ts       # limit/offset, X-Total-Count
  endpoints/
    rentals.ts
    leases.ts
    tenants.ts
    transactions.ts
  sync/               # Phase 2+
  index.ts
```

**Authentication:**

| Header | Value |
|--------|-------|
| `x-buildium-client-id` | API key client ID |
| `x-buildium-client-secret` | API key secret |

Server-to-server only — Buildium does not support CORS/browser calls.

**Base URLs:**

| Environment | URL |
|-------------|-----|
| Production | `https://api.buildium.com` |
| Sandbox | `https://apisandbox.buildium.com` |

All paths versioned: `/v1/...`

### 3.2 Environment variables

```bash
# Read-only guard (default true — no POST/PUT/PATCH/DELETE)
BUILDIUM_READ_ONLY="true"

# Optional dev/sandbox platform defaults (multi-tenant uses DB credentials)
BUILDIUM_BASE_URL="https://apisandbox.buildium.com"

# Secret encryption — reuse existing Gmail key in Phase 1 (see §12)
GMAIL_TOKEN_ENCRYPTION_KEY=""
```

Production: per-org secrets in `BuildiumConnection.clientSecretEnc`; Vercel holds encryption key only.

### 3.3 Client behavior

| Concern | Implementation |
|---------|----------------|
| Read-only | `BUILDIUM_READ_ONLY=true` default; client exposes GET only |
| Retry | Exponential backoff on 429, 502, 503 (~200ms initial) |
| Rate limit | 10 req/s concurrent; semaphore max 8 in-flight |
| Pagination | `limit` (max 1000) + `offset`; `X-Total-Count`; `orderby=Id asc` |
| Logging | Endpoint, status, duration, counts — never secrets or full PII |
| Timeouts | 30s per request |

### 3.4 Internal API surface

Server Actions (staff):

| Action | Purpose |
|--------|---------|
| `saveBuildiumCredentialsAction` | Store encrypted credentials |
| `testBuildiumConnectionAction` | `GET /v1/rentals?limit=1` |
| `triggerBuildiumSyncAction` | Enqueue job (Phase 2+) |
| `confirmBuildiumLinkAction` | Confirm mapping (Phase 3+) |

Gmail OAuth uses `app/api/integrations/gmail/*`; Buildium needs **no OAuth routes** — credentials via server actions only.

---

## 4. Sync strategy

### Principles

1. Read-only — no mutating HTTP methods to Buildium.
2. Explicit mapping — never auto-link leases without confirmation.
3. Snapshot, don't overwrite — accounting → `TenancyBuildiumSnapshot`.
4. Idempotent jobs via `BackgroundJob.idempotencyKey`.
5. Incremental where supported (`lastupdatedfrom` on leases/tenants).

### Sync order

1. Properties → `GET /v1/rentals`
2. Units → `GET /v1/rentals/units`
3. Leases → `GET /v1/leases`
4. Tenants → `GET /v1/leases/tenants`
5. Accounting (linked leases only):
   - Rent schedules → `GET /v1/leases/{leaseId}/rent`
   - Balances → `GET /v1/leases/outstandingbalances`
   - Last payment → `GET /v1/leases/{leaseId}/transactions?transactiontypes=Payment`

### Matching heuristics (suggestions only)

| Entity | Signals |
|--------|---------|
| Property | Normalized address; name fuzzy match |
| Unit | Unit number within linked property |
| Lease | Unit + date overlap; tenant email |
| Contact | Email exact match |

**Never auto-confirm leases in MVP.**

---

## 5. UI plan

### Route (confirmed)

| Route | Label | Access |
|-------|-------|--------|
| **`/settings/integrations/buildium`** | Buildium | Org ADMIN/OWNER |
| `/settings/integrations/buildium/reconciliation` | Mapping | ADMIN (Phase 5) |
| `/settings/integrations/buildium/sync-log` | Sync history | ADMIN (Phase 2+) |

**Rationale:** No `/settings` tree exists today (`/organization`, `/briefing/settings` are module-scoped). A dedicated integrations hub scales for future connectors. Retire disabled nav stub `/modules/finance` → redirect to settings route when enabled.

**Files (Phase 1):**

- `app/(dashboard)/settings/integrations/buildium/page.tsx`
- `app/(dashboard)/settings/integrations/buildium/actions.ts`

### Admin page (Phase 1)

- Connection status card
- Environment: Production / Sandbox
- Client ID + Client Secret inputs (secret write-only)
- Test connection button
- Last tested timestamp

### Later phases

- Manual sync button + scope checkboxes
- Sync log table
- Reconciliation tabs (properties, units, leases, tenants, unmatched)
- **Buildium Accounting Snapshot** card on tenancy detail (`/leasing/tenancies/[id]`)

### Access control

| Role | Access |
|------|--------|
| ADMIN/OWNER | Full integration settings, sync, reconciliation |
| Property manager | Snapshot cards on assigned properties only |
| Field agent / tenant portal | No Buildium data |

Use `hasOrgWidePropertyRights` / `requireOrganizationAdmin()` — org admin is `ADMIN`/`OWNER` membership, not `RoleKey.property_manager`.

---

## 6. Security and compliance

| Requirement | Approach |
|-------------|----------|
| Secret storage | `encryptSecret()` / `decryptSecret()` from `lib/crypto/token-vault.ts` |
| Read-only API key | Create GET-only key in Buildium Developer Tools |
| Access control | Org ADMIN/OWNER for settings; property-scoped read for PMs |
| Audit | `AuditLog` for connect, test, sync, link actions |
| Sensitive data | Snapshot summary on tenancy page only — no full ledger in list views |
| Tenant portal | No Buildium balances in portal |
| Read-only mode | `BUILDIUM_READ_ONLY=true` enforced in client |

---

## 7. Buildium API endpoint research

### Access requirements

| Requirement | Detail |
|-------------|--------|
| Plan | Buildium **Premium** (~$400/mo) |
| Enable | Settings → Application Settings → API Settings |
| Keys | Settings → Developer Tools → Create API Key |
| Sandbox | Developer Tools → Manage sandbox → `https://apisandbox.buildium.com` |
| Auth | `x-buildium-client-id` + `x-buildium-client-secret` headers |
| Rate limit | 10 concurrent req/s; 429 → retry ~200ms |
| Pagination | `limit`, `offset`, `X-Total-Count`, `orderby=Id asc` |

Docs: [Buildium Developer Portal](https://developer.buildium.com/docs), [Help: Open API](https://help.buildium.com/hc/s/article/Buildium-Open-API)

### MVP GET endpoints

#### Properties and units

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/v1/rentals` | Rentals > Properties — View |
| GET | `/v1/rentals/{propertyId}` | Rentals > Properties — View |
| GET | `/v1/rentals/units` | Rentals > Units — View |
| GET | `/v1/rentals/units/{unitId}` | Rentals > Units — View |

Filters: `propertyids`, `lastupdatedfrom`, `lastupdatedto`

#### Leases

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/v1/leases` | Rentals > Leases — View |
| GET | `/v1/leases/{leaseId}` | Rentals > Leases — View |
| GET | `/v1/leases/{leaseId}/rent` | Rentals > Lease transactions — View |
| GET | `/v1/leases/outstandingbalances` | Rentals > Outstanding Balances — View |

Key fields: `AccountDetails.SecurityDeposit`, `AccountDetails.Rent`, `PaymentDueDay`, `LeaseFromDate`, `LeaseToDate`, `CurrentTenants[]`

#### Tenants

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/v1/leases/tenants` | Rentals > Tenants — View |
| GET | `/v1/leases/tenants/{tenantId}` | Rentals > Tenants — View |

#### Ledger

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/v1/leases/{leaseId}/transactions` | Rentals > Lease transactions — View |
| GET | `/v1/leases/{leaseId}/recurringtransactions` | Rentals > Lease transactions — View |

Filter payments: `transactiontypes=Payment`, `orderby=Date desc`, `limit=1`

#### Deposits (read)

- `AccountDetails.SecurityDeposit` on lease
- Transactions: `Deposit`, `ApplyDeposit` types
- Deposit withholding: POST only (`/v1/leases/{leaseId}/applieddeposits`) — **excluded**

#### Excluded (write-first mode)

All POST, PUT, PATCH, DELETE across rentals, leases, tenants, transactions.

---

## 8. Unknowns and blockers

| # | Item | Mitigation |
|---|------|------------|
| 1 | Premium plan required | Confirm subscription before Phase 1 dev |
| 2 | Pet deposit not explicit in `AccountDetails` | Show "—" in MVP; parse recurring charges later |
| 3 | No GET for deposit withholdings | Derive from transaction history |
| 4 | Zero-balance leases omitted from outstanding balances | Default `balanceOwing = 0` when linked but absent |
| 5 | Multiple rent schedules | Use active schedule (latest/no EndDate) |
| 6 | Currency (USD vs CAD) | Store decimals as returned; no conversion |
| 7 | Briefing `RENT_PAYMENT` / `DEPOSIT` | Phase 6 — snapshot as source |
| 8 | `lib/crypto/token-vault.ts` frozen | Consume existing API; generalize in separate PR (§12) |

---

## 9. MVP phases

### Phase 1: Credentials + test connection

**Goal:** Prove API access from Vercel. **First code PR after explicit Phase 1 approval.**

- Schema: `BuildiumConnection` + enums only
- Server-only read-only client
- Settings page at `/settings/integrations/buildium`
- Test connection (`GET /v1/rentals?limit=1`)
- Audit log on connect/test

**Exit criteria:** Test connection returns 200; property count shown in UI.

### Phase 2: Import properties and units

- External IDs on `Property`, `Unit`
- `BuildiumEntityLink`, sync orchestrator, manual sync, sync log

### Phase 3: Link tenancies to Buildium leases

- `buildiumLeaseId`, reconciliation UI, tenant contact linking

### Phase 4: Sync rent/deposit/payment snapshot

- `TenancyBuildiumSnapshot`, accounting sync, tenancy detail card

### Phase 5: Admin reconciliation UI

- Full mapping workflow, unmatched queues, bulk confirm

### Phase 6: Scheduled sync and alerts (optional)

- Nightly cron, stale indicators, briefing source wiring

---

## 10. Suggested PR breakdown

| PR | Scope | Phase |
|----|-------|-------|
| PR-B0 | This doc | — |
| PR-B1 | `BuildiumConnection` schema + migration | 1 |
| PR-B2 | Read-only HTTP client + test connection service | 1 |
| PR-B3 | Settings page + server actions + nav | 1 |
| PR-B4 | External IDs + `BuildiumEntityLink` | 2 |
| PR-B5 | Property/unit sync + manual sync job | 2 |
| PR-B6 | Reconciliation UI (properties/units) | 2 |
| PR-B7 | Lease/tenant fetch + lease linking UI | 3 |
| PR-B8 | `TenancyBuildiumSnapshot` + accounting sync | 4 |
| PR-B9 | Tenancy detail snapshot card | 4 |
| PR-B10 | Sync log + reconciliation polish | 5 |
| PR-B11 | Scheduled sync cron | 6 |

---

## 11. Repo inspection notes (2026-06-26)

Findings from codebase review after plan approval:

### No naming conflicts

- `BuildiumConnection`, `buildiumPropertyId`, etc. do **not** exist in schema yet.
- `BuildiumEntityLink` / `TenancyBuildiumSnapshot` are unused names.

### Existing related names (compatible)

| Name | Location | Notes |
|------|----------|-------|
| `buildiumResidentCenterUrl` | `Tenancy` | Keep — manual resident center link |
| `BriefingSourceType.RENT_PAYMENT`, `DEPOSIT` | `prisma/schema.prisma` | Future briefing integration |
| `/modules/finance` | `config/navigation.ts` | Disabled stub — redirect or replace when enabling Buildium nav |
| `app/api/integrations/gmail/*` | OAuth only | No conflict; Buildium uses server actions |

### Route location

- **`/settings/integrations/buildium` is available** — no existing route or folder under `app/(dashboard)/settings/`.
- Precedent: module-scoped settings (`/briefing/settings`) vs new cross-module hub (`/settings/integrations/*`). Integrations hub is the right choice for Buildium + future connectors.
- Gmail remains at `/email` (connect link to API route); Buildium is self-contained under settings.

### Frozen modules

Per `docs/next-pr-migration-order.md`, **`lib/crypto/token-vault.ts` is frozen**. Phase 1 must **import** `encryptSecret` / `decryptSecret` without modifying that file. See §12.

### Auth terminology

- Org admin = `OrganizationMembershipRole.ADMIN` or `OWNER` (`hasOrgWidePropertyRights`).
- `property_manager` is a **staff RoleKey** on property assignments — not org admin. Integration settings remain ADMIN-only.

### Job framework

- Reuse `BackgroundJob` + `lib/jobs/enqueue.ts` pattern from Gmail/briefing.
- Phase 1 does **not** need background jobs (test connection is synchronous).

---

## 12. Secret vault recommendation

### Phase 1: Reuse Gmail token vault as-is

**Recommendation:** Call existing `encryptSecret()` / `decryptSecret()` from `lib/crypto/token-vault.ts` with the same `GMAIL_TOKEN_ENCRYPTION_KEY`. Store ciphertext in `BuildiumConnection.clientSecretEnc`.

**Why:**

- Same AES-256-GCM implementation already in production for Gmail.
- No changes to frozen `token-vault.ts` in Phase 1.
- One encryption key to manage in Vercel (`GMAIL_TOKEN_ENCRYPTION_KEY` already documented in `docs/deployment-checklist.md`).

**Phase 1 wrapper (new file, does not touch frozen vault):**

```typescript
// lib/integrations/buildium/secret-storage.ts
import { assertTokenVaultReadyForConnect, encryptSecret, decryptSecret } from "@/lib/crypto/token-vault";

export function assertBuildiumVaultReady(): void {
  assertTokenVaultReadyForConnect(); // same production gate
}

export function encryptBuildiumSecret(plaintext: string): string {
  return encryptSecret(plaintext);
}

export function decryptBuildiumSecret(payload: string): string {
  return decryptSecret(payload);
}
```

Error messages will say "Gmail" until vault is generalized — acceptable for Phase 1 internal dev; document in UI copy.

### Future (post un-freeze): Generic integration secret vault

When `lib/crypto/token-vault.ts` is un-frozen, refactor to:

| Change | Detail |
|--------|--------|
| Env var | `INTEGRATION_ENCRYPTION_KEY` with fallback to `GMAIL_TOKEN_ENCRYPTION_KEY` |
| Rename helpers | `assertIntegrationVaultReady()`, keep Gmail imports as re-exports |
| Dev flag | `ALLOW_INSECURE_INTEGRATION_SECRET_STORAGE` alias for Gmail dev flag |
| Health check | `app/api/health/route.ts` → `integrationEncryptionConfigured` |

**Do not** introduce `BUILDIUM_TOKEN_ENCRYPTION_KEY` — one platform key for all integration secrets.

---

## 13. Phase 1 implementation checklist

> **Gate:** Do not start until user explicitly approves Phase 1 implementation.

### Pre-flight (human)

- [ ] Confirm Buildium Premium + API enabled (or sandbox active)
- [ ] Create **read-only** API key in Buildium Developer Tools
- [ ] Record sandbox vs production decision for first deploy
- [ ] Add `BUILDIUM_READ_ONLY=true` to Vercel env (all environments)

### PR-B1 — Schema

- [ ] Add `BuildiumConnectionStatus`, `BuildiumEnvironment`, `BuildiumSyncStatus` enums
- [ ] Add `BuildiumConnection` model with `organizationId @unique`
- [ ] Wire `Organization.buildiumConnection` relation
- [ ] Migration SQL via `prisma migrate dev`
- [ ] **Do not** add external ID columns or snapshot tables yet

### PR-B2 — Read-only client

- [ ] `lib/integrations/buildium/client.ts` — fetch wrapper, headers, base URL from connection environment
- [ ] `lib/integrations/buildium/errors.ts` — typed errors, 401/403/429 handling
- [ ] `lib/integrations/buildium/pagination.ts` — optional helper (test uses limit=1 only)
- [ ] `BUILDIUM_READ_ONLY` guard — throw if non-GET attempted
- [ ] `lib/integrations/buildium/endpoints/rentals.ts` — `listRentals({ limit, offset })`
- [ ] `lib/integrations/buildium/secret-storage.ts` — vault wrapper (§12)
- [ ] `lib/integrations/buildium/test-connection.ts` — returns `{ ok, propertyCount?, error? }`
- [ ] Unit tests: error mapping, read-only guard (mock fetch)
- [ ] **No** sync orchestrator, **no** write endpoints

### PR-B3 — Settings UI

- [ ] `app/(dashboard)/settings/integrations/buildium/page.tsx`
- [ ] `app/(dashboard)/settings/integrations/buildium/actions.ts`
  - [ ] `saveBuildiumCredentialsAction` — ADMIN gate, encrypt secret, upsert connection
  - [ ] `testBuildiumConnectionAction` — decrypt secret server-side, call test-connection
  - [ ] `disconnectBuildiumAction` — clear secret, set DISCONNECTED (optional Phase 1)
- [ ] Connection status card (connected / disconnected / error / needs reauth)
- [ ] Environment selector (production vs sandbox)
- [ ] Client ID field; client secret field (password input, never echo back)
- [ ] "Test connection" button → show success + sample count or error message
- [ ] `AuditLog` entries: `buildium.credentials.saved`, `buildium.connection.tested`
- [ ] Nav: add Integrations → Buildium under `system` section, `minimumRole: "ADMIN"`
- [ ] Redirect `/modules/finance` → `/settings/integrations/buildium` (optional, same PR)
- [ ] Update `.env.example` with `BUILDIUM_READ_ONLY` comment block
- [ ] Update `docs/deployment-checklist.md` — note Buildium reuses `GMAIL_TOKEN_ENCRYPTION_KEY`

### Phase 1 smoke test

- [ ] ADMIN user opens `/settings/integrations/buildium`
- [ ] Save sandbox credentials → status Connected
- [ ] Test connection → 200, property count displayed
- [ ] Invalid secret → NEEDS_REAUTH or ERROR, no secret in logs
- [ ] Non-admin user → 403 / forbidden on actions
- [ ] Production: verify `GMAIL_TOKEN_ENCRYPTION_KEY` set before saving credentials

### Explicitly out of Phase 1 scope

- Property/unit/lease sync
- External ID columns
- `TenancyBuildiumSnapshot`
- Reconciliation UI
- Background jobs / cron
- Tenancy detail snapshot card
- Briefing source wiring
- Modifications to `lib/crypto/token-vault.ts`
- Any POST/PUT/PATCH/DELETE to Buildium API

---

## 14. Pre-implementation decisions (resolved)

| Decision | Resolution |
|----------|------------|
| Read-first | Yes — enforced via `BUILDIUM_READ_ONLY` + GET-only client |
| Route | **`/settings/integrations/buildium`** |
| Overwrite policy | Operational `Tenancy` fields untouched; accounting in snapshot (Phase 4+) |
| Credentials storage | Per-org in `BuildiumConnection`; encryption via existing token vault |
| Pet deposit MVP | Show "—" if API unclear |
| First code PR | **Phase 1 only** (PR-B1 + B2 + B3, or B1 then B2+B3) |

---

## References

- [Buildium Developer Portal](https://developer.buildium.com/docs)
- [Buildium Open API Help](https://help.buildium.com/hc/s/article/Buildium-Open-API)
- Internal: `docs/daily-briefing-integration-plan.md`, `docs/auth.md`, `docs/next-pr-migration-order.md`
