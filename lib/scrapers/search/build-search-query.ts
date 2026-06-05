import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import type { CraigslistSearchParams, MarketRentSearchQuery } from "../types";

const CITY_SLUG_OVERRIDES: Record<string, string> = {
  vancouver: "vancouver",
  "vancouver bc": "vancouver",
  burnaby: "vancouver",
  richmond: "vancouver",
};

export function cityToCraigslistSlug(city: string): string {
  const normalized = city.trim().toLowerCase();
  return CITY_SLUG_OVERRIDES[normalized] ?? normalized.replace(/\s+/g, "");
}

export function buildCraigslistSearchText(inputs: MarketRentResearchInputs): string {
  const parts = [inputs.city.trim()];
  if (inputs.neighbourhood?.trim()) parts.push(inputs.neighbourhood.trim());
  parts.push(`${inputs.bedrooms}br`);
  if (inputs.propertyType.trim()) parts.push(inputs.propertyType.trim());
  return parts.join(" ");
}

export function buildMarketRentSearchQuery(inputs: MarketRentResearchInputs): MarketRentSearchQuery {
  return {
    ...inputs,
    craigslistCitySlug: cityToCraigslistSlug(inputs.city),
    searchText: buildCraigslistSearchText(inputs),
  };
}

export function buildCraigslistSearchParams(inputs: MarketRentResearchInputs): CraigslistSearchParams {
  return {
    citySlug: cityToCraigslistSlug(inputs.city),
    query: buildCraigslistSearchText(inputs),
    bedrooms: inputs.bedrooms,
  };
}
