import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areRentTiersMonotonic,
  areRentTiersWithinCompGuardrails,
  parseOpenAiMarketRentOutput,
} from "./parse-openai-output";

const deterministicTiers = {
  conservative: 2500,
  recommended: 2700,
  aggressive: 2900,
  currency: "CAD" as const,
};

const compRents = [2400, 2500, 2700, 2900, 3000];

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    suggestedRent: {
      conservative: 2500,
      recommended: 2700,
      aggressive: 2900,
      currency: "CAD",
    },
    confidence: "high",
    confidenceReason: "Strong comp alignment.",
    explanation: "Comps cluster around $2,700 with similar beds and baths.",
    comparableListingsUsed: [],
    dataQualityNotes: [],
    ...overrides,
  };
}

describe("parseOpenAiMarketRentOutput", () => {
  it("accepts valid result", () => {
    const result = parseOpenAiMarketRentOutput(validOutput(), {
      compRents,
      maxConfidence: "high",
      deterministicTiers,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.parsed.tiersValid, true);
    assert.equal(result.parsed.suggestedRent?.recommended, 2700);
    assert.match(result.parsed.explanation, /Comps cluster/);
  });

  it("rejects missing rent tiers", () => {
    const result = parseOpenAiMarketRentOutput(
      validOutput({ suggestedRent: { recommended: 2700, currency: "CAD" } }),
      { compRents, maxConfidence: "medium", deterministicTiers },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /missing valid suggestedRent/i);
  });

  it("discards non-monotonic tiers while keeping explanation", () => {
    const result = parseOpenAiMarketRentOutput(
      validOutput({
        suggestedRent: {
          conservative: 2900,
          recommended: 2700,
          aggressive: 2500,
          currency: "CAD",
        },
      }),
      { compRents, maxConfidence: "medium", deterministicTiers },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.parsed.tiersValid, false);
    assert.equal(result.parsed.suggestedRent, null);
  });

  it("downgrades overconfident output", () => {
    const result = parseOpenAiMarketRentOutput(validOutput({ confidence: "high" }), {
      compRents,
      maxConfidence: "medium",
      deterministicTiers,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.parsed.confidence, "medium");
  });

  it("discards tier numbers outside guardrails", () => {
    const result = parseOpenAiMarketRentOutput(
      validOutput({
        suggestedRent: {
          conservative: 2000,
          recommended: 2100,
          aggressive: 2200,
          currency: "CAD",
        },
      }),
      { compRents, maxConfidence: "high", deterministicTiers },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.parsed.tiersValid, false);
    assert.equal(result.parsed.suggestedRent, null);
  });
});

describe("rent tier guardrail helpers", () => {
  it("checks monotonic tiers", () => {
    assert.equal(
      areRentTiersMonotonic({ conservative: 2500, recommended: 2700, aggressive: 2900, currency: "CAD" }),
      true,
    );
    assert.equal(
      areRentTiersMonotonic({ conservative: 2900, recommended: 2700, aggressive: 2500, currency: "CAD" }),
      false,
    );
  });

  it("checks comp guardrails", () => {
    assert.equal(
      areRentTiersWithinCompGuardrails(
        { conservative: 2500, recommended: 2700, aggressive: 3300, currency: "CAD" },
        compRents,
      ),
      true,
    );
    assert.equal(
      areRentTiersWithinCompGuardrails(
        { conservative: 2000, recommended: 2100, aggressive: 2200, currency: "CAD" },
        compRents,
      ),
      false,
    );
  });
});
