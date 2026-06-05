import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreatePropertyFormInput, parseCreateUnitFormInput } from "./property-form";

describe("parseCreatePropertyFormInput", () => {
  it("accepts required fields with optional street line 2", () => {
    const parsed = parseCreatePropertyFormInput({
      name: "Harbourview",
      streetLine1: "100 Main St",
      streetLine2: "Suite 2",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.province, "BC");
    assert.equal(parsed.streetLine2, "Suite 2");
  });

  it("requires property name", () => {
    const parsed = parseCreatePropertyFormInput({
      name: "",
      streetLine1: "100 Main St",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.equal("error" in parsed && parsed.error, "Property name is required");
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

  it("requires unit number", () => {
    const parsed = parseCreateUnitFormInput({ unitNumber: "  " });
    assert.equal("error" in parsed && parsed.error, "Unit number is required");
  });
});
