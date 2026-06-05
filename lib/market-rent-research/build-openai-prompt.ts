import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import type { MarketRentChatMessage } from "./openai-client";
import type {
  MarketRentComparableListing,
  MarketRentResearchResult,
  MarketRentSuggestedRent,
} from "./types";
import type { RentStatistics } from "./stats";

export type MarketRentOpenAiPromptContext = {
  inputs: MarketRentResearchInputs;
  statistics: RentStatistics;
  deterministicTiers: MarketRentSuggestedRent;
  comparableListingsUsed: MarketRentComparableListing[];
  sourceBreakdown: MarketRentResearchResult["sourceBreakdown"];
  dataQualityNotes: string[];
  deterministicConfidence: MarketRentResearchResult["confidence"];
  deterministicConfidenceReason: string;
};

const SYSTEM_PROMPT = `You are a market rent research assistant for property managers in British Columbia.

This is a reference tool only. Your output supports suggested advertising rent tiers — not official rent, not a lease rent, and not a guarantee. Official rent remains entered manually when creating a tenancy.

Rules:
- Use ONLY the structured subject property, statistics, tier seeds, comparable listings, source breakdown, and data quality notes provided.
- Do NOT invent comparable listings or use data outside the provided comps.
- Do NOT scrape, recalculate, or replace the provided rent statistics.
- Do NOT include rental ad copy, headlines, descriptions, marketing text, or listing body content.
- Return JSON only with the exact schema requested.
- suggestedRent tiers must stay monotonic: conservative <= recommended <= aggressive.
- Adjust tier numbers only slightly from the provided deterministic seeds when justified by the comps.
- confidence must reflect sample size and data quality; do not overstate certainty.`;

export function buildMarketRentOpenAiMessages(
  context: MarketRentOpenAiPromptContext,
): MarketRentChatMessage[] {
  const payload = {
    subjectProperty: context.inputs,
    rentStatistics: context.statistics,
    deterministicTierSeeds: context.deterministicTiers,
    deterministicConfidence: context.deterministicConfidence,
    deterministicConfidenceReason: context.deterministicConfidenceReason,
    comparableListingsUsed: context.comparableListingsUsed.map((listing) => ({
      source: listing.source,
      sourceUrl: listing.sourceUrl,
      monthlyRent: listing.monthlyRent,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      sqft: listing.sqft,
      addressDisplay: listing.addressDisplay,
      matchScore: listing.matchScore,
    })),
    sourceBreakdown: context.sourceBreakdown,
    dataQualityNotes: context.dataQualityNotes,
  };

  const userPrompt = `Synthesize market rent research from the structured data below.

Return JSON with this shape:
{
  "suggestedRent": {
    "conservative": number,
    "recommended": number,
    "aggressive": number,
    "currency": "CAD"
  },
  "confidence": "high" | "medium" | "low",
  "confidenceReason": string,
  "explanation": string,
  "comparableListingsUsed": [],
  "dataQualityNotes": string[]
}

The explanation should summarize how the comps support the suggested advertising rent tiers in plain language for a property manager. Keep comparableListingsUsed identical to the provided list (same entries). You may add brief dataQualityNotes only when supported by the provided notes.

Structured input:
${JSON.stringify(payload, null, 2)}`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
}

/** Exported for tests — system prompt boundary copy. */
export function getMarketRentOpenAiSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
