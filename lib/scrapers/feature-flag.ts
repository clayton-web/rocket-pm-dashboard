/** When false (default), Craigslist scraping is disabled even if research is enabled. */
export function isMarketRentScrapeCraigslistEnabled(): boolean {
  const raw = process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
