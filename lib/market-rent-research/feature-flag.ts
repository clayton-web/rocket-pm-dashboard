/** When false (default), market rent research UI and actions are disabled. */
export function isMarketRentResearchEnabled(): boolean {
  const raw = process.env.MARKET_RENT_RESEARCH_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
