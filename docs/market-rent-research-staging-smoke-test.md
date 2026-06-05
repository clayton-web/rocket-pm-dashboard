# Market Rent Research — staging / preview smoke test

Use this checklist when validating Market Rent Research in a **non-production** environment before enabling production flags.

## Prerequisites

- Deploy via GitHub (not local `vercel deploy --prod` without full env sync)
- Staff PM or admin account with password
- `OPENAI_API_KEY` configured in the target environment

## Environment flags (preview / staging)

```env
MARKET_RENT_RESEARCH_ENABLED=true
MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED=true
OPENAI_MARKET_RENT_MODEL=gpt-4o-mini
```

Optional when Craigslist is down or for deterministic UI checks:

```env
MARKET_RENT_USE_FIXTURE_COMPS=true
```

**Never set `MARKET_RENT_USE_FIXTURE_COMPS=true` in production.**

## Smoke test steps

1. Sign in as org admin or property manager
2. Open `/properties/[propertyId]` for a unit you can manage
3. Expand **Market Rent Research**
4. Enter test criteria (example):
   - City: Port Moody
   - Property type: Condo
   - Bedrooms: 2 · Bathrooms: 2 · Sqft: 850
   - Parking: 1 stall · Furnished: Unfurnished
   - Pet policy: Pets negotiable
   - Notes: Near SkyTrain, modern condo
5. Click **Run research**

## Expected — success

- Conservative / Recommended / Aggressive suggested advertising rent tiers
- Confidence + explanation
- Statistics summary
- Comparable listings used (or fixture banner if `MARKET_RENT_USE_FIXTURE_COMPS=true`)
- Listing source status (Craigslist success, no results, unavailable, etc.)
- Data quality notes when applicable

## Expected — Craigslist outage

- Inline message: “No external comparable listings available right now…”
- Listing sources shows **Craigslist unavailable** or **timed out**
- Page does not crash
- No OpenAI explanation when no valid comps

## Expected — no matching comps

- Message: “No comparable listings found. Try broadening the search.”
- Listing sources may show Craigslist success with zero or filtered comps

## Expected — field agent

- Market Rent Research panel **not visible** on property page

## Expected — boundaries

- No writes to Property, Unit, Tenancy, Application, lease, or portal records
- Official rent fields unchanged

## After testing

Turn flags off unless explicitly keeping enabled:

```env
MARKET_RENT_RESEARCH_ENABLED=false
MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED=false
MARKET_RENT_USE_FIXTURE_COMPS=false
```

Redeploy or promote last known-good production deployment if needed.
