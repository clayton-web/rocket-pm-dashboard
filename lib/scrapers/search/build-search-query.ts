import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { parseNearbyAreas } from "@/lib/market-rent-research/matching";
import { cityToCraigslistHostname } from "../providers/craigslist/craigslist-hostname";
import type { CraigslistSearchParams, MarketRentSearchQuery } from "../types";

export { cityToCraigslistHostname, cityToCraigslistSlug } from "../providers/craigslist/craigslist-hostname";

export function buildCraigslistSearchText(inputs: MarketRentResearchInputs): string {
  const parts = [inputs.city.trim()];
  if (inputs.postalCode?.trim()) parts.push(inputs.postalCode.trim());
  if (inputs.neighbourhood?.trim()) parts.push(inputs.neighbourhood.trim());
  for (const area of parseNearbyAreas(inputs.nearbyAreas)) {
    parts.push(area);
  }
  parts.push(`${inputs.bedrooms}br`);
  if (inputs.propertyType.trim()) parts.push(inputs.propertyType.trim());
  return parts.join(" ");
}

export function buildMarketRentSearchQuery(inputs: MarketRentResearchInputs): MarketRentSearchQuery {
  const hostname = cityToCraigslistHostname(inputs.city);
  return {
    ...inputs,
    craigslistCitySlug: hostname,
    searchText: buildCraigslistSearchText(inputs),
  };
}

export function buildCraigslistSearchParams(inputs: MarketRentResearchInputs): CraigslistSearchParams {
  const bedrooms = inputs.bedrooms;
  return {
    citySlug: cityToCraigslistHostname(inputs.city),
    query: buildCraigslistSearchText(inputs),
    bedrooms,
    minBedrooms: Math.max(0, bedrooms - 1),
    maxBedrooms: bedrooms + 1,
  };
}
