import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketRentOpenAiMessages,
  getMarketRentOpenAiSystemPrompt,
} from "./build-openai-prompt";

const context = {
  inputs: {
    city: "Vancouver",
    propertyType: "condo",
    bedrooms: 2,
    bathrooms: 1,
    sqft: 850,
  },
  statistics: {
    count: 4,
    median: 2800,
    mean: 2812.5,
    trimmedMean: 2812.5,
    min: 2750,
    max: 2900,
    p25: 2775,
    p75: 2875,
  },
  deterministicTiers: {
    conservative: 2750,
    recommended: 2800,
    aggressive: 2875,
    currency: "CAD" as const,
  },
  comparableListingsUsed: [
    {
      source: "craigslist" as const,
      sourceUrl: "https://example.com/1",
      title: "2BR condo",
      monthlyRent: 2800,
      bedrooms: 2,
      bathrooms: 1,
      sqft: 850,
      addressDisplay: "Kitsilano, Vancouver",
      matchScore: 80,
    },
  ],
  sourceBreakdown: { craigslist: 4, rew: 0 },
  dataQualityNotes: ["Sample note"],
  deterministicConfidence: "medium" as const,
  deterministicConfidenceReason: "Based on 4 comparable Craigslist listings.",
};

describe("buildMarketRentOpenAiMessages", () => {
  it("includes reference-only boundary in system prompt", () => {
    const prompt = getMarketRentOpenAiSystemPrompt();
    assert.match(prompt, /reference tool only/i);
    assert.match(prompt, /not official rent/i);
    assert.match(prompt, /not a lease rent/i);
    assert.match(prompt, /Official rent remains entered manually/i);
    assert.match(prompt, /Do NOT invent comparable listings/i);
  });

  it("excludes ad-copy instructions from system prompt", () => {
    const prompt = getMarketRentOpenAiSystemPrompt();
    assert.match(prompt, /Do NOT include rental ad copy/i);
    assert.doesNotMatch(prompt, /write a compelling headline/i);
    assert.doesNotMatch(prompt, /marketing description/i);
  });

  it("includes structured subject property and stats in user message", () => {
    const messages = buildMarketRentOpenAiMessages(context);
    assert.equal(messages.length, 2);
    assert.match(messages[1].content, /Vancouver/);
    assert.match(messages[1].content, /deterministicTierSeeds/);
    assert.match(messages[1].content, /rentStatistics/);
  });
});
