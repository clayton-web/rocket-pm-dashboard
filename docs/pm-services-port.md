# PM domain services port (PR 8)

Donor source: `pm-tenant-centre` → `src/lib/services/*`  
Dashboard target: `lib/services/*`

Services are **framework-agnostic**: first argument is `PrismaClient` (pass `prisma` from `@/lib/db/prisma`). Staff authorization uses {@link StaffContext} loaded via `loadStaffContext(userId, organizationId)` — not donor HMAC cookies.

## Ported (ready to wire to API/routes)

| Service file | Domain | Public (no staff) entry points |
|--------------|--------|------------------------------|
| `activityLog.service.ts` | Audit trail helpers | `logActivity`, `logStaffActivity`, `logPropertyActivity` |
| `property.service.ts` | Properties | — |
| `unit.service.ts` | Units | — |
| `propertyAssignment.service.ts` | Staff ↔ property roles | — |
| `prospect.service.ts` | Leasing prospects | `createPublicProspect` |
| `showing.service.ts` | Showings | — |
| `application.service.ts` | Rental applications | `startPublicApplication`, `updateDraftApplication`, `submitApplication`, `getDraftApplicationForPublic`, `maybeLinkProspectForDraftApplication` |
| `applicationDocument.service.ts` | Application uploads (metadata) | — |
| `tenancy.service.ts` | Tenancies | — |
| `tenancyContact.service.ts` | Tenancy contacts | — |
| `document.service.ts` | Property documents (metadata) | — |
| `signatureRequest.service.ts` | E-sign requests | — |
| `checklist.service.ts` | Move-in / ops checklists | — |
| `clientProfile.service.ts` | Former-tenant CRM profiles | `buildClientProfileCreateDataFromArchivedTenancy` (helper for future retention) |
| `notice.service.ts` | Tenancy notices | — |

Supporting modules:

- `staff-context.ts` — `StaffContext`, `loadStaffContext`
- `property-access.ts` — org/property scoping (dashboard `ADMIN` / `MEMBER` / `OWNER`)
- `errors.ts` — `NotFoundError`, `ForbiddenError`

## Intentionally skipped

| Donor file | Reason |
|------------|--------|
| `../maintenance` (donor index export) | Maintenance runtime lives in `lib/maintenance/*` (PR 7, Prisma SoT) |
| `retention.service.ts` | Purge worker + retention workflow deferred; depends on ported `clientProfile` helper only |
| Donor `src/lib/auth/*` HMAC staff session | PR 9 — NextAuth unification |
| Donor route handlers (`src/app/api/*`) | No UI/API in PR 8 |
| Supabase clients / maintenance Supabase services | Not on Path A |

## Wiring notes (later PRs)

1. Route handlers should `auth()` → `getActiveOrganizationContext()` → `loadStaffContext(prisma, userId, orgId)`.
2. Public routes call services without `StaffContext` (prospect/application create paths).
3. `lib/maintenance/activity.ts` remains minimal for maintenance; domain services use `activityLog.service.ts` for property/leasing/ops entities.
4. File upload routes still need storage integration; document/applicationDocument services accept `storageKey` metadata only.

## Gmail / AI

PR 8 does not modify `lib/gmail/**`, `lib/ai/**`, inbox, or token vault.
