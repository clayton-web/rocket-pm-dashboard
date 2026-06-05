import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";

export type ScraperSourceId = "craigslist" | "rew";

/** Raw listing summary from a scraper — no contact info or full body. */
export type RawScraperListing = {
  source: ScraperSourceId;
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  monthlyRent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  city: string;
  neighbourhood: string | null;
  postedAt: string | null;
  capturedAt: string;
  propertyTypeHint: string | null;
};

export type NormalizedComparable = {
  source: ScraperSourceId;
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  monthlyRent: number;
  currency: "CAD";
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  city: string;
  neighbourhood: string | null;
  postedAt: string | null;
  capturedAt: string;
  propertyTypeHint: string | null;
  matchScore: number;
  matchReasons: string[];
  excluded: boolean;
  exclusionReason?: string;
};

export type MarketRentSearchQuery = MarketRentResearchInputs & {
  craigslistCitySlug: string;
  searchText: string;
};

export type CraigslistSearchParams = {
  citySlug: string;
  query: string;
  bedrooms: number;
  /** Pre-resolved area_id — skips HTML lookup when set (tests). */
  areaId?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
};

export type ProviderRequestDiagnostics = {
  source: ScraperSourceId;
  requestUrl: string;
  httpStatus?: number;
  responseBodySnippet?: string;
  elapsedMs: number;
  success: boolean;
};

export type ProviderSourceStatus =
  | "success"
  | "timeout"
  | "blocked"
  | "http_error"
  | "no_results";

export type ProviderFetchStatus = {
  source: ScraperSourceId;
  status: ProviderSourceStatus;
  listingCount: number;
  errorMessage?: string;
};
