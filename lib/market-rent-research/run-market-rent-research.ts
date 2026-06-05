import type {
  MarketRentResearchInputs,
  MarketRentSourceId,
} from "@/lib/validation/market-rent-research";
import { isMarketRentScrapeCraigslistEnabled } from "@/lib/scrapers/feature-flag";
import { dedupeListings } from "@/lib/scrapers/normalize/dedupe-listings";
import { normalizeScraperListings } from "@/lib/scrapers/normalize/normalize-listing";
import {
  fetchCraigslistRentals,
  type CraigslistFetchFn,
} from "@/lib/scrapers/providers/craigslist/craigslist-client";
import { buildCraigslistSearchParams } from "@/lib/scrapers/search/build-search-query";
import type { NormalizedComparable, ProviderFetchStatus, RawScraperListing } from "@/lib/scrapers/types";
import {
  MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
  MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE,
} from "./constants";
import { applyOutlierExclusions, matchComparableListings } from "./matching";
import { isOpenAiApiKeyConfigured, type CreateMarketRentChatJsonCompletion } from "./openai-client";
import {
  computeConfidenceFromCompCount,
  computeDeterministicSuggestedRent,
  computeMissingFieldRatio,
  computeRentStatistics,
  type RentStatistics,
} from "./stats";
import { synthesizeMarketRentWithOpenAi } from "./synthesize-with-openai";
import type { MarketRentComparableListing, MarketRentResearchResult } from "./types";

export type MarketRentResearchRunResult =
  | { ok: true; status: "success"; result: MarketRentResearchResult; statistics: RentStatistics }
  | { ok: true; status: "no_providers"; message: string }
  | { ok: false; error: string };

export type RunMarketRentResearchOptions = {
  fetchCraigslist?: CraigslistFetchFn;
  craigslistTimeoutMs?: number;
  createOpenAiCompletion?: CreateMarketRentChatJsonCompletion;
};

function toComparableListing(listing: NormalizedComparable): MarketRentComparableListing {
  return {
    source: listing.source as MarketRentSourceId,
    sourceUrl: listing.sourceUrl,
    monthlyRent: listing.monthlyRent,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    addressDisplay: listing.neighbourhood
      ? `${listing.neighbourhood}, ${listing.city}`
      : listing.title,
    matchScore: listing.matchScore,
    title: listing.title,
  };
}

function buildExplanation(
  stats: RentStatistics,
  confidenceReason: string,
  providerStatuses: ProviderFetchStatus[],
): string {
  const parts = [confidenceReason];
  if (stats.median != null) {
    parts.push(`Craigslist median asking rent: $${Math.round(stats.median)} CAD.`);
  }
  const failed = providerStatuses.filter((status) => !status.ok);
  if (failed.length > 0) {
    parts.push(`Source notes: ${failed.map((f) => f.error).filter(Boolean).join("; ")}`);
  }
  return parts.join(" ");
}

export async function runMarketRentResearch(
  inputs: MarketRentResearchInputs,
  options?: RunMarketRentResearchOptions,
): Promise<MarketRentResearchRunResult> {
  const craigslistEnabled = isMarketRentScrapeCraigslistEnabled();
  if (!craigslistEnabled) {
    return { ok: true, status: "no_providers", message: MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE };
  }

  const providerStatuses: ProviderFetchStatus[] = [];
  const dataQualityNotes: string[] = [];
  let rawListings: RawScraperListing[] = [];

  try {
    const params = buildCraigslistSearchParams(inputs);
    rawListings = await fetchCraigslistRentals(params, {
      fetchFn: options?.fetchCraigslist,
      timeoutMs: options?.craigslistTimeoutMs,
      cityDisplay: inputs.city,
    });
    providerStatuses.push({
      source: "craigslist",
      ok: true,
      listingCount: rawListings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Craigslist search failed.";
    providerStatuses.push({
      source: "craigslist",
      ok: false,
      listingCount: 0,
      error: message,
    });
    dataQualityNotes.push(`Craigslist: ${message}`);
  }

  const normalized = dedupeListings(normalizeScraperListings(rawListings));
  const { matched, excluded } = matchComparableListings(inputs, normalized);
  const { kept, outlierExcluded } = applyOutlierExclusions(matched);
  const allExcluded = [...excluded, ...outlierExcluded];

  if (kept.length === 0) {
    if (providerStatuses.every((status) => !status.ok)) {
      return { ok: false, error: dataQualityNotes[0] ?? "Listing source request failed." };
    }
    return { ok: false, error: MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE };
  }

  const rents = kept.map((listing) => listing.monthlyRent);
  const statistics = computeRentStatistics(rents);
  const suggestedRent = computeDeterministicSuggestedRent(statistics);
  if (!suggestedRent) {
    return { ok: false, error: MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE };
  }

  const missingFieldRatio = computeMissingFieldRatio(kept);
  const { confidence, reason: confidenceReason } = computeConfidenceFromCompCount(
    kept.length,
    missingFieldRatio,
  );

  if (outlierExcluded.length > 0) {
    dataQualityNotes.push(`Removed ${outlierExcluded.length} rent outlier(s) using IQR.`);
  }
  if (rawListings.length === 0) {
    dataQualityNotes.push("Craigslist returned zero raw listings for this search.");
  }

  const result: MarketRentResearchResult = {
    suggestedRent,
    confidence,
    confidenceReason,
    explanation: buildExplanation(statistics, confidenceReason, providerStatuses),
    explanationSource: "deterministic",
    comparableListingsUsed: kept.slice(0, 15).map(toComparableListing),
    dataQualityNotes,
    sourceBreakdown: {
      craigslist: kept.length,
      rew: 0,
    },
    statistics,
    excludedCount: allExcluded.length,
    rawListingCount: rawListings.length,
  };

  if (!isOpenAiApiKeyConfigured()) {
    return { ok: true, status: "success", result, statistics };
  }

  const synthesized = await synthesizeMarketRentWithOpenAi(result, {
    createCompletion: options?.createOpenAiCompletion,
    inputs,
    compCount: kept.length,
    missingFieldRatio,
    compRents: rents,
  });

  return { ok: true, status: "success", result: synthesized, statistics };
}
