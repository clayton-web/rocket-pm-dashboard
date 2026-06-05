import { ScraperFetchError, ScraperTimeoutError } from "@/lib/scrapers/errors";
import type { ProviderFetchStatus, ProviderSourceStatus } from "@/lib/scrapers/types";

export function classifyCraigslistFetchError(error: unknown): {
  status: ProviderSourceStatus;
  errorMessage: string;
} {
  if (error instanceof ScraperTimeoutError) {
    return { status: "timeout", errorMessage: error.message };
  }
  if (error instanceof ScraperFetchError) {
    const status: ProviderSourceStatus =
      error.httpStatus === 403 || error.httpStatus === 429 ? "blocked" : "http_error";
    return { status, errorMessage: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { status: "http_error", errorMessage: message };
}

export function buildCraigslistProviderStatus(args: {
  status: ProviderSourceStatus;
  listingCount: number;
  errorMessage?: string;
}): ProviderFetchStatus {
  return {
    source: "craigslist",
    status: args.status,
    listingCount: args.listingCount,
    errorMessage: args.errorMessage,
  };
}

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

export function logProviderFailure(
  source: string,
  status: ProviderSourceStatus,
  errorMessage: string | undefined,
  context: Record<string, unknown>,
): void {
  console.warn(`[market-rent-research] ${source} fetch ${status}`, {
    errorMessage,
    ...context,
  });
}
