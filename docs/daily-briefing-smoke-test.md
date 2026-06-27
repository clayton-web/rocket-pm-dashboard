# Daily Briefing — smoke test checklist

Use this after deploying the Daily Briefing MVP or before enabling it for a production organization.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Migration applied | `npm run db:migrate` or `prisma migrate deploy` in production |
| Env vars set | See [MVP runbook](./daily-briefing-integration-plan.md#14-mvp-operations-runbook) |
| Staff user + org | Active organization selected in dashboard |
| Gmail connected | `/email` — at least one mailbox synced recently |
| Gemini access | `GEMINI_API_KEY` valid |

## Enable for one org (disabled by default)

1. Sign in as org **admin** (settings require admin rights).
2. Open **`/briefing/settings`**.
3. Enable **Daily Briefing** for the organization.
4. Enable **Morning** and/or **Afternoon** slots.
5. Set **email recipients** (comma-separated) if email delivery should be tested.
6. Enable **auto-briefing in organization AI policy**.
7. Save settings.

No seed data creates `BriefingSettings`; the settings form upserts on first save.

## Manual run (recommended first test)

1. Open **`/briefing`**.
2. Choose **Morning** or **Afternoon** tab.
3. Click **Run briefing now**.
4. Drain the job queue:

```bash
curl -X POST "$APP_PUBLIC_URL/api/internal/jobs/process" \
  -H "Authorization: Bearer $JOB_PROCESSOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

5. Refresh **`/briefing`** — latest run card should show status **Completed** (or **Failed** with safe error).
6. Open **`/briefing/[runId]`** — executive summary, grouped items, inbox links.

## Verify dashboard UX

- [ ] Morning / Afternoon tabs filter latest run per slot
- [ ] Status badge shows PENDING / RUNNING / COMPLETED / FAILED / PARTIAL
- [ ] Urgent items appear before lower-urgency categories
- [ ] Rent/deposit items show **Email mention only — verify in Buildium once integrated**
- [ ] No raw email body text on briefing pages
- [ ] **Mark reviewed** sets reviewed timestamp
- [ ] Disabled notice when Daily Briefing is off in settings

## Verify email delivery

Requires `EMAIL_ENABLED=true`, Resend config, and at least one recipient.

- [ ] Completed run with `itemsIncluded > 0` sends email
- [ ] Zero-item run does **not** send email
- [ ] Email subject: `{Morning|Afternoon} Daily Briefing — {orgName}`
- [ ] Email links to `/briefing/[runId]` and inbox threads
- [ ] Footer disclaimer mentions email mentions vs accounting records
- [ ] `BriefingRun.emailSentAt` set after successful send

## Verify scheduled path (optional)

External cron (not Vercel Hobby twice-daily — see runbook):

```bash
# Morning slot (07:00 America/Vancouver ≈ 14:00 UTC during PDT)
curl -X POST "$APP_PUBLIC_URL/api/internal/briefing/schedule?slot=MORNING" \
  -H "Authorization: Bearer $CRON_SECRET"

# Afternoon slot (14:00 Vancouver ≈ 21:00 UTC during PDT)
curl -X POST "$APP_PUBLIC_URL/api/internal/briefing/schedule?slot=AFTERNOON" \
  -H "Authorization: Bearer $CRON_SECRET"

# Then drain jobs (repeat until queue empty)
curl -X POST "$APP_PUBLIC_URL/api/internal/jobs/process" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

- [ ] `briefing.schedule` jobs created per eligible org
- [ ] Optional `gmail.sync` enqueued when auto-sync enabled
- [ ] `briefing.generate` runs after sync delay
- [ ] Audit log events: `briefing.schedule.enqueued`, `briefing.started`, `briefing.completed`

## Privacy safeguards

- [ ] `BriefingItem` rows contain subject/snippet summaries only — no email body columns
- [ ] Skipped personal threads are counted but not listed in UI or email
- [ ] Audit metadata has no message bodies

## Disable

1. **`/briefing/settings`** → uncheck **Enable Daily Briefing** and/or **auto-briefing**.
2. Set `BRIEFING_AUTOMATION_ENABLED=false` in host env to block all `briefing.*` jobs.
