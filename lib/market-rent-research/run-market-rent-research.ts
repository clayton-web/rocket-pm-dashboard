import type {
  MarketRentResearchInputs,
  MarketRentSourceId,
} from "@/lib/validation/market-rent-research";
import { loadMarketRentSampleFixtureListings } from "@/lib/scrapers/fixtures/market-rent-sample-comps";
import { isMarketRentScrapeCraigslistEnabled } from "@/lib/scrapers/feature-flag";
import { dedupeListings } from "@/lib/scrapers/normalize/dedupe-listings";
import { normalizeScraperListings } from "@/lib/scrapers/normalize/normalize-listing";
import {
  fetchCraigslistRentalsWithRetry,
  getLastCraigslistProviderDiagnostics,
  type CraigslistFetchFn,
} from "@/lib/scrapers/providers/craigslist/craigslist-client";
import {
  buildCraigslistSearchParams,
  buildCraigslistSearchText,
} from "@/lib/scrapers/search/build-search-query";
import {
  buildMatchingDiagnostics,
  isMarketRentPreviewMatchingDiagnosticsEnabled,
  parseCraigslistAreaIdFromRequestUrl,
  type MarketRentMatchingDiagnostics,
} from "./matching-diagnostics";
import { cityToCraigslistHostname } from "@/lib/scrapers/providers/craigslist/craigslist-hostname";
import { buildSubAreaDataQualityNote } from "./sub-areas";
import type { NormalizedComparable, ProviderFetchStatus, ProviderRequestDiagnostics, RawScraperListing } from "@/lib/scrapers/types";
import {
  MARKET_RENT_FIXTURE_SAMPLE_NOTE,
  MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
  MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE,
  MARKET_RENT_RESEARCH_PROVIDER_UNAVAILABLE_MESSAGE,
} from "./constants";
import { isMarketRentUseFixtureCompsEnabled } from "./fixture-flag";
import { applyOutlierExclusions, matchComparableListings } from "./matching";
import { isOpenAiApiKeyConfigured, type CreateMarketRentChatJsonCompletion } from "./openai-client";
import {
  buildCraigslistProviderStatus,
  classifyCraigslistFetchError,
  logProviderFailure,
} from "./provider-status";
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
  | {
      ok: false;
      error: string;
      providerStatuses: ProviderFetchStatus[];
      providerDiagnostics?: ProviderRequestDiagnostics[];
      matchingDiagnostics?: MarketRentMatchingDiagnostics;
    };

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
  const failed = providerStatuses.filter((status) => status.status !== "success");
  if (failed.length > 0) {
    parts.push(
      `Source notes: ${failed.map((f) => f.errorMessage).filter(Boolean).join("; ")}`,
    );
  }
  return parts.join(" ");
}

async function fetchRawListings(
  inputs: MarketRentResearchInputs,
  options?: RunMarketRentResearchOptions,
): Promise<{
  rawListings: RawScraperListing[];
  providerStatus: ProviderFetchStatus;
  providerDiagnostics: ProviderRequestDiagnostics[];
  usedFixtureComps: boolean;
  dataQualityNotes: string[];
}> {
  const dataQualityNotes: string[] = [];

  if (isMarketRentUseFixtureCompsEnabled()) {
    const rawListings = loadMarketRentSampleFixtureListings(inputs.city);
    dataQualityNotes.push(MARKET_RENT_FIXTURE_SAMPLE_NOTE);
    return {
      rawListings,
      providerStatus: buildCraigslistProviderStatus({
        status: "success",
        listingCount: rawListings.length,
      }),
      providerDiagnostics: [],
      usedFixtureComps: true,
      dataQualityNotes,
    };
  }

  try {
    const params = buildCraigslistSearchParams(inputs);
    const rawListings = await fetchCraigslistRentalsWithRetry(params, {
      fetchFn: options?.fetchCraigslist,
      timeoutMs: options?.craigslistTimeoutMs,
      cityDisplay: inputs.city,
    });

    const diagnostics = getLastCraigslistProviderDiagnostics();
    const providerDiagnostics = diagnostics ? [diagnostics] : [];

    const status =
      rawListings.length === 0
        ? buildCraigslistProviderStatus({ status: "no_results", listingCount: 0 })
        : buildCraigslistProviderStatus({ status: "success", listingCount: rawListings.length });

    if (rawListings.length === 0) {
      dataQualityNotes.push("Craigslist returned zero raw listings for this search.");
    }

    return {
      rawListings,
      providerStatus: status,
      providerDiagnostics,
      usedFixtureComps: false,
      dataQualityNotes,
    };
  } catch (error) {
    const { status, errorMessage } = classifyCraigslistFetchError(error);
    const diagnostics = getLastCraigslistProviderDiagnostics();
    logProviderFailure("craigslist", status, errorMessage, {
      city: inputs.city,
      diagnostics,
    });
    dataQualityNotes.push("Craigslist provider unavailable for this search.");
    return {
      rawListings: [],
      providerStatus: buildCraigslistProviderStatus({
        status,
        listingCount: 0,
        errorMessage,
      }),
      providerDiagnostics: diagnostics ? [diagnostics] : [],
      usedFixtureComps: false,
      dataQualityNotes,
    };
  }
}

