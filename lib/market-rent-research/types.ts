import type {
  MarketRentConfidence,
  MarketRentFurnished,
  MarketRentResearchInputs,
  MarketRentSourceId,
} from "@/lib/validation/market-rent-research";

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

/** Placeholder result shape for future OpenAI synthesis (PR 1: not populated). */
export type MarketRentResearchResult = {
  suggestedRent: MarketRentSuggestedRent;
  confidence: MarketRentConfidence;
  confidenceReason: string;
  explanation: string;
  comparableListingsUsed: MarketRentComparableListing[];
  dataQualityNotes: string[];
  sourceBreakdown: MarketRentSourceBreakdown;
};

export type MarketRentResearchActionResult =
  | { ok: true; status: "not_implemented"; message: string }
  | { ok: false; error: string };

export type MarketRentResearchActionState = MarketRentResearchActionResult & {
  completedAt: number;
};
