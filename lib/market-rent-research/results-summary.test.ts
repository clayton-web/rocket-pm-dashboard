import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import type { MarketRentResearchResult } from "./types";
import {
  buildWhyThisRentBullets,
  formatComparableArea,
  formatComparableSpecs,
  formatMonthlyRent,
  isOpenAiRelatedNote,
  partitionDataQualityNotes,
} from "./results-summary";
import { MARKET_RENT_OPENAI_FALLBACK_NOTE } from "./synthesize-with-openai";

const inputs: MarketRentResearchInputs = {
  city: "Port Moody",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 2,
  sqft: 850,
  neighbourhood: "Glenayre",
};

const baseResult: MarketRentResearchResult = {
  suggestedRent: { conservative: 2600, recommended: 2725, aggressive: 2850, currency: "CAD" },
  confidence: "medium",
  confidenceReason: "Four similar comps support a mid-range estimate.",
  explanation: "Long AI paragraph that should not appear in PM summary.",
  explanationSource: "openai",
  comparableListingsUsed: [
    {
      source: "craigslist",
      sourceUrl: "https://example.com/1",
      title: "2BR condo",
      monthlyRent: 2650,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 850,
      addressDisplay: "Glenayre, Port Moody",
      matchScore: 80,
    },
  ],
  dataQualityNotes: ["Neighbourhood filter applied: Glenayre."],
  sourceBreakdown: { craigslist: 4, rew: 0 },
  providerStatuses: [{ source: "craigslist", status: "success", listingCount: 4 }],
  usedFixtureComps: false,
  statistics: { count: 4, median: 2700, mean: 2710, p25: 2600, p75: 2800, min: 2550, max: 2900 },
  excludedCount: 1,
  rawListingCount: 8,
};

describe("results-summary", () => {
  it("formats monthly rent for hero display", () => {
    assert.equal(formatMonthlyRent(2725), "$2,725/month");
  });

  it("builds concise why-this-rent bullets from result and inputs", () => {
    const bullets = buildWhyThisRentBullets(baseResult, inputs);
    assert.ok(bullets.some((line) => line.includes("4 comparable listings")));
    assert.ok(bullets.includes("Same property type"));
    assert.ok(bullets.includes("Same bedroom count"));
    assert.ok(bullets.includes("Similar square footage"));
    assert.ok(bullets.includes("Same neighbourhood / area"));
  });

  it("handles blank neighbourhood without crashing", () => {
    const bullets = buildWhyThisRentBullets(baseResult, {
      ...inputs,
      neighbourhood: undefined,
      postalCode: undefined,
      sqft: undefined,
    });
    assert.ok(bullets.includes("Same bedroom count"));
    assert.ok(!bullets.includes("Same neighbourhood / area"));
  });

  it("formats comparable card lines", () => {
    assert.equal(formatComparableSpecs(baseResult.comparableListingsUsed[0]), "2 Bed • 2 Bath • 850 sqft");
    assert.equal(formatComparableArea("Glenayre, Port Moody"), "Glenayre");
    assert.equal(formatComparableArea("Port Moody"), "Port Moody");
  });

  it("partitions OpenAI-related data quality notes", () => {
    const notes = [
      "Neighbourhood filter applied: Glenayre.",
      MARKET_RENT_OPENAI_FALLBACK_NOTE,
      "OpenAI request failed (401).",
    ];
    const { openAiNotes, otherNotes } = partitionDataQualityNotes(notes);
    assert.equal(openAiNotes.length, 2);
    assert.equal(otherNotes.length, 1);
    assert.equal(isOpenAiRelatedNote(MARKET_RENT_OPENAI_FALLBACK_NOTE), true);
  });
});
