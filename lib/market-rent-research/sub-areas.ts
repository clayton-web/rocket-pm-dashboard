import { cityToCraigslistHostname } from "@/lib/scrapers/providers/craigslist/craigslist-hostname";

/** Blank selection — use city-wide Craigslist query for the property city. */
export const MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID = "";

/** Custom matching keyword only — not sent to Craigslist query text. */
export const MARKET_RENT_SUB_AREA_OTHER_ID = "__other__";

export type MarketRentSubAreaOption = {
  id: string;
  /** Property city used to group dropdown options. */
  city: string;
  /** PM-facing label in the dropdown. */
  label: string;
  /** Craigslist site hostname (e.g. vancouver, abbotsford). */
  hostname: string;
  /**
   * Craigslist SAPI query area text.
   * null → use the property city name in the query.
   */
  craigslistQuery: string | null;
  /** Post-fetch matching keyword; null → no neighbourhood filter. */
  matchingNeighbourhood: string | null;
  notes?: string;
};

type RegionTemplate = {
  idSuffix: string;
  label: string;
  craigslistQuery: string;
  matchingNeighbourhood?: string | null;
  notes?: string;
};

/** Craigslist vancouver.craigslist.org subareas — broad geography only. */
const VANCOUVER_SITE_REGIONS: RegionTemplate[] = [
  {
    idSuffix: "vancouver",
    label: "Vancouver",
    craigslistQuery: "Vancouver",
    notes: "Craigslist Vancouver / city of Vancouver listings",
  },
  {
    idSuffix: "burnaby-new-west",
    label: "Burnaby / New Westminster",
    craigslistQuery: "Burnaby New Westminster",
  },
  {
    idSuffix: "north-shore",
    label: "North Shore",
    craigslistQuery: "North Vancouver West Vancouver",
  },
  {
    idSuffix: "tri-cities",
    label: "Tri-Cities",
    craigslistQuery: "Port Moody Coquitlam Port Coquitlam",
  },
  {
    idSuffix: "richmond",
    label: "Richmond",
    craigslistQuery: "Richmond",
  },
  {
    idSuffix: "delta-surrey-langley",
    label: "Delta / Surrey / Langley",
    craigslistQuery: "Delta Surrey Langley",
  },
];

const FRASER_VALLEY_REGIONS: RegionTemplate[] = [
  {
    idSuffix: "fraser-valley",
    label: "Fraser Valley",
    craigslistQuery: "Abbotsford Mission Chilliwack",
    notes: "Broader Fraser Valley Craigslist search",
  },
];

