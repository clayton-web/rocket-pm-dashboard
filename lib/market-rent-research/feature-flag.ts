/** When false (default), market rent research UI and actions are disabled. */
export function isMarketRentResearchEnabled(): boolean {
  try {
    const raw = process.env.MARKET_RENT_RESEARCH_ENABLED;
    if (typeof raw !== "string") return false;
    const normalized = raw.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  } catch {
    return false;
  }
}
