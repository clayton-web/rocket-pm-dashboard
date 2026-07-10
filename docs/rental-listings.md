# Rental listings

Staff-managed advertisements for units. Separates three independent concepts:

1. **Operational Active** (`Property.isActive` / `Unit.isActive`) — record is available in the system
2. **Service relationship** (`Property.serviceRelationship`) — Axford’s business engagement
3. **Published listing** (`RentalListing.status = PUBLISHED`) — unit may appear on the public viewing page

## Service relationships

| Value | Staff label | Meaning |
|-------|-------------|---------|
| `MANAGED` | Property Management | Ongoing management |
| `PRE_MANAGEMENT` | Leasing, then Property Management | Leasing now; intend to manage after placement |
| `PLACEMENT_ONLY` | Tenant Placement Only | Advertise and place a tenant; not retained for ongoing management |

Existing properties migrate to `MANAGED` by default (they are already in the management portfolio).

Service relationship does **not** control public visibility. All three types may create and publish listings when the property and unit are operationally active.

### Listing attribution through the funnel

When a prospect submits from a **published** listing, `Prospect.rentalListingId` is stored (validated server-side: listing must be `PUBLISHED` and match property/unit). Applications inherit that id at start (explicit submit or linked prospect). Legacy fallback units may omit attribution (`null`) — never guess a historical listing.

**Repeat viewing requests:** open prospects match by property + email. Same listing (or both unattributed) updates the existing row. A **different** listing id creates a new open prospect so prior listing history is not overwritten. Archived prospects never match.

### Application → managed tenancy or placement completion

Policy helper: `getApplicationConversionPolicy` in `lib/leasing/application-conversion-policy.ts`.

| Relationship | Outcome | On success |
|--------------|---------|------------|
| `MANAGED` | Convert to managed `Tenancy` | Remains `MANAGED`; related listing closed |
| `PRE_MANAGEMENT` | Convert to managed `Tenancy` | Property → `MANAGED`; related listing closed |
| `PLACEMENT_ONLY` | Complete `TenantPlacement` | Stays `PLACEMENT_ONLY`; no tenancy/portal; related listing closed |

**Listing closure:** closes only the attributed listing, or the single open listing on the unit when attribution is missing. Multiple open listings without attribution require explicit staff selection. Already-closed listings are left alone. Closure runs in the same transaction as the outcome.

**Approval alone** does not change `serviceRelationship` or close listings.

Do **not** change service relationship merely to bypass the placement guard.

## Listing statuses

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable; not public |
| `PUBLISHED` | Publicly visible (when property and unit are also active) |
| `PAUSED` | Temporarily hidden; can republish or return to draft |
| `CLOSED` | Historical; retained; create a new draft to relist |

At most one **open** listing (`DRAFT` / `PUBLISHED` / `PAUSED`) per unit is enforced in the listing service.

## Staff workflow

1. Open `/properties/[propertyId]`
2. Confirm **Operational status**, **Service relationship**, and listing section
3. **List for rent** → edit → **Publish**
4. Pause / close / republish as needed

Org **ADMIN** / **OWNER** and assigned **property managers** may manage listings and service relationship. Field agents may view but not mutate.

## Public portal compatibility (temporary, per-unit)

`listPublicLeasingSubmitOptions()`:

1. Always returns **published** listings for `MAINTENANCE_PUBLIC_ORG_SLUG` (active property + unit).
2. When `RENTAL_LISTING_PUBLIC_FALLBACK` is enabled (default **on**), also returns active units that have **zero** `RentalListing` rows of any status.
3. Units with DRAFT, PUBLISHED, PAUSED, or CLOSED listing history **never** appear via legacy fallback.
4. Publishing one unit does **not** hide other untouched legacy units.

Env parsing: `true`/`1`/`yes` → on; `false`/`0`/`no` → off; unset/empty → on; other values → off.

## Active-tenancy publish rule

Publishing is blocked when the unit has a tenancy in: `pending_move_in`, `active`, `notice_received`, `move_out_scheduled`, `inspection_scheduled`, or `inspection_completed`. Statuses `ended` and `archived` do not block. Draft creation is always allowed. `serviceRelationship` alone never blocks publish.

## Deployment order

1. Apply Prisma migrations (`npx prisma migrate deploy`) **before** or as a blocking step before serving new app code.
2. Deploy application code (build runs `prisma generate` via `postinstall`).
3. Keep `RENTAL_LISTING_PUBLIC_FALLBACK` default-on until every advertised unit has a listing.
4. Verify with [leasing-smoke-test-runbook.md](./leasing-smoke-test-runbook.md).

Migrations in this release (apply in order):

1. `20260710000000_rental_listing_foundation`
2. `20260710010000_property_service_relationship`
3. `20260710020000_listing_attribution_and_tenant_placement`

**Do not** deploy new application code against a database that has not applied these migrations — Prisma will query missing columns/tables.

### Removing the public fallback later

1. Confirm every publicly advertised unit has a `RentalListing` (no reliance on legacy active units).
2. Set `RENTAL_LISTING_PUBLIC_FALLBACK=false` in production.
3. Smoke-test `/portal/viewing` and `/portal/application`.
4. After a stable period, remove the fallback code path in a follow-up PR.

## Deferred (next phases)

- Remove legacy fallback after full adoption
- Application invite tokens and transactional email
- Phone-first viewing, listing photos, showing calendar
- Placement fees / accounting
