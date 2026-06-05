import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { parseNearbyAreas } from "@/lib/market-rent-research/matching";
import type { CraigslistSearchParams, MarketRentSearchQuery } from "../types";

const CITY_SLUG_OVERRIDES: Record<string, string> = {
  vancouver: "vancouver",
  "vancouver bc": "vancouver",
  burnaby: "vancouver",
  richmond: "vancouver",
  "port moody": "vancouver",
  "port coquitlam": "vancouver",
  coquitlam: "vancouver",
  "new westminster": "vancouver",
  "north vancouver": "vancouver",
  "west vancouver": "vancouver",
  surrey: "vancouver",
  langley: "vancouver",
  "maple ridge": "vancouver",
  "pitt meadows": "vancouver",
  delta: "vancouver",
  "white rock": "vancouver",
  abbotsford: "vancouver",
  mission: "vancouver",
  chilliwack: "vancouver",
};

export function cityToCraigslistSlug(city: string): string {
  const normalized = city.trim().toLowerCase();
  return CITY_SLUG_OVERRIDES[normalized] ?? normalized.replace(/\s+/g, "");
}

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
