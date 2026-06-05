import type {
  MarketRentConfidence,
  MarketRentFurnished,
  MarketRentResearchInputs,
  MarketRentSourceId,
} from "@/lib/validation/market-rent-research";
import type { ProviderFetchStatus, ProviderRequestDiagnostics } from "@/lib/scrapers/types";
import type { RentStatistics } from "./stats";

export type { MarketRentConfidence, MarketRentFurnished, MarketRentResearchInputs, MarketRentSourceId };

/** Suggested advertising rent tiers — reference only, not official lease rent. */
export type MarketRentSuggestedRent = {
  conservative: number;
  recommended: number;
  aggressive: number;
  currency: "CAD";
};

export type MarketRentComparableListing = {
  source: MarketRentSourceId;
  sourceUrl: string;
  title: string;
  monthlyRent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  addressDisplay: string;
  matchScore: number;
};

export type MarketRentSourceBreakdown = {
  craigslist: number;
  rew: number;
};

export type MarketRentResearchResult = {
  suggestedRent: MarketRentSuggestedRent;
  confidence: MarketRentConfidence;
  confidenceReason: string;
  explanation: string;
  explanationSource: "deterministic" | "openai";
  comparableListingsUsed: MarketRentComparableListing[];
  dataQualityNotes: string[];
  sourceBreakdown: MarketRentSourceBreakdown;
  providerStatuses: ProviderFetchStatus[];
  providerDiagnostics?: ProviderRequestDiagnostics[];
  usedFixtureComps: boolean;
  statistics: RentStatistics;
  excludedCount: number;
  rawListingCount: number;
};

export type MarketRentResearchActionResult =
  | { ok: true; status: "success"; result: MarketRentResearchResult }
  | { ok: true; status: "no_providers"; message: string }
  | { ok: false; error: string; providerStatuses?: ProviderFetchStatus[] };

export type MarketRentResearchActionState = MarketRentResearchActionResult & {
  completedAt: number;
};

/** Ensures server-action responses contain only JSON-serializable plain data. */
export function serializeMarketRentResearchResult(
  result: MarketRentResearchResult,
): MarketRentResearchResult {
  return JSON.parse(JSON.stringify(result)) as MarketRentResearchResult;
}
