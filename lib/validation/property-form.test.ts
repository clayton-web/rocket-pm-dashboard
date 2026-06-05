import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreatePropertyFormInput, parseCreateUnitFormInput } from "./property-form";

describe("parseCreatePropertyFormInput", () => {
  it("accepts address fields and derives name from streetLine1", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      streetLine2: "Suite 2",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.name, "123 Main Street");
    assert.equal(parsed.streetLine1, "123 Main Street");
    assert.equal(parsed.province, "BC");
    assert.equal(parsed.streetLine2, "Suite 2");
  });

  it("requires street address", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.equal("error" in parsed && parsed.error, "Street address is required");
  });

  it("accepts optional profile fields on create", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      city: "Vancouver",
      postalCode: "V6B 1A1",
      propertyType: "detached",
      bedrooms: 3,
      bathrooms: 2,
      approxSqft: 1200,
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, "detached");
    assert.equal(parsed.bedrooms, 3);
    assert.equal(parsed.bathrooms, 2);
    assert.equal(parsed.approxSqft, 1200);
  });

  it("works without profile fields", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, null);
    assert.equal(parsed.bedrooms, null);
  });
});

describe("parseCreateUnitFormInput", () => {
  it("accepts unit number with optional floor and bedrooms", () => {
    const parsed = parseCreateUnitFormInput({
      unitNumber: "201",
      floor: "2",
      bedrooms: 2,
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.unitNumber, "201");
    assert.equal(parsed.bedrooms, 2);
  });

  it("accepts descriptive unit labels", () => {
    const parsed = parseCreateUnitFormInput({ unitNumber: "Basement" });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.unitNumber, "Basement");
  });

  it("requires unit number", () => {
    const parsed = parseCreateUnitFormInput({ unitNumber: "  " });
    assert.equal("error" in parsed && parsed.error, "Unit number is required");
  });
});
