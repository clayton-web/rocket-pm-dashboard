import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarketRentResearchInputs } from "./market-rent-research";

const validInputs = {
  city: "Vancouver",
  neighbourhood: "Kitsilano",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
  parking: "1 underground stall",
  furnished: "unfurnished",
  petPolicy: "Cats allowed with deposit",
  notes: "Corner unit with balcony",
};

describe("parseMarketRentResearchInputs", () => {
  it("accepts valid research inputs", () => {
    const parsed = parseMarketRentResearchInputs(validInputs);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.city, "Vancouver");
    assert.equal(parsed.neighbourhood, "Kitsilano");
    assert.equal(parsed.bedrooms, 2);
    assert.equal(parsed.sqft, 850);
    assert.equal(parsed.furnished, "unfurnished");
  });

  it("rejects invalid bedroom numbers", () => {
    const parsed = parseMarketRentResearchInputs({ ...validInputs, bedrooms: -1 });
    assert.match("error" in parsed ? parsed.error : "", /Bedrooms/);
  });

  it("rejects invalid bathroom numbers", () => {
    const parsed = parseMarketRentResearchInputs({ ...validInputs, bathrooms: 0 });
    assert.match("error" in parsed ? parsed.error : "", /Bathrooms/);
  });

  it("rejects invalid sqft when provided", () => {
    const parsed = parseMarketRentResearchInputs({ ...validInputs, sqft: "abc" });
    assert.match("error" in parsed ? parsed.error : "", /Square footage/);
  });

  it("does not accept monthlyRent as an input field", () => {
    const parsed = parseMarketRentResearchInputs({
      ...validInputs,
      monthlyRent: 2500,
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal("monthlyRent" in parsed, false);
  });
});
