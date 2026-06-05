/** Blank selection — no neighbourhood filter applied. */
export const MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID = "";

/** Dropdown value when the PM enters a custom sub-area. */
export const MARKET_RENT_SUB_AREA_OTHER_ID = "__other__";

export type MarketRentSubAreaOption = {
  id: string;
  city: string;
  /** Display label within the city group (neighbourhood name or city-wide). */
  label: string;
  /** Keyword sent to Craigslist search and matching; null for city-wide. */
  neighbourhood: string | null;
};

function citySlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-");
}

function neighbourhoodSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function buildCityOptions(city: string, neighbourhoods: string[]): MarketRentSubAreaOption[] {
  const slug = citySlug(city);
  const options: MarketRentSubAreaOption[] = [
    {
      id: `${slug}:city-wide`,
      city,
      label: "City-wide",
      neighbourhood: null,
    },
  ];
  for (const neighbourhood of neighbourhoods) {
    options.push({
      id: `${slug}:${neighbourhoodSlug(neighbourhood)}`,
      city,
      label: neighbourhood,
      neighbourhood,
    });
  }
  return options;
}

/** Metro Vancouver and Fraser Valley sub-areas for PM rent research. */
export const MARKET_RENT_SUB_AREA_OPTIONS: MarketRentSubAreaOption[] = [
  ...buildCityOptions("Vancouver", [
    "Kitsilano",
    "Downtown",
    "West End",
    "Fairview",
    "Mount Pleasant",
    "Commercial Drive",
    "East Vancouver",
    "Kerrisdale",
    "Dunbar",
    "Marpole",
    "Renfrew Heights",
    "South Granville",
  ]),
  ...buildCityOptions("Burnaby", [
    "Metrotown",
    "Brentwood",
    "Edmonds",
    "Deer Lake",
    "Lougheed",
    "Highgate",
    "Capitol Hill",
  ]),
  ...buildCityOptions("New Westminster", [
    "Downtown",
    "Uptown",
    "Queensborough",
    "Sapperton",
    "West End",
  ]),
  ...buildCityOptions("Richmond", [
    "City Centre",
    "Steveston",
    "Brighouse",
    "Ironwood",
    "Terra Nova",
    "East Richmond",
  ]),
  ...buildCityOptions("North Vancouver", [
    "Lower Lonsdale",
    "Central Lonsdale",
    "Lynn Valley",
    "Edgemont",
    "Deep Cove",
    "Capilano",
  ]),
  ...buildCityOptions("West Vancouver", [
    "Ambleside",
    "Dundarave",
    "Park Royal",
    "Horseshoe Bay",
    "Caulfeild",
  ]),
  ...buildCityOptions("Coquitlam", [
    "Burke Mountain",
    "Westwood Plateau",
    "Maillardville",
    "Austin Heights",
    "Coquitlam Centre",
  ]),
  ...buildCityOptions("Port Coquitlam", ["Citadel", "Mary Hill", "Central", "Westwood"]),
  ...buildCityOptions("Port Moody", [
    "Glenayre",
    "Moody Centre",
    "Newport Village",
    "Heritage Mountain",
    "Inlet Centre",
  ]),
  ...buildCityOptions("Surrey", [
    "Whalley",
    "Guildford",
    "Newton",
    "Cloverdale",
    "South Surrey",
    "Fleetwood",
    "Fraser Heights",
    "Panorama",
  ]),
  ...buildCityOptions("Langley", [
    "Willoughby",
    "Walnut Grove",
    "Murrayville",
    "Brookswood",
    "Fort Langley",
    "Aldergrove",
  ]),
  ...buildCityOptions("Maple Ridge", [
    "Town Centre",
    "Haney",
    "Silver Valley",
    "Albion",
    "Whonnock",
  ]),
  ...buildCityOptions("Pitt Meadows", ["Central", "Meadows", "North Pitt Meadows"]),
  ...buildCityOptions("Delta", [
    "Ladner",
    "North Delta",
    "Tsawwassen",
    "Sunshine Hills",
    "Scottsdale",
  ]),
  ...buildCityOptions("White Rock", ["White Rock", "Ocean Park", "Semiahmoo"]),
  ...buildCityOptions("Abbotsford", ["Central", "McMillan", "Clearbrook", "Sumas Mountain"]),
  ...buildCityOptions("Mission", ["Downtown", "Hatzic", "Silverdale"]),
  ...buildCityOptions("Chilliwack", ["Downtown", "Sardis", "Vedder Crossing", "Promontory"]),
];

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
    (option) =>
      option.city.toLowerCase() === normalized && option.neighbourhood === null,
  );
  return cityWide?.id ?? MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID;
}

/**
 * Resolve the neighbourhood keyword for research inputs from dropdown state.
 * Returns undefined when no neighbourhood filter should apply.
 */
export function resolveNeighbourhoodFromSubAreaSelection(
  selectionId: string,
  customNeighbourhood?: string,
): string | undefined {
  if (!selectionId || selectionId === MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID) {
    return undefined;
  }

  if (selectionId === MARKET_RENT_SUB_AREA_OTHER_ID) {
    const trimmed = customNeighbourhood?.trim();
    return trimmed || undefined;
  }

  const option = getMarketRentSubAreaOption(selectionId);
  if (!option) return undefined;
  return option.neighbourhood?.trim() || undefined;
}

/** Optional data-quality note when a neighbourhood filter is active. */
export function buildSubAreaDataQualityNote(neighbourhood: string | undefined): string | undefined {
  const trimmed = neighbourhood?.trim();
  if (!trimmed) return undefined;
  return `Neighbourhood filter applied: ${trimmed}.`;
}
