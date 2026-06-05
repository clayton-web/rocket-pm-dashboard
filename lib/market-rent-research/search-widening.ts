import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { cityToCraigslistHostname } from "@/lib/scrapers/providers/craigslist/craigslist-hostname";
import { buildCraigslistSearchText } from "@/lib/scrapers/search/build-search-query";
import type { MatchComparableOptions } from "./matching";

/** Minimum matched comps before optional search widening stops. */
export const MIN_MATCHED_COMPS_TARGET = 3;

export type RegionalFallbackSearch = {
  craigslistSearchArea: string;
  craigslistHostname: string;
  regionLabel: string;
};

type CityRegionEntry = RegionalFallbackSearch;

const TRI_CITIES: CityRegionEntry = {
  craigslistSearchArea: "Port Moody Coquitlam Port Coquitlam",
  craigslistHostname: "vancouver",
  regionLabel: "Tri-Cities",
};

const NORTH_SHORE: CityRegionEntry = {
  craigslistSearchArea: "North Vancouver West Vancouver",
  craigslistHostname: "vancouver",
  regionLabel: "North Shore",
};

const DELTA_SURREY_LANGLEY: CityRegionEntry = {
  craigslistSearchArea: "Delta Surrey Langley",
  craigslistHostname: "vancouver",
  regionLabel: "Delta / Surrey / Langley",
};

const BURNABY_NEW_WEST: CityRegionEntry = {
  craigslistSearchArea: "Burnaby New Westminster",
  craigslistHostname: "vancouver",
  regionLabel: "Burnaby / New Westminster",
};

const RICHMOND_REGION: CityRegionEntry = {
  craigslistSearchArea: "Richmond",
  craigslistHostname: "vancouver",
  regionLabel: "Richmond",
};

const VANCOUVER_REGION: CityRegionEntry = {
  craigslistSearchArea: "Vancouver",
  craigslistHostname: "vancouver",
  regionLabel: "Vancouver",
};

const FRASER_VALLEY: CityRegionEntry = {
  craigslistSearchArea: "Abbotsford Mission Chilliwack",
  craigslistHostname: "abbotsford",
  regionLabel: "Fraser Valley",
};

const CITY_REGION_FALLBACK: Record<string, CityRegionEntry> = {
  "port moody": TRI_CITIES,
  coquitlam: TRI_CITIES,
  "port coquitlam": TRI_CITIES,
  "north vancouver": NORTH_SHORE,
  "west vancouver": NORTH_SHORE,
  surrey: DELTA_SURREY_LANGLEY,
  delta: DELTA_SURREY_LANGLEY,
  langley: DELTA_SURREY_LANGLEY,
  "white rock": DELTA_SURREY_LANGLEY,
  "maple ridge": DELTA_SURREY_LANGLEY,
  "pitt meadows": DELTA_SURREY_LANGLEY,
  burnaby: BURNABY_NEW_WEST,
  "new westminster": BURNABY_NEW_WEST,
  richmond: RICHMOND_REGION,
  vancouver: VANCOUVER_REGION,
  abbotsford: FRASER_VALLEY,
  mission: FRASER_VALLEY,
  chilliwack: FRASER_VALLEY,
};

export function suggestRegionalFallbackSearch(
  inputs: MarketRentResearchInputs,
): RegionalFallbackSearch | null {
  const cityKey = inputs.city.trim().toLowerCase();
  const fallback = CITY_REGION_FALLBACK[cityKey];
  if (!fallback) return null;

  const currentArea = inputs.craigslistSearchArea?.trim() || inputs.city.trim();
  if (currentArea.toLowerCase() === fallback.craigslistSearchArea.toLowerCase()) {
    return null;
  }

  return fallback;
}

export function buildRegionalFallbackInputs(
  inputs: MarketRentResearchInputs,
  fallback: RegionalFallbackSearch,
): MarketRentResearchInputs {
  return {
    ...inputs,
    craigslistSearchArea: fallback.craigslistSearchArea,
    craigslistHostname: fallback.craigslistHostname,
    neighbourhood: undefined,
  };
}

export type SearchWideningPhase = {
  label: string;
  description: string;
  searchInputs: MarketRentResearchInputs;
  matchOptions: MatchComparableOptions;
  requiresFetch: boolean;
};

/** Ordered widening phases after the original city search. */
export function buildSearchWideningPhases(
  inputs: MarketRentResearchInputs,
): SearchWideningPhase[] {
  const phases: SearchWideningPhase[] = [];
  const regional = suggestRegionalFallbackSearch(inputs);

  if (regional) {
    phases.push({
      label: "regional",
      description: `${regional.regionLabel} Craigslist area`,
      searchInputs: buildRegionalFallbackInputs(inputs, regional),
      matchOptions: { skipNeighbourhoodFilter: true },
      requiresFetch: true,
    });
  }

  const relaxedInputs = regional
    ? buildRegionalFallbackInputs(inputs, regional)
    : { ...inputs, neighbourhood: undefined };

  phases.push({
    label: "relaxed-sqft",
    description: "Relaxed sqft tolerance (±40%)",
    searchInputs: relaxedInputs,
    matchOptions: {
      sqftToleranceRatio: 0.4,
      skipNeighbourhoodFilter: Boolean(regional || inputs.neighbourhood?.trim()),
    },
    requiresFetch: false,
  });

  return phases;
}

export function formatSearchAttemptQuery(inputs: MarketRentResearchInputs): string {
  return buildCraigslistSearchText(inputs);
}

export function buildSearchWideningNote(regionLabel: string): string {
  return `Search widened to ${regionLabel} due to limited local comps.`;
}

export function resolveSearchHostname(inputs: MarketRentResearchInputs): string {
  return inputs.craigslistHostname?.trim() || cityToCraigslistHostname(inputs.city);
}
