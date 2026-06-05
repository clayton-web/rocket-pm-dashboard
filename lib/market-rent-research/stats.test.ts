import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeConfidenceFromCompCount,
  computeDeterministicSuggestedRent,
  computeRentStatistics,
  removeIqrOutliers,
  roundToNearest25,
} from "./stats";

describe("computeRentStatistics", () => {
  it("computes median, mean, p25, and p75", () => {
    const stats = computeRentStatistics([2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400]);

    assert.equal(stats.count, 8);
    assert.equal(stats.median, 2700);
    assert.equal(stats.mean, 2700);
    assert.equal(stats.p25, 2350);
    assert.equal(stats.p75, 3050);
    assert.equal(stats.min, 2000);
    assert.equal(stats.max, 3400);
    assert.ok(stats.trimmedMean != null);
  });
});

describe("removeIqrOutliers", () => {
  it("removes extreme rents when sample size allows", () => {
    const rents = [2400, 2450, 2500, 2550, 5000];
    const { kept, removed } = removeIqrOutliers(rents);
    assert.deepEqual(kept, [2400, 2450, 2500, 2550]);
    assert.deepEqual(removed, [5000]);
  });
});

describe("computeDeterministicSuggestedRent", () => {
  it("returns conservative, recommended, and aggressive tiers rounded to $25", () => {
    const stats = computeRentStatistics([2400, 2450, 2500, 2550, 2600, 2650, 2700, 2750]);
    const tiers = computeDeterministicSuggestedRent(stats);

    assert.ok(tiers);
    assert.equal(tiers.recommended, roundToNearest25(stats.median!));
    assert.equal(tiers.conservative % 25, 0);
    assert.equal(tiers.recommended % 25, 0);
    assert.equal(tiers.aggressive % 25, 0);
    assert.ok(tiers.conservative <= tiers.recommended);
    assert.ok(tiers.recommended <= tiers.aggressive);
    assert.equal(tiers.currency, "CAD");
  });
});

describe("computeConfidenceFromCompCount", () => {
  it("returns low confidence for fewer than 3 comps", () => {
    const result = computeConfidenceFromCompCount(2, 0);
    assert.equal(result.confidence, "low");
    assert.match(result.reason, /Insufficient sample size/i);
  });

  it("returns medium confidence for 3–7 comps", () => {
    const result = computeConfidenceFromCompCount(5, 0);
    assert.equal(result.confidence, "medium");
  });

  it("returns high confidence for 8+ comps with complete fields", () => {
    const result = computeConfidenceFromCompCount(10, 0.1);
    assert.equal(result.confidence, "high");
  });
});
