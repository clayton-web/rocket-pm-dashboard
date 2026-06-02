# Unified Prisma schema merge plan (Path A)

**Status:** Proposed — not applied yet.  
**Base repo:** `rocket-pm-dashboard` (`Clay's Dashboard`)  
**Donor repo:** `pm-tenant-centre` (`pm tenant centre`)  
**Rule:** One schema, one PostgreSQL database. No Supabase maintenance SoT.

---

## 1. Principles

- **Expand-only** migrations on the dashboard database; do not drop Gmail/AI tables.
- Keep dashboard email/AI models **unchanged** in shape during Phase A merge (only add FKs to `Organization` where needed).
- **Do not** port donor `@@map("maintenance_requests")` Prisma model as-is; replace with a **new unified** maintenance model (see §8).
- **Frozen until merge PR:** `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, inbox routes, token vault (behavior must stay compatible).

---

## 2. User model merge

| Field / concept | Dashboard (keep) | Donor (add) | Unified decision |
|-----------------|-------------------|-------------|------------------|
| `id`, `email` | `email` optional unique | `email` required unique | **`email` required**; migrate null emails before NOT NULL |
| Display name | `name` | `firstName`, `lastName` | Keep **`name`** + add **`firstName`**, **`lastName`** (app fills `name` from parts) |
| Avatar | `image` | — | Keep **`image`** |
| OAuth | `emailVerified` | `emailVerifiedAt` | Keep **`emailVerified`** (alias in app if needed) |
| Staff password | — | `passwordHash` | **Add `passwordHash`** (nullable until staff auth port) |
| Active flag | — | `isActive` | **Add `isActive`** default `true` |
| Platform operator | `platformAccessLevel` | — | **Keep `PlatformAccessLevel`** on `User` (Rocket Logic only) |
| Staff role | — | `primaryRoleId` → `Role` | **Add `primaryRoleId`** (nullable for assignment-only staff) |
| Relations | Gmail, AI, audit | Properties, showings, applications, activity | **Union** all relations |

**Do not port:** separate donor-only session tables (staff uses NextAuth JWT + future credentials).

---

## 3. Organization model merge

| Field | Dashboard | Donor | Unified |
|-------|-----------|-------|---------|
| `id`, `name` | yes | yes | yes |
| `slug` | required `@unique` | optional `@unique` | **`slug` required `@unique`** (backfill from donor) |
| Relations | email, AI, audit | properties, memberships | **Union** |

Add donor-side relations on `Organization`:

- `properties Property[]`
- (all child entities hang off `Property` / org-scoped rows with `organizationId` where needed)

Keep dashboard relations:

- `connectedEmailAccounts`, `emailThreads`, `emailMessages`, `knowledgeSources`, `responderRules`, `styleExamples`, `draftResponses`, `auditLogs`

**Table naming:** Dashboard uses default Prisma table names (`Organization`). Donor uses `@@map("organizations")`. **Pick dashboard PascalCase tables** for new models unless a collision forces `@@map` (document in migration PR).

---

## 4. OrganizationMembership role merge

| Dashboard | Donor |
|-----------|-------|
| `OrganizationRole`: `ORG_ADMIN`, `PROPERTY_MANAGER` | `OrganizationMembershipRole`: `owner`, `admin`, `member` |

**Unified enum (proposed):** `OrganizationMembershipRole`

| Value | Meaning |
|-------|---------|
| `ADMIN` | Org-wide admin (maps dashboard `ORG_ADMIN`, donor `admin`) |
| `MEMBER` | Org member without org-wide admin (maps dashboard `PROPERTY_MANAGER`, donor `member`) |
| `OWNER` | **Reserved** — future SaaS/billing owner; **not** Rocket Logic operator |

**Rocket Logic operator:** stays on `User.platformAccessLevel = OPERATOR` (not org membership `OWNER`).

**Migration mapping:**

- `ORG_ADMIN` → `ADMIN`
- `PROPERTY_MANAGER` → `MEMBER`
- donor `admin` → `ADMIN`
- donor `member` → `MEMBER`
- donor `owner` → `OWNER` (seed none until product needs it)

Update `lib/permissions/require-org-access.ts` and seed in a **follow-up PR** (not frozen Gmail code).

---

## 5. Role / RoleKey approach

**Port from donor:**

- `Role` table seeded with `RoleKey`: `administrator`, `property_manager`, `field_agent`, `tenant`
- `UserPropertyAssignment` (user + property + role)

**Interaction with org membership:**

- **Org `ADMIN`:** org-wide property access (donor `hasOrgWidePropertyRights`)
- **Org `MEMBER`:** access via `UserPropertyAssignment` only
- **`primaryRoleId`:** optional; `administrator` for global staff type; tenants use `tenant` when portal auth ships
- **`OPERATOR`:** `User.platformAccessLevel` bypasses membership (dashboard behavior)

**Do not port:** using `RoleKey.administrator` as a global superuser (donor explicitly avoids this).

---

## 6. Property and Unit (add from donor)

Port **`Property`** and **`Unit`** verbatim (fields, indexes, `organizationId` on `Property`).

- Enforce `Property.organizationId` on all org-scoped queries.
- Link future `EmailThread.contextLinks` to `property` / `tenancy` ids (JSON already exists on dashboard).

**Add on `Organization`:** `properties Property[]`.

---

## 7. Prospect / Showing / Application (add from donor)

Port models and enums:

- `Prospect`, `ProspectStatus`
- `Showing`, `ShowingStatus`, `ShowingOutcome`, `ContactStatus`
- `Application`, `ApplicationStatus`
- `ApplicationDocument`

Keep donor integrity rules in services (consent fields, `propertyId`/`unitId` sync).

**Defer UI port** to later PRs; schema-only in first merge phase.

---

## 8. Tenancy / TenancyContact (add from donor)

Port:

- `Tenancy`, `TenancyStatus`, `RetentionStatus`
- `TenancyContact`, `TenancyContactType`

`Tenancy.applicationId` stays `@unique` (one tenancy per application).

**Portal:** `TenancyContact.portalAccessEnabled` + `email` linkage for future tenant auth.

---

## 9. Document / Notice / SignatureRequest (add from donor)

Port:

- `Document` (general files; `storageKey` + object storage)
- `Notice`
- `SignatureRequest`, `SignatureRequestStatus`
- `Checklist`, `ChecklistItem`, related enums

**Add `organizationId`** on `Document` / `Notice` if not present — donor scopes via `propertyId`; consider denormalized `organizationId` for org-wide queries (optional Phase A).

---

## 10. MaintenanceRequest — unified model (rewrite, do not copy donor Prisma row)

**Problem:** Donor live maintenance uses **Supabase** `maintenance_requests` (snake_case, workflow `new|dispatched|completed|cancelled`). Donor Prisma `MaintenanceRequest` maps the **same table name** with a **different shape** — must not merge blindly.

**Proposed single model:** `MaintenanceRequest` (new table name during migration: `maintenance_work_orders` or migrate in place after Supabase export)

| Group | Fields |
|-------|--------|
| **Scope** | `id`, `organizationId`, `propertyId`, `unitId`, `tenancyId`, `submittedByContactId?` |
| **Reporter** | `title`, `description`, `category?` |
| **Urgency** | `urgency` enum: `emergency`, `urgent`, `routine` |
| **Workflow** | `status` enum — **unify** donor Prisma + Supabase: e.g. `NEW`, `TRIAGED`, `DISPATCHED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| **Triage (from Supabase)** | `triageUrgency`, `triageTrade`, `triageSummary` (text), `guidedMeta` (Json) |
| **Assignment (future)** | `assignedToName?`, `vendorId?` (future FK) |
| **Timestamps** | `submittedAt`, `dispatchedAt`, `completedAt`, `updatedAt`, `createdAt` |
| **Legacy bridge** | optional `externalPropertyLabel?`, `tenantDisplayName?` only during Supabase import |

