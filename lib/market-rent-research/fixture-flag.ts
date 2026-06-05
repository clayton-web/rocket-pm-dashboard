import { isProductionRuntime } from "@/lib/runtime/production-guards";

function isTruthyEnv(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** Dev/staging/preview only — never enabled in production even if the env var is set. */
export function isMarketRentUseFixtureCompsEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return isTruthyEnv(process.env.MARKET_RENT_USE_FIXTURE_COMPS);
}
