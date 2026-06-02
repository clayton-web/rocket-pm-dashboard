# Staff authentication (Rocket PM Dashboard)

## Design (Path A / PR 9)

| Concern | Approach |
|---------|----------|
| Staff sessions | **NextAuth** JWT (`auth.ts`) — single system; no donor HMAC cookies |
| Sign-in page | `/login` — Google (optional) + email/password credentials |
| Org context | HTTP-only cookie `rocket_pm_active_org` (`lib/org/active-organization.ts`) |
| Domain authorization | `StaffContext` via `loadStaffContext` + `lib/services/property-access.ts` |
| Tenant portal | **Deferred** — public maintenance intake is unauthenticated; no tenant NextAuth yet |

## Credentials flow

1. User submits email + password on `/login`.
2. NextAuth **Credentials** provider calls `authorizeStaffCredentials` (`lib/auth/authorize-credentials.ts`).
3. Rules:
   - User must exist and `isActive === true`.
   - If `passwordHash` is set: password must verify (scrypt, `lib/auth/password.ts`). Works in all environments.
   - If `passwordHash` is null: sign-in allowed **only** when `DEV_CREDENTIALS_LOGIN=true` **and** password field is empty (legacy dev email-only).
4. JWT session stores `user.id` (`token.sub`).

## Google OAuth (optional)

- Enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (app sign-in, separate from Gmail mailbox OAuth).
- Upserts `User` by email; **blocks** sign-in when `isActive=false`.
- New Google users are created with `isActive: true`.

## Platform operators

- `User.platformAccessLevel = OPERATOR` — Rocket Logic cross-org access (not org `OWNER`).
- Operators use the same NextAuth session; org picker can select orgs without membership (`getActiveOrganizationContext`).

## Organization membership

- Enum: `ADMIN`, `MEMBER`, `OWNER` (reserved).
- `ADMIN` / `OWNER`: org-wide property access in the active org.
- `MEMBER`: access via `UserPropertyAssignment` only.

## Property assignments

- `Role` seeds: `administrator`, `property_manager`, `field_agent`, `tenant`.
- `User.primaryRoleId` — staff type; tenants use `tenant` when portal auth ships.
- `UserPropertyAssignment` — per-property `property_manager` / `field_agent` for MEMBER users.

## Using auth in route handlers (PR 8+ services)

```typescript
import { requireStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listApplicationsForProperty } from "@/lib/services";

const ctx = await requireStaffContextFromSession();
const apps = await listApplicationsForProperty(prisma, ctx, propertyId);
```

Maintenance API routes today use `requireStaffMaintenanceContext` in `lib/maintenance/authorization.ts` (same session + org cookie; can converge later).

## Seed staff accounts

After `npm run db:seed`:

| Email | Org role | Password |
|-------|----------|----------|
| `admin@axford.test` | `ADMIN` | `AxfordDev123!` (default) |
| `pm@axford.test` | `MEMBER` | same |

Override hash input with `SEED_STAFF_PASSWORD` when seeding.

`operator@rocket-logic.test` has no password hash (platform operator; use dev email-only locally if needed).

## Environment

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | JWT signing |
| `NEXTAUTH_URL` / `AUTH_URL` | OAuth redirects |
| `DEV_CREDENTIALS_LOGIN` | Server: allow email-only for users without `passwordHash` |
| `NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN` | Client: show dev login hints |
| `SEED_STAFF_PASSWORD` | Optional seed password for admin/pm hashes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional staff Google sign-in |

## Gmail / AI (unchanged)

- Gmail mailbox connect uses **separate** OAuth (`lib/gmail/*`, `GOOGLE_GMAIL_*`).
- Staff must be signed in via NextAuth before connecting a mailbox; token vault unchanged.

## Not ported

- PM Tenant Centre `pm_staff_session` HMAC cookies
- Donor header-based staff user id fallback

## Regression checklist

- [ ] `admin@axford.test` / `AxfordDev123!` → inbox
- [ ] Dev email-only still works for users without hash when `DEV_CREDENTIALS_LOGIN=true`
- [ ] `isActive=false` user cannot sign in
- [ ] Org switcher + maintenance list scoped to active org
- [ ] Gmail connect + sync + AI draft (frozen modules)