function citySlug(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

function buildCityWideOption(city: string): MarketRentSubAreaOption {
  const hostname = cityToCraigslistHostname(city);
  return {
    id: `${citySlug(city)}:city-wide`,
    city,
    label: "City-wide",
    hostname,
    craigslistQuery: null,
    matchingNeighbourhood: null,
    notes: `Broad ${city} search on ${hostname}.craigslist.org`,
  };
}

function buildRegionalOptions(city: string, regions: RegionTemplate[]): MarketRentSubAreaOption[] {
  const hostname = cityToCraigslistHostname(city);
  const slug = citySlug(city);
  return regions.map((region) => ({
    id: `${slug}:${region.idSuffix}`,
    city,
    label: region.label,
    hostname,
    craigslistQuery: region.craigslistQuery,
    matchingNeighbourhood: region.matchingNeighbourhood ?? null,
    notes: region.notes,
  }));
}

function buildOptionsForCity(city: string): MarketRentSubAreaOption[] {
  const hostname = cityToCraigslistHostname(city);
  const options = [buildCityWideOption(city)];
  if (hostname === "vancouver") {
    options.push(...buildRegionalOptions(city, VANCOUVER_SITE_REGIONS));
  } else if (hostname === "abbotsford") {
    options.push(...buildRegionalOptions(city, FRASER_VALLEY_REGIONS));
  }
  return options;
}

/** Metro / Fraser Valley cities with Craigslist-aligned search areas. */
const METRO_CITIES = [
  "Vancouver",
  "Burnaby",
  "New Westminster",
  "Richmond",
  "North Vancouver",
  "West Vancouver",
  "Coquitlam",
  "Port Coquitlam",
  "Port Moody",
  "Surrey",
  "Langley",
  "Maple Ridge",
  "Pitt Meadows",
  "Delta",
  "White Rock",
  "Abbotsford",
  "Mission",
  "Chilliwack",
] as const;

/** Craigslist-compatible sub-area options grouped by property city. */
export const MARKET_RENT_SUB_AREA_OPTIONS: MarketRentSubAreaOption[] = METRO_CITIES.flatMap(
  (city) => buildOptionsForCity(city),
);

const OPTION_BY_ID = new Map(MARKET_RENT_SUB_AREA_OPTIONS.map((option) => [option.id, option]));

export function getMarketRentSubAreaOption(id: string): MarketRentSubAreaOption | undefined {
  return OPTION_BY_ID.get(id);
}

export function getMarketRentSubAreasGroupedByCity(): Array<{
  city: string;
  options: MarketRentSubAreaOption[];
}> {
  const groups = new Map<string, MarketRentSubAreaOption[]>();
  for (const option of MARKET_RENT_SUB_AREA_OPTIONS) {
    const existing = groups.get(option.city) ?? [];
    existing.push(option);
    groups.set(option.city, existing);
  }
  return [...groups.entries()].map(([city, options]) => ({ city, options }));
}

export function getMarketRentSubAreaCities(): string[] {
  return getMarketRentSubAreasGroupedByCity().map((group) => group.city);
}

/** Prefill city-wide option when property city matches a known metro city. */
export function suggestSubAreaSelectionForCity(city: string): string {
  const normalized = city.trim().toLowerCase();
  if (!normalized) return MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID;
  const cityWide = MARKET_RENT_SUB_AREA_OPTIONS.find(
    (option) => option.city.toLowerCase() === normalized && option.craigslistQuery === null,
  );
  return cityWide?.id ?? MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID;
}

export type ResolvedMarketRentSubArea = {
  matchingNeighbourhood?: string;
  craigslistSearchArea?: string;
  craigslistHostname?: string;
};

/**
 * Resolve dropdown selection into Craigslist query values and optional matching keywords.
 * Custom keywords apply to post-fetch matching only — never the Craigslist SAPI query.
 */
export function resolveSubAreaForResearch(
  selectionId: string,
  customNeighbourhood?: string,
): ResolvedMarketRentSubArea {
  if (!selectionId || selectionId === MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID) {
    return {};
  }

  if (selectionId === MARKET_RENT_SUB_AREA_OTHER_ID) {
    const trimmed = customNeighbourhood?.trim();
    return trimmed ? { matchingNeighbourhood: trimmed } : {};
  }

  const option = getMarketRentSubAreaOption(selectionId);
  if (!option) return {};

  const resolved: ResolvedMarketRentSubArea = {
    craigslistHostname: option.hostname,
  };
  if (option.craigslistQuery) {
    resolved.craigslistSearchArea = option.craigslistQuery;
  }
  if (option.matchingNeighbourhood?.trim()) {
    resolved.matchingNeighbourhood = option.matchingNeighbourhood.trim();
  }
  return resolved;
}

/**
 * Resolve the neighbourhood keyword for post-fetch matching from dropdown state.
 * Returns undefined when no neighbourhood filter should apply.
 */
export function resolveNeighbourhoodFromSubAreaSelection(
  selectionId: string,
  customNeighbourhood?: string,
): string | undefined {
  return resolveSubAreaForResearch(selectionId, customNeighbourhood).matchingNeighbourhood;
}

/** Optional data-quality note when a matching-only neighbourhood filter is active. */
export function buildSubAreaDataQualityNote(neighbourhood: string | undefined): string | undefined {
  const trimmed = neighbourhood?.trim();
  if (!trimmed) return undefined;
  return `Matching filter applied: ${trimmed} (not used in Craigslist query text).`;
}
