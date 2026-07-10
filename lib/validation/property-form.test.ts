import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCreatePropertyFormInput,
  parseCreateUnitFormInput,
  parsePropertyServiceRelationshipFormInput,
} from "./property-form";

describe("parseCreatePropertyFormInput", () => {
  it("accepts address fields and derives name from streetLine1", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      streetLine2: "Suite 2",
      city: "Vancouver",
      postalCode: "V6B 1A1",
      serviceRelationship: "MANAGED",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.name, "123 Main Street");
    assert.equal(parsed.streetLine1, "123 Main Street");
    assert.equal(parsed.province, "BC");
    assert.equal(parsed.streetLine2, "Suite 2");
    assert.equal(parsed.serviceRelationship, "MANAGED");
  });

  it("requires street address", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "",
      city: "Vancouver",
      postalCode: "V6B 1A1",
      serviceRelationship: "MANAGED",
    });
    assert.equal("error" in parsed && parsed.error, "Street address is required");
  });

  it("requires service relationship", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.ok("error" in parsed);
  });

  it("accepts placement-only and pre-management", () => {
    for (const serviceRelationship of ["PLACEMENT_ONLY", "PRE_MANAGEMENT"] as const) {
      const parsed = parseCreatePropertyFormInput({
        streetLine1: "123 Main Street",
        city: "Vancouver",
        postalCode: "V6B 1A1",
        serviceRelationship,
      });
      assert.ok(!("error" in parsed));
      if ("error" in parsed) return;
      assert.equal(parsed.serviceRelationship, serviceRelationship);
    }
  });

  it("accepts optional profile fields on create", () => {
    const parsed = parseCreatePropertyFormInput({
      streetLine1: "123 Main Street",
      city: "Vancouver",
      postalCode: "V6B 1A1",
      serviceRelationship: "MANAGED",
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
      serviceRelationship: "MANAGED",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyType, null);
    assert.equal(parsed.bedrooms, null);
  });
});

describe("parsePropertyServiceRelationshipFormInput", () => {
  it("accepts valid values", () => {
    const parsed = parsePropertyServiceRelationshipFormInput({
      serviceRelationship: "PLACEMENT_ONLY",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.serviceRelationship, "PLACEMENT_ONLY");
  });

  it("rejects invalid values", () => {
    const parsed = parsePropertyServiceRelationshipFormInput({ serviceRelationship: "ACTIVE" });
    assert.ok("error" in parsed);
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