**Do not port:** Supabase client, public unauthenticated POST as long-term design (rewrite with tenant session).

---

## 11. MaintenanceAttachment (new)

Not in either repo today; add for product goal (photos/videos):

```prisma
model MaintenanceAttachment {
  id                   String   @id @default(cuid())
  maintenanceRequestId String
  organizationId       String   // denormalized for authz

  fileName     String
  contentType  String?
  sizeBytes    Int?
  storageKey   String   @unique
  kind         MaintenanceAttachmentKind // photo | video | other

  maintenanceRequest MaintenanceRequest @relation(...)
  organization       Organization       @relation(...)

  createdAt DateTime @default(now())
}
```

Storage: S3/R2; metadata only in Prisma.

---

## 12. ActivityLog vs AuditLog

| Log | Purpose | Decision |
|-----|---------|----------|
| **AuditLog** (dashboard) | Security/integration: Gmail connect, sync, AI draft, OAuth | **Keep** — append-only, `action` + `resourceType` |
| **ActivityLog** (donor) | Domain entity changes (tenancy, application, maintenance) | **Port** — `entityType` + `entityId` + `oldValues`/`newValues` |

**Phase A:** both tables.  
**Later:** optional unified `ActivityLog` with namespaces; not required for first merge.

---

## 13. What not to port (or defer)

