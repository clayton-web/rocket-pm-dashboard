# Next PRs after stabilization (Path A)

Assumes stabilization PR is merged: Gemini responder, Gmail draft load, `.env.example` + `DIRECT_URL`, docs in `docs/`.

**Frozen until explicitly un-frozen:** `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, `lib/ai/gemini-client.ts`, `lib/ai/assemble-responder-context.ts`, `lib/ai/load-retrieval.ts`, `lib/ai/bc-safety.ts`, `lib/crypto/token-vault.ts`, inbox pages/actions for Gmail/AI behavior.

---

## PR 2 — Schema merge Phase A1 (identity only)

**Objective:** Add donor identity fields without touching email/AI tables.

**Files to touch:**

- `prisma/schema.prisma`
- `prisma/migrations/*` (new migration)
- `prisma/seed.ts` (role seeds + membership enum mapping)
- `lib/permissions/require-org-access.ts` (enum rename)
- `lib/org/active-organization.ts` (if role type changes)
- `config/navigation.ts` / `lib/permissions/nav.ts` (if role checks change)

**Files not to touch:** `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, inbox thread actions except type fixes.

**Steps:**

1. Add `Role`, `RoleKey` enum, seed four roles.
2. Extend `User`: `passwordHash`, `firstName`, `lastName`, `isActive`, `primaryRoleId`.
3. Replace `OrganizationRole` with unified `OrganizationMembershipRole` + data migration SQL.
4. Run `prisma migrate dev`; verify build.
5. Smoke: login, org switch, inbox list (no Gmail code edits).

**Risk:** Medium — authz enum rename. Mitigate: grep `ORG_ADMIN` / `PROPERTY_MANAGER`.

---

## PR 3 — Schema merge Phase A2 (property graph)

**Objective:** `Property`, `Unit`, `UserPropertyAssignment` + `Organization.properties`.

**Files:** `prisma/schema.prisma`, migration, seed sample property for Axford.

**Not touch:** Gmail/AI libs.

**Steps:**

1. Add models from donor (adjust `@@map` to dashboard convention).
2. Seed one property + unit under Axford.
3. Build + lint.

**Risk:** Low (additive).

---

## PR 4 — Schema merge Phase A3–A4 (leasing + tenancy)

**Objective:** Prospect, Showing, Application, ApplicationDocument, Tenancy, TenancyContact, Notice.

**Files:** `prisma/schema.prisma`, migration, optional seed.

**Not touch:** Gmail/AI.

**Risk:** Low–medium (many enums). Mitigate: single migration, no service port yet.

---

## PR 5 — Schema merge Phase A5–A7 (documents, activity, org relations)

**Objective:** Document, SignatureRequest, Checklist*, ClientProfile, ActivityLog; wire `Organization` relations for email/AI children already present.

**Files:** `prisma/schema.prisma`, migration.

**Risk:** Low.

---

## PR 6 — Unified maintenance schema (no Supabase)

**Objective:** New `MaintenanceRequest` + `MaintenanceAttachment` tables per `docs/schema-merge-plan.md` §10–11.

**Files:** `prisma/schema.prisma`, migration, `docs/maintenance-unified.md` (runtime contract).

**Do not:** Import donor `@@map("maintenance_requests")` Prisma model.

**Risk:** High if same DB had Supabase table — use **new table name** first, ETL in PR 7.

---

## PR 7 — Port maintenance services + API (Prisma only)

**Objective:** Replace donor Supabase routes with Prisma; port `src/lib/maintenance/*` from donor into `lib/maintenance/`.

**Files (new/ported):** `lib/maintenance/**`, `app/api/maintenance/**` or server actions, `app/(portal)/maintenance/**`, `app/(dashboard)/maintenance/**`.

**Frozen:** Gmail/AI.

**Steps:**

1. ETL script: Supabase → unified table (one-time).
2. Port triage AI using shared `lib/ai/gemini-client.ts`.
3. Remove `@supabase/*` from `package.json`.

**Risk:** High — test portal create + manager queue.

---

## PR 8 — Port PM services (applications, tenancies)

**Objective:** Donor `lib/services/*` for core domain (no maintenance).

**Files:** `lib/services/**`, route handlers as needed.

**Risk:** Medium — property scoping.

---

## PR 9 — Staff auth unification

**Objective:** NextAuth Credentials + `passwordHash`; retire donor HMAC cookies.

**Files:** `auth.ts`, `middleware.ts`, manager login routes, remove header fallback in prod.

**Risk:** Medium — regression on inbox access. Mitigate: same session cookie path, test Gmail connect after login.

---

## PR 10 — AI ↔ property linking

**Objective:** Populate `EmailThread.contextLinks` from tenancy/property; optional admin UI.

**Files:** `lib/ai/context-builder.ts` (read-only enrichment), new small UI — **avoid** changing `generate-responder-draft.ts` prompt contract without version bump.

**Risk:** Low if additive.

---

## PR 11 — Tenant portal MVP

**Objective:** Authenticated portal: maintenance status, document list placeholder.

**Depends on:** PR 7, PR 9.

---

## Gmail/AI regression checklist (every PR)

- [ ] `npm run build` && `npm run lint`
- [ ] Connect Gmail (`/api/integrations/gmail/connect`)
- [ ] Manual sync (`/inbox` → Sync now)
- [ ] Open thread → Generate draft (with `GEMINI_API_KEY`)
- [ ] Load to Gmail Drafts
- [ ] Encrypted tokens still decrypt (`GMAIL_TOKEN_ENCRYPTION_KEY`)

---

*Schema detail: `docs/schema-merge-plan.md`.*
