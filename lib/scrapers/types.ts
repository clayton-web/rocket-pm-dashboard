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
};

export type ProviderFetchStatus = {
  source: ScraperSourceId;
  ok: boolean;
  listingCount: number;
  error?: string;
};
