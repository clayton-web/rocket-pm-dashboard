import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePropertyProfileFormInput } from "./property-profile";

describe("parsePropertyProfileFormInput", () => {
  it("accepts optional profile fields", () => {
    const parsed = parsePropertyProfileFormInput({
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 1.5,
      approxSqft: 850,
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, "condo");
    assert.equal(parsed.bedrooms, 2);
    assert.equal(parsed.bathrooms, 1.5);
    assert.equal(parsed.approxSqft, 850);
  });

  it("accepts empty profile fields", () => {
    const parsed = parsePropertyProfileFormInput({});
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, null);
    assert.equal(parsed.bedrooms, null);
    assert.equal(parsed.bathrooms, null);
    assert.equal(parsed.approxSqft, null);
  });

  it("rejects invalid property type", () => {
    const parsed = parsePropertyProfileFormInput({ propertyType: "castle" });
    assert.equal("error" in parsed && parsed.error, "Property type must be detached, condo, or townhouse");
  });

  it("rejects invalid bedrooms", () => {
    const parsed = parsePropertyProfileFormInput({ bedrooms: 51 });
    assert.match("error" in parsed ? parsed.error : "", /Bedrooms must be/);
  });

  it("rejects invalid bathrooms", () => {
    const parsed = parsePropertyProfileFormInput({ bathrooms: 1.3 });
    assert.match("error" in parsed ? parsed.error : "", /0\.5 increments/);
  });

  it("rejects invalid approx sqft", () => {
    const parsed = parsePropertyProfileFormInput({ approxSqft: 0 });
    assert.match("error" in parsed ? parsed.error : "", /Approx\. sqft/);
  });
});
