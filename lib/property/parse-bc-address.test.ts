import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseBcPropertyAddress,
  propertyImportDedupKey,
} from "./parse-bc-address";

describe("parseBcPropertyAddress", () => {
  it("parses a standard BC address", () => {
    const result = parseBcPropertyAddress("123 Main St, Vancouver, BC V6B 1A1");
    assert.ok(!("error" in result));
    assert.equal(result.streetLine1, "123 Main St");
    assert.equal(result.streetLine2, null);
    assert.equal(result.city, "Vancouver");
    assert.equal(result.province, "BC");
    assert.equal(result.postalCode, "V6B 1A1");
  });

  it("parses an address with a street line 2 segment", () => {
    const result = parseBcPropertyAddress("123 Main St, Unit 4, Vancouver, BC V6B 1A1");
    assert.ok(!("error" in result));
    assert.equal(result.streetLine1, "123 Main St");
    assert.equal(result.streetLine2, "Unit 4");
    assert.equal(result.city, "Vancouver");
  });

  it("rejects addresses without a postal code", () => {
    const result = parseBcPropertyAddress("123 Main St, Vancouver, BC");
    assert.ok("error" in result);
  });
});

describe("propertyImportDedupKey", () => {
  it("normalizes spacing and case", () => {
    const a = propertyImportDedupKey("123 Main St", "V6B 1A1");
    const b = propertyImportDedupKey(" 123  Main   St ", "v6b1a1");
    assert.equal(a, b);
  });
});
