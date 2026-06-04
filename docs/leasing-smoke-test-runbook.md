# Leasing workflow smoke test runbook

Manual release checklist for the end-to-end leasing workflow. Run in **local or staging** with seed data or a fresh test property.

**Prerequisites:** staff login, organization landlord profile complete, RTB-1 template bundled, document storage writable (`.data/documents` locally).

---

## 1. Viewing request

- [ ] Open `/portal/viewing` (no sign-in)
- [ ] Submit a viewing request with valid property/unit, name, email, and required fields
- **Expected:** success confirmation; request stored for staff review

## 2. Prospect creation

- [ ] Staff opens `/leasing/prospects` or prospect queue
- [ ] Confirm a prospect appears for the viewing email (or create/link manually if your flow auto-creates)
- **Expected:** prospect row with contact email and property/unit context

## 3. Showing

- [ ] From prospect detail, schedule a showing with start/end times
- [ ] Close out the showing (e.g. attended → interested)
- **Expected:** showing status updated; prospect remains eligible for application

## 4. Application

- [ ] Tenant opens `/portal/application` (or staff sends application portal link)
- [ ] Complete and submit application (include emergency contact if testing PR-C3B persistence)
- **Expected:** application in `submitted` status; draft fields saved on PATCH

## 5. Approval

- [ ] Staff opens `/leasing/applications/[id]`
- [ ] Approve the application
- **Expected:** status `approved`; ready for tenancy conversion

## 6. Convert to tenancy

- [ ] On application detail, create tenancy with lease start and move-in dates
- **Expected:** tenancy `pending_move_in`; primary contact with `portalAccessEnabled: true`; link to tenancy detail

## 7. Lease setup

- [ ] Open `/leasing/tenancies/[id]`
- [ ] Complete lease setup (tenancy type, rent, deposits, RTB fields)
- [ ] Confirm readiness shows **Ready for RTB-1**
- **Expected:** lease setup step complete in onboarding stepper

## 8. RTB-1 generation

- [ ] Click **Generate RTB-1 draft**
- **Expected:** draft PDF created; staff can download from tenancy detail; onboarding shows **RTB-1 draft generated**

## 9. Send for signature

- [ ] Click **Send For Signature**
- **Expected:** signature request active; tenant signing URL displayed; status **Sent for signature**

## 10. Tenant signs

- [ ] Open tenant signing link (`/sign/lease/[token]`) in a private/incognito window
- [ ] Review draft PDF, sign with legal name
- **Expected:** signature recorded; staff detail shows tenant signed; PM counter-sign enabled

## 11. PM signs

- [ ] Staff counter-signs on tenancy detail
- **Expected:** executed RTB-1 generated, locked, and downloadable; signature request completed

## 12. Executed lease created

- [ ] Confirm executed document exists (`lease_rtb1_executed`, signed + locked)
- [ ] Confirm **Mark active** is enabled (activation readiness passes)
- **Expected:** onboarding shows **Executed lease complete** and **Ready to activate**

## 13. Activate tenant

- [ ] Click **Mark active**
- **Expected:** tenancy status `active`; onboarding summary hidden; lifecycle advances correctly

## 14. Tenant login

- [ ] Open `/portal/login` (or `/portal/documents` → redirect to login with `next`)
- [ ] Sign in with tenant email + OTP (dev code shown when `TENANT_AUTH_DEV_SHOW_CODE=true`)
- **Expected:** redirect to intended page (documents or dashboard); session cookie set

## 15. Tenant downloads lease

- [ ] Open `/portal/documents`
- [ ] Click **View / download** on executed RTB-1
- **Expected:** PDF opens/downloads; draft documents not listed; other tenancies’ documents not accessible

---

## Regression checks

| Check | Expected |
|-------|----------|
| Generate RTB-1 during active signing | Blocked with clear error |
| Mark active without executed lease | Button disabled; server rejects |
| Tenant portal before activation | Login fails (generic OTP message) |
| Staff download `/api/leasing/documents/[id]/download` | Works for staff session only |
| Tenant download `/api/portal/documents/[id]/download` | Works for tenant session only |

## Failure triage

| Symptom | Check |
|---------|--------|
| RTB-1 generation blocked | Organization landlord profile; lease setup readiness |
| PM sign stuck | Retry execution button; partial-failure recovery (PR-C3B) |
| Tenant cannot log in | Tenancy `active`; `portalAccessEnabled`; email matches contact |
| Documents empty after login | Executed doc exists; `isLocked` + `isSigned`; tenancy active |
| PDF download 404 | File exists under `LOCAL_DOCUMENT_STORAGE_ROOT` |

## Related docs

- [Leasing production readiness](./leasing-production-readiness.md)
- [Tenant auth MVP](./tenant-auth-mvp.md)
- [Production smoke test](./production-smoke-test.md) — broader app checks
