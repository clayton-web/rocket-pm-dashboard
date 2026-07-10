# www.rocketlogic.ca/dashboard — authenticated smoke (operator)

Run only through the production domain:

```text
https://www.rocketlogic.ca/dashboard
```

Do **not** use the Vercel alias for this checklist (alias is a control group only).

## Prerequisites

- Staff account with password hash (or Google sign-in) on production
- Browser private window recommended for first pass
- Unauthenticated checks already green (homepage, health, portal viewing)

## Checklist

### Login / session

1. Open https://www.rocketlogic.ca/dashboard/login
2. Confirm page assets load from `/dashboard/_next/…` (not root `/_next/…`)
3. Sign in with production staff credentials **or** Google
4. Confirm final URL stays on `www.rocketlogic.ca` and lands on `/dashboard/inbox` (or intended home)
5. Hard-refresh the page — still authenticated, no `NOT_FOUND`

### Nested routes + refresh

6. Open https://www.rocketlogic.ca/dashboard/properties — list loads
7. Hard-refresh — still 200 / authenticated (not marketing 404, not alias redirect off-domain)
8. Open a property detail if available — rental listing section renders without Prisma errors
9. Open https://www.rocketlogic.ca/dashboard/leasing/applications (or prospects) — queue loads

### Logout

10. Sign out
11. Confirm redirect to login on www
12. Visiting `/dashboard/properties` while logged out redirects to `/dashboard/login?callbackUrl=…`

### Gmail (if mailbox connect is in use)

13. Open `/dashboard/email`
14. Connect Gmail — Google redirect URIs must use `https://www.rocketlogic.ca/dashboard/api/integrations/gmail/callback`
15. Callback returns to www `/dashboard/email` without error

### Public leasing (no staff session)

16. Incognito: https://www.rocketlogic.ca/dashboard/portal/viewing — 200
17. Incognito: https://www.rocketlogic.ca/dashboard/api/leasing/submit-options — 200 JSON

## Pass criteria

- No Vercel `NOT_FOUND` on www dashboard routes
- No unexpected hop to `rocket-pm-dashboard-app.vercel.app` for normal navigation
- Auth cookies work under `/dashboard` on www
- Marketing `/` and `/inspection/login` remain 200 after the session tests
