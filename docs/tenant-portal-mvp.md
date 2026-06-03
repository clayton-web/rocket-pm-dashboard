# Tenant portal MVP (PR 11)

Public routes under `/portal/*` bypass staff NextAuth middleware. They are scoped to the organization in `MAINTENANCE_PUBLIC_ORG_SLUG` (default `axford`).

## Routes

| Route | Purpose |
|-------|---------|
| `/portal` | Entry hub — links to maintenance, status, documents |
| `/portal/maintenance/new` | Submit maintenance (existing; PR 11 adds confirmation links) |
| `/portal/maintenance/status` | Lookup status by reference + email |
| `/portal/documents` | Placeholder — no public document listing |
| `/portal/maintenance` | Signed-in list (tenant session; PR 3) |
| `/portal/maintenance/[requestId]` | Signed-in detail (PR 3) |
| `/portal/dashboard` | Signed-in home (PR 2/3) |

## API (public)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/portal/maintenance/lookup` | Status lookup `{ requestId, email }` |
| GET | `/api/maintenance/submit-options` | Tenancy picker for intake (unchanged) |
| POST | `/api/maintenance` | Create request (unchanged) |

There is **no** public list endpoint for maintenance, tenancies, or documents.

## Safe maintenance status lookup

1. Tenant provides **reference id** (cuid returned on submit) and **email**.
2. Server loads the request only if it belongs to the public portal org.
3. Email must match (case-insensitive):
   - `submittedByContact.email`, or
   - any `TenancyContact.email` on the request’s tenancy.
4. Wrong id or wrong email → same `404` message (no enumeration of which failed).
5. Response includes only: title, friendly status label, urgency, trade, submitted/scheduled/completed dates.

**Never returned:** `description`, `triageSummary`, `completionNote`, `assignedVendorName`, property ids, storage keys, other org data.

There is no `tenantVisibleNote` field yet — staff notes stay internal until schema + staff UI add an explicit tenant-visible flag.

## Maintenance intake

- Tenancy must be chosen from server-validated submit options (active tenancy in public org).
- Success screen shows reference id + link to status page.
- Photo upload remains metadata-only in description text (no S3).

## Documents

Deferred until tenant auth:

- No lookup by email alone (would risk exposing lease metadata).
- `/portal/documents` shows “coming soon” only.
- `Document.storageKey` is never exposed on public routes.

## Tenant auth (Product PR 2)

- Email + one-time code for contacts with `portalAccessEnabled` — see [tenant-auth-mvp.md](./tenant-auth-mvp.md)
- Routes: `/portal/login`, `/portal/dashboard`, `/portal/logout`
- Public intake and reference lookup **unchanged**

## Signed-in maintenance (Product PR 3)

Requires tenant session ([tenant-auth-mvp.md](./tenant-auth-mvp.md)).

**Scoping** (`lib/portal/tenant-maintenance.ts`):

- `organizationId` = session `organizationId`
- AND (`tenancyId` = session `tenancyId` OR `submittedByContactId` = session `contactId`)

**Tenant-safe fields:** `id` (reference), `title`, friendly `statusLabel`, `urgency`, `trade`, `submittedAt`, `scheduledWorkAt`, `completedAt`.

**Hidden:** `description`, `triageSummary`, `guidedMeta`, `accessNotes`, `completionNote`, `assignedVendorName`, `assignedToUserId`, owner approval, invoice fields, property/unit ids, attachments.

Public `/portal/maintenance/status` and `POST /api/portal/maintenance/lookup` remain available.

## Still deferred

- Signed-in document list filtered by tenancy
- Photo attachments on tenant views
- Tenant comments / `tenantVisibleNote` on requests

## Staff vs tenant

| Area | Staff (`/maintenance`, `/inbox`) | Tenant (`/portal`) |
|------|----------------------------------|---------------------|
| Auth | NextAuth required | Optional tenant session; public intake/lookup unchanged |
| Maintenance | Full queue + workflow | Submit + public lookup + signed-in list/detail |
| Documents | Future staff UI | Placeholder |

## Regression

- Do not change `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, or inbox Gmail draft load for portal work.
