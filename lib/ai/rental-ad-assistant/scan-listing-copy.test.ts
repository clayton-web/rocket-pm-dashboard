import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeRentalAdAssistantOutput } from "./finalize-output";
import {
  formatListingReviewFlag,
  scanListingCopyForReview,
} from "./scan-listing-copy";
import type { RentalAdAssistantOutput } from "@/lib/validation/rental-ad-assistant";

const neutralOutput: RentalAdAssistantOutput = {
  suggestedAdvertisingRent: {
    conservative: 2200,
    recommended: 2400,
    aggressive: 2550,
    currency: "CAD",
  },
  confidence: "medium",
  confidenceReason: "Some comps.",
  explanation: "Suggested advertising rent only.",
  headline: "Bright 2BR condo near transit",
  fullDescription: "Spacious 2-bedroom condo with balcony and underground parking.",
  shortDescription: "2BR condo, parking, available July 1.",
  valueAddSuggestions: ["Highlight recent paint"],
};

describe("scanListingCopyForReview", () => {
  it("flags professionals only", () => {
    const flags = scanListingCopyForReview({
      headline: "Quiet suite for professionals only",
    });
    assert.ok(flags.includes("professionals_only"));
  });

  it("flags no children", () => {
    const flags = scanListingCopyForReview({
      fullDescription: "Ideal unit — no children please.",
    });
    assert.ok(flags.includes("no_children"));
  });

  it("flags source-of-income wording like must be employed", () => {
    const flags = scanListingCopyForReview({
      shortDescription: "Tenant must be employed full time.",
    });
    assert.ok(flags.includes("must_be_employed"));
  });

  it("does not flag normal neutral listing copy", () => {
    const flags = scanListingCopyForReview({
      headline: neutralOutput.headline,
      fullDescription: neutralOutput.fullDescription,
      shortDescription: neutralOutput.shortDescription,
    });
    assert.deepEqual(flags, []);
  });

  it("formats flags in plain language", () => {
    assert.match(formatListingReviewFlag("no_children"), /families with children/i);
    assert.match(formatListingReviewFlag("must_be_employed"), /income sources/i);
  });
});

describe("finalizeRentalAdAssistantOutput", () => {
  it("stores review flags when risky copy is present", () => {
    const finalized = finalizeRentalAdAssistantOutput({
      ...neutralOutput,
      fullDescription: "Professionals only — must be employed.",
    });
    assert.ok(finalized.reviewFlags?.includes("professionals_only"));
    assert.ok(finalized.reviewFlags?.includes("must_be_employed"));
  });

  it("removes reviewFlags when copy is neutral", () => {
    const finalized = finalizeRentalAdAssistantOutput({
      ...neutralOutput,
      reviewFlags: ["no_children"],
    });
    assert.equal(finalized.reviewFlags, undefined);
  });
});