export async function runMarketRentResearch(
  inputs: MarketRentResearchInputs,
  options?: RunMarketRentResearchOptions,
): Promise<MarketRentResearchRunResult> {
  const craigslistEnabled = isMarketRentScrapeCraigslistEnabled();
  if (!craigslistEnabled) {
    return { ok: true, status: "no_providers", message: MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE };
  }

  const { rawListings, providerStatus, providerDiagnostics, usedFixtureComps, dataQualityNotes } =
    await fetchRawListings(inputs, options);
  const providerStatuses: ProviderFetchStatus[] = [providerStatus];

  const normalized = dedupeListings(normalizeScraperListings(rawListings));
  const { matched, excluded } = matchComparableListings(inputs, normalized);
  const { kept, outlierExcluded } = applyOutlierExclusions(matched);
  const allExcluded = [...excluded, ...outlierExcluded];

  const previewDiagnostics = isMarketRentPreviewMatchingDiagnosticsEnabled();
  const craigslistHostname =
    inputs.craigslistHostname?.trim() || cityToCraigslistHostname(inputs.city);
  const craigslistAreaId = parseCraigslistAreaIdFromRequestUrl(
    providerDiagnostics[0]?.requestUrl,
  );
  const matchingDiagnostics = previewDiagnostics
    ? buildMatchingDiagnostics({
        rawListingCount: rawListings.length,
        matched,
        excluded,
        outlierExcluded,
        kept,
        craigslistSearchQuery: buildCraigslistSearchText(inputs),
        craigslistHostname,
        craigslistAreaId,
      })
    : undefined;

  if (kept.length === 0) {
    if (providerStatus.status !== "success") {
      return {
        ok: false,
        error: MARKET_RENT_RESEARCH_PROVIDER_UNAVAILABLE_MESSAGE,
        providerStatuses,
        providerDiagnostics: previewDiagnostics ? providerDiagnostics : undefined,
        matchingDiagnostics,
      };
    }
    return {
      ok: false,
      error: MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
      providerStatuses,
      providerDiagnostics: previewDiagnostics ? providerDiagnostics : undefined,
      matchingDiagnostics,
    };
  }

  const rents = kept.map((listing) => listing.monthlyRent);
  const statistics = computeRentStatistics(rents);
  const suggestedRent = computeDeterministicSuggestedRent(statistics);
  if (!suggestedRent) {
    return {
      ok: false,
      error: MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
      providerStatuses,
    };
  }

  const missingFieldRatio = computeMissingFieldRatio(kept);
  const { confidence, reason: confidenceReason } = computeConfidenceFromCompCount(
    kept.length,
    missingFieldRatio,
  );

  if (outlierExcluded.length > 0) {
    dataQualityNotes.push(`Removed ${outlierExcluded.length} rent outlier(s) using IQR.`);
  }

  const subAreaNote = buildSubAreaDataQualityNote(inputs.neighbourhood);
  if (subAreaNote) dataQualityNotes.push(subAreaNote);

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
    providerStatuses,
    providerDiagnostics,
    usedFixtureComps,
    statistics,
    excludedCount: allExcluded.length,
    rawListingCount: rawListings.length,
    matchingDiagnostics,
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
