import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { dedupeListings } from "@/lib/scrapers/normalize/dedupe-listings";
import { normalizeScraperListings } from "@/lib/scrapers/normalize/normalize-listing";
import {
  fetchCraigslistRentalsWithRetry,
  getLastCraigslistProviderDiagnostics,
  type CraigslistFetchFn,
} from "@/lib/scrapers/providers/craigslist/craigslist-client";
import { buildCraigslistSearchParams } from "@/lib/scrapers/search/build-search-query";
import type { NormalizedComparable, ProviderRequestDiagnostics, RawScraperListing } from "@/lib/scrapers/types";
import { applyOutlierExclusions, matchComparableListings, type MatchComparableOptions } from "./matching";
import type { MarketRentSearchAttemptDiagnostics } from "./matching-diagnostics";
import {
  MIN_MATCHED_COMPS_TARGET,
  buildSearchWideningNote,
  buildSearchWideningPhases,
  formatSearchAttemptQuery,
  suggestRegionalFallbackSearch,
} from "./search-widening";

export type CompPipelineResult = {
  rawListings: RawScraperListing[];
  normalized: NormalizedComparable[];
  matched: NormalizedComparable[];
  excluded: NormalizedComparable[];
  kept: NormalizedComparable[];
  outlierExcluded: NormalizedComparable[];
  searchAttempts: MarketRentSearchAttemptDiagnostics[];
  searchWasGeographicallyBroadened: boolean;
  providerDiagnostics: ProviderRequestDiagnostics[];
};

type MatchPipelineResult = {
  matched: NormalizedComparable[];
  excluded: NormalizedComparable[];
  kept: NormalizedComparable[];
  outlierExcluded: NormalizedComparable[];
};

function runMatchPipeline(
  inputs: MarketRentResearchInputs,
  normalized: NormalizedComparable[],
  matchOptions?: MatchComparableOptions,
): MatchPipelineResult {
  const { matched, excluded } = matchComparableListings(inputs, normalized, matchOptions);
  const { kept, outlierExcluded } = applyOutlierExclusions(matched);
  return { matched, excluded, kept, outlierExcluded };
}

function isBetterMatchResult(next: MatchPipelineResult, current: MatchPipelineResult): boolean {
  if (next.kept.length > current.kept.length) return true;
  if (next.kept.length === current.kept.length && next.matched.length > current.matched.length) {
    return true;
  }
  return false;
}

async function fetchListingsForInputs(
  inputs: MarketRentResearchInputs,
  options?: { fetchFn?: CraigslistFetchFn; timeoutMs?: number },
): Promise<{ rawListings: RawScraperListing[]; diagnostics: ProviderRequestDiagnostics | null }> {
  const params = buildCraigslistSearchParams(inputs);
  const rawListings = await fetchCraigslistRentalsWithRetry(params, {
    fetchFn: options?.fetchFn,
    timeoutMs: options?.timeoutMs,
    cityDisplay: inputs.city,
  });
  const diagnostics = getLastCraigslistProviderDiagnostics();
  return { rawListings, diagnostics: diagnostics ?? null };
}

export async function runCompSearchWithWidening(
  inputs: MarketRentResearchInputs,
  options?: { fetchFn?: CraigslistFetchFn; timeoutMs?: number },
): Promise<CompPipelineResult> {
  const providerDiagnostics: ProviderRequestDiagnostics[] = [];
  const searchAttempts: MarketRentSearchAttemptDiagnostics[] = [];
  let searchWasGeographicallyBroadened = false;
  let allRaw: RawScraperListing[] = [];

  const firstFetch = await fetchListingsForInputs(inputs, options);
  allRaw = firstFetch.rawListings;
  if (firstFetch.diagnostics) providerDiagnostics.push(firstFetch.diagnostics);

  let normalized = dedupeListings(normalizeScraperListings(allRaw));
  let best = runMatchPipeline(inputs, normalized);
  searchAttempts.push({
    attempt: 1,
    label: "Original search",
    craigslistSearchQuery: formatSearchAttemptQuery(inputs),
    rawListingCount: allRaw.length,
    matchedCount: best.matched.length,
    keptCount: best.kept.length,
  });

  if (best.kept.length < MIN_MATCHED_COMPS_TARGET) {
    const phases = buildSearchWideningPhases(inputs);

    for (const phase of phases) {
      if (best.kept.length >= MIN_MATCHED_COMPS_TARGET) break;

      if (phase.requiresFetch) {
        const fetchResult = await fetchListingsForInputs(phase.searchInputs, options);
        allRaw = [...allRaw, ...fetchResult.rawListings];
        if (fetchResult.diagnostics) providerDiagnostics.push(fetchResult.diagnostics);
        searchWasGeographicallyBroadened = true;
      }

      normalized = dedupeListings(normalizeScraperListings(allRaw));
      const candidate = runMatchPipeline(inputs, normalized, phase.matchOptions);

      searchAttempts.push({
        attempt: searchAttempts.length + 1,
        label: phase.description,
        craigslistSearchQuery: formatSearchAttemptQuery(phase.searchInputs),
        rawListingCount: allRaw.length,
        matchedCount: candidate.matched.length,
        keptCount: candidate.kept.length,
      });

      if (isBetterMatchResult(candidate, best)) {
        best = candidate;
      }
    }
  }

  return {
    rawListings: allRaw,
    normalized,
    matched: best.matched,
    excluded: best.excluded,
    kept: best.kept,
    outlierExcluded: best.outlierExcluded,
    searchAttempts,
    searchWasGeographicallyBroadened,
    providerDiagnostics,
  };
}

export function buildWideningDataQualityNotes(args: {
  searchWasGeographicallyBroadened: boolean;
  inputs: MarketRentResearchInputs;
  keptCount: number;
}): string[] {
  const notes: string[] = [];
  if (args.searchWasGeographicallyBroadened) {
    const regional = suggestRegionalFallbackSearch(args.inputs);
    if (regional) {
      notes.push(buildSearchWideningNote(regional.regionLabel));
    } else {
      notes.push("Search area was broadened due to limited local comps.");
    }
  }
  return notes;
}
