# PR 7 — Maintenance runtime (Prisma) — Supabase references

## Dashboard repo (this app)

- **No** `@supabase/*` packages in `package.json` (never added on Path A).
- **No** Supabase client usage for maintenance writes or reads in PR 7.
- Schema/docs only mention Supabase for future ETL (`legacySupabaseId`, `docs/schema-merge-plan.md`).

## Donor repo (`pm-tenant-centre`) — not ported in PR 7

These remain on the donor until ETL / package removal (PR 8+):

| Area | Path |
|------|------|
| List/create API | `src/app/api/maintenance/route.ts` |
| Get/patch API | `src/app/api/maintenance/[id]/route.ts` |
| Triage API | `src/app/api/portal/maintenance/triage/route.ts` |
| Supabase server client | `src/lib/supabase/server` (donor) |
| Guided electrical triage | `src/lib/maintenance/triage/guided/**` |
| Gemini triage service | `src/lib/maintenance/triage/triageService.ts` |

## PR 7 source of truth

- Prisma models: `MaintenanceRequest`, `MaintenanceAttachment`
- Routes: `/portal/maintenance/new` (public), `/maintenance`, `/maintenance/[requestId]` (staff)
- API: `POST/GET /api/maintenance`, `GET/PATCH /api/maintenance/[id]`, `GET /api/maintenance/submit-options`
