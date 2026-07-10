import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRentalListingFormInput } from "./rental-listing";

describe("parseRentalListingFormInput", () => {
  it("accepts a complete listing form", () => {
    const parsed = parseRentalListingFormInput({
      monthlyRent: "2200",
      availableDate: "2026-08-01",
      bedrooms: "2",
      bathrooms: "1.5",
      approxSqft: "850",
      headline: "Bright suite",
      description: "Near transit.",
      petPolicy: "Cats ok",
      parkingDetails: "1 stall",
      utilitiesDetails: "Hydro extra",
      viewingInstructions: "Evenings preferred",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.monthlyRent, 2200);
    assert.equal(parsed.availableDate, "2026-08-01");
    assert.equal(parsed.bedrooms, 2);
    assert.equal(parsed.bathrooms, 1.5);
    assert.equal(parsed.headline, "Bright suite");
  });

  it("allows empty draft fields", () => {
    const parsed = parseRentalListingFormInput({});
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.monthlyRent, null);
    assert.equal(parsed.headline, null);
  });

  it("rejects non-positive rent", () => {
    const parsed = parseRentalListingFormInput({ monthlyRent: "0" });
    assert.ok("error" in parsed);
  });

  it("rejects invalid bathrooms increment", () => {
    const parsed = parseRentalListingFormInput({ bathrooms: "1.25" });
    assert.ok("error" in parsed);
  });
});
