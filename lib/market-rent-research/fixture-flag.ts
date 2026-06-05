function isTruthyEnv(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** True on the live Production deployment — not Preview (which also runs NODE_ENV=production). */
function isVercelProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Preview/staging/local only — never enabled on the Production deployment even if the env var is set. */
export function isMarketRentUseFixtureCompsEnabled(): boolean {
  if (isVercelProductionDeployment()) return false;
  return isTruthyEnv(process.env.MARKET_RENT_USE_FIXTURE_COMPS);
}
