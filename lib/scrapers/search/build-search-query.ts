import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { cityToCraigslistHostname } from "../providers/craigslist/craigslist-hostname";
import type { CraigslistSearchParams, MarketRentSearchQuery } from "../types";

export { cityToCraigslistHostname, cityToCraigslistSlug } from "../providers/craigslist/craigslist-hostname";

/**
 * Craigslist SAPI query text — broad area terms only.
 * Postal codes, neighbourhoods, and nearby areas are excluded; use matching/scoring after fetch.
 */
export function buildCraigslistSearchText(inputs: MarketRentResearchInputs): string {
  const areaPart = inputs.craigslistSearchArea?.trim() || inputs.city.trim();
  const parts = [areaPart, `${inputs.bedrooms}br`];
  if (inputs.propertyType.trim()) parts.push(inputs.propertyType.trim());
  return parts.join(" ");
}

export function buildMarketRentSearchQuery(inputs: MarketRentResearchInputs): MarketRentSearchQuery {
  const hostname = inputs.craigslistHostname?.trim() || cityToCraigslistHostname(inputs.city);
  return {
    ...inputs,
    craigslistCitySlug: hostname,
    searchText: buildCraigslistSearchText(inputs),
  };
}

export function buildCraigslistSearchParams(inputs: MarketRentResearchInputs): CraigslistSearchParams {
  const bedrooms = inputs.bedrooms;
  return {
    citySlug: inputs.craigslistHostname?.trim() || cityToCraigslistHostname(inputs.city),
    query: buildCraigslistSearchText(inputs),
    bedrooms,
    minBedrooms: Math.max(0, bedrooms - 1),
    maxBedrooms: bedrooms + 1,
  };
}
