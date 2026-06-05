import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { MARKET_RENT_LIMITED_SAMPLE_NOTE } from "./constants";
import {
  MARKET_RENT_OPENAI_FALLBACK_NOTE,
  MARKET_RENT_OPENAI_TIERS_FALLBACK_NOTE,
} from "./synthesize-with-openai";
import type { MarketRentComparableListing, MarketRentResearchResult } from "./types";

export function formatMonthlyRent(amount: number): string {
  return `$${amount.toLocaleString("en-CA")}/month`;
}

export function formatConfidenceLabel(confidence: MarketRentResearchResult["confidence"]): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

/** PM-facing bullet points — derived from existing result data only. */
export function buildWhyThisRentBullets(
  result: MarketRentResearchResult,
  inputs: MarketRentResearchInputs,
): string[] {
  const bullets: string[] = [];
  const count = result.statistics.count;

  if (result.confidence === "low") {
    bullets.push("Low confidence — limited comparable data");
  }

  if (count > 0) {
    bullets.push(`${count} comparable listing${count === 1 ? "" : "s"} found`);
  }

  if (count > 0 && count < 3) {
    bullets.push(MARKET_RENT_LIMITED_SAMPLE_NOTE);
  }

  if (inputs.propertyType.trim()) {
    bullets.push("Same property type");
  }

  bullets.push("Same bedroom count");

  if (inputs.bathrooms > 0) {
    bullets.push("Similar bathroom count");
  }

  if (inputs.sqft != null && inputs.sqft > 0) {
    bullets.push("Similar square footage");
  }

  if (inputs.neighbourhood?.trim()) {
    bullets.push("Same neighbourhood / area");
  } else if (inputs.postalCode?.trim()) {
    bullets.push("Same postal code area");
  }

  if (bullets.length === 0) {
    bullets.push("Limited comparable data available");
  }

  return bullets;
}

export function formatComparableSpecs(listing: MarketRentComparableListing): string {
  const parts: string[] = [];
  if (listing.bedrooms != null) parts.push(`${listing.bedrooms} Bed`);
  if (listing.bathrooms != null) parts.push(`${listing.bathrooms} Bath`);
  if (listing.sqft != null) parts.push(`${listing.sqft.toLocaleString("en-CA")} sqft`);
  return parts.join(" • ");
}

/** Prefer neighbourhood label from addressDisplay (e.g. "Glenayre, Port Moody" → "Glenayre"). */
export function formatComparableArea(addressDisplay: string): string {
  const commaIndex = addressDisplay.indexOf(",");
  if (commaIndex > 0) return addressDisplay.slice(0, commaIndex).trim();
  return addressDisplay.trim();
}

export function isOpenAiRelatedNote(note: string): boolean {
  const lower = note.toLowerCase();
  return (
    note.includes(MARKET_RENT_OPENAI_FALLBACK_NOTE) ||
    note.includes(MARKET_RENT_OPENAI_TIERS_FALLBACK_NOTE) ||
    lower.includes("openai")
  );
}

export function partitionDataQualityNotes(notes: string[]): {
  openAiNotes: string[];
  otherNotes: string[];
} {
  const openAiNotes: string[] = [];
  const otherNotes: string[] = [];
  for (const note of notes) {
    if (isOpenAiRelatedNote(note)) openAiNotes.push(note);
    else otherNotes.push(note);
  }
  return { openAiNotes, otherNotes };
}
