# Tenant portal MVP (PR 11)

Public routes under `/portal/*` bypass staff NextAuth middleware. They are scoped to the organization in `MAINTENANCE_PUBLIC_ORG_SLUG` (default `axford`).

## Routes

| Route | Purpose |
|-------|---------|
| `/portal` | Entry hub — links to maintenance, status, documents |
| `/portal/maintenance/new` | Submit maintenance (existing; PR 11 adds confirmation links) |
| `/portal/maintenance/status` | Lookup status by reference + email |
| `/portal/documents` | Placeholder — no public document listing |

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

## Deferred (future tenant auth)

- NextAuth (or magic link) for `TenancyContact` / tenant role
- Signed-in document list filtered by tenancy
- Maintenance history for logged-in tenant without re-entering reference
- Rate limiting / CAPTCHA on public lookup
- `tenantVisibleNote` on `MaintenanceRequest` for PM → tenant messages

## Staff vs tenant

| Area | Staff (`/maintenance`, `/inbox`) | Tenant (`/portal`) |
|------|----------------------------------|---------------------|
| Auth | NextAuth required | None (lookup gated by email) |
| Maintenance | Full queue + workflow | Submit + limited status |
| Documents | Future staff UI | Placeholder |

## Regression

- Do not change `lib/gmail/**`, `lib/ai/generate-responder-draft.ts`, or inbox Gmail draft load for portal work.
