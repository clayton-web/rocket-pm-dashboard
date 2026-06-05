import type { ProviderFetchStatus } from "@/lib/scrapers/types";

/** Client-safe listing source labels for the research results panel. */
export function providerStatusUiMessage(status: ProviderFetchStatus): string {
  switch (status.status) {
    case "success":
      return status.listingCount > 0
        ? `Craigslist · ${status.listingCount} listing(s)`
        : "Craigslist returned no results";
    case "timeout":
      return "Craigslist timed out";
    case "blocked":
      return "Craigslist unavailable (blocked or rate limited)";
    case "http_error":
      return "Craigslist unavailable";
    case "no_results":
      return "Craigslist returned no results";
    default:
      return "Craigslist";
  }
}