| Item | Reason |
|------|--------|
| Supabase `maintenance_requests` runtime | Replaced by unified Prisma model |
| Donor Prisma `MaintenanceRequest` `@@map("maintenance_requests")` | Collision / wrong shape |
| `@supabase/ssr` dependency | Remove after maintenance rewrite |
| Staff HMAC cookies (`pm_staff_session`) | Replaced by NextAuth (later PR) |
| `x-pm-session-user-id` header auth | Dev-only bridge, delete after auth port |
| `@google/generative-ai` (donor triage) | Consolidate to `@google/genai` when porting triage |
| Donor `OrganizationMembershipRole.owner` as Rocket operator | Use `User.platformAccessLevel` |
| Mock maintenance fixtures / e2e scripts | Port selectively with tests |
| Full donor `src/routes/*` tree | Port incrementally, not in schema PR |
| Vendor management models | Greenfield — not in donor schema |
| Lease lifecycle automation tables | Greenfield — use `Notice` + jobs later |
| Rocket Inspection DB | External integration only |

---

## 14. Merge phases (schema-only order)

1. **Phase A1 — Identity:** `User` merge fields; `Role`, `RoleKey`; `OrganizationMembership` enum swap; keep Gmail models untouched.
2. **Phase A2 — Property graph:** `Property`, `Unit`, `UserPropertyAssignment`.
3. **Phase A3 — Leasing:** `Prospect`, `Showing`, `Application`, `ApplicationDocument`.
4. **Phase A4 — Tenancy:** `Tenancy`, `TenancyContact`, `Notice`.
5. **Phase A5 — Documents & signing:** `Document`, `SignatureRequest`, `Checklist*`, `ClientProfile`.
6. **Phase A6 — Maintenance:** new unified `MaintenanceRequest` + `MaintenanceAttachment` (new table); **no** Supabase.
7. **Phase A7 — ActivityLog** + `Organization` relation backfills.

Each phase: one Prisma migration, `prisma generate`, build, **no changes** to `lib/gmail/**` or `generate-responder-draft.ts`.

---

## 15. Seed / data migration notes

- Merge seeds: one Axford org (`slug: axford`), admin + PM users with `passwordHash` optional.
- Donor Supabase rows: one-time ETL script in maintenance port PR (not schema PR).
- Dashboard Gmail tokens: **untouched** in schema merge.

---

*Next implementation steps after stabilization PR: see `docs/next-pr-migration-order.md`.*
