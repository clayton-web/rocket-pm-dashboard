import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRentalAdAssistantCompsSnapshot,
  parseRentalAdAssistantInputs,
  parseRentalAdAssistantOutput,
} from "./rental-ad-assistant";

const validInputs = {
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
  parking: "1 underground stall",
  utilitiesIncluded: ["water", "heat"],
  petPolicy: "Cats allowed with deposit",
  furnished: "unfurnished",
  availableDate: "2026-07-01",
  notes: "Corner unit with balcony",
  targetRentHint: 2400,
};

const validOutput = {
  suggestedAdvertisingRent: {
    conservative: 2200,
    recommended: 2400,
    aggressive: 2550,
    currency: "CAD",
  },
  confidence: "medium",
  confidenceReason: "Limited portfolio comps in this city.",
  explanation: "Based on two historical lease rents and current inputs.",
  headline: "Bright 2BR condo near transit",
  fullDescription: "Spacious 2-bedroom condo with balcony and underground parking.",
  shortDescription: "2BR condo, 1 bath, parking, available July 1.",
  valueAddSuggestions: ["Highlight in-suite laundry if added"],
  reviewFlags: [],
};

describe("parseRentalAdAssistantInputs", () => {
  it("accepts valid draft inputs including targetRentHint", () => {
    const parsed = parseRentalAdAssistantInputs(validInputs);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, "condo");
    assert.equal(parsed.bedrooms, 2);
    assert.equal(parsed.targetRentHint, 2400);
    assert.deepEqual(parsed.utilitiesIncluded, ["water", "heat"]);
  });

  it("rejects missing property type", () => {
    const parsed = parseRentalAdAssistantInputs({ ...validInputs, propertyType: "" });
    assert.equal("error" in parsed && parsed.error, "Property type is required");
  });

  it("rejects invalid furnished value", () => {
    const parsed = parseRentalAdAssistantInputs({ ...validInputs, furnished: "sometimes" });
    assert.equal(
      "error" in parsed && parsed.error,
      "Furnished must be furnished, unfurnished, or partial",
    );
  });

  it("does not accept monthlyRent as an input field", () => {
    const parsed = parseRentalAdAssistantInputs({
      ...validInputs,
      monthlyRent: 2500,
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal("monthlyRent" in parsed, false);
  });
});

describe("parseRentalAdAssistantOutput", () => {
  it("accepts suggestedAdvertisingRent instead of monthlyRent", () => {
    const parsed = parseRentalAdAssistantOutput(validOutput);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.suggestedAdvertisingRent.recommended, 2400);
    assert.equal(parsed.suggestedAdvertisingRent.currency, "CAD");
    assert.equal("monthlyRent" in parsed, false);
  });

  it("rejects output missing suggestedAdvertisingRent", () => {
    const parsed = parseRentalAdAssistantOutput({
      ...validOutput,
      suggestedAdvertisingRent: undefined,
    });
    assert.equal("error" in parsed && parsed.error, "Suggested advertising rent is required");
  });

  it("rejects non-CAD currency", () => {
    const parsed = parseRentalAdAssistantOutput({
      ...validOutput,
      suggestedAdvertisingRent: {
        ...validOutput.suggestedAdvertisingRent,
        currency: "USD",
      },
    });
    assert.equal(
      "error" in parsed && parsed.error,
      "Suggested advertising rent currency must be CAD",
    );
  });
});

describe("parseRentalAdAssistantCompsSnapshot", () => {
  it("labels historical lease rents distinctly from advertising rent", () => {
    const parsed = parseRentalAdAssistantCompsSnapshot({
      label: "Historical lease rents (signed leases in your portfolio)",
      count: 1,
      median: 2300,
      min: 2300,
      max: 2300,
      samples: [
        {
          propertyDisplay: "123 Main St",
          bedrooms: 2,
          monthlyLeaseRent: 2300,
          leaseStartDate: "2025-01-01",
        },
      ],
      query: { city: "Vancouver", bedroomsMin: 1, bedroomsMax: 3 },
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.match(parsed.label, /Historical lease rents/);
    assert.equal(parsed.samples[0]?.monthlyLeaseRent, 2300);
  });
});
