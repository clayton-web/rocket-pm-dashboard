import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeIntegrationEmail,
  normalizeStreetLineKey,
  normalizeUnitKey,
  parseAddressHint,
} from "./normalize-address-hint";

describe("normalizeStreetLineKey", () => {
  it("canonicalizes case, punctuation, and whitespace", () => {
    const expected = "123 main street";
    for (const input of ["123 Main Street", "  123   main street  ", "123 Main St.", "123 Main St"]) {
      assert.equal(normalizeStreetLineKey(input), expected, input);
    }
  });

  it("expands standard street types and directionals", () => {
    assert.equal(normalizeStreetLineKey("456 Oak Ave W"), "456 Oak Avenue West".toLowerCase());
    assert.equal(normalizeStreetLineKey("12 Cedar Cres NE"), "12 cedar crescent northeast");
    assert.equal(normalizeStreetLineKey("8 Fir Blvd"), "8 fir boulevard");
  });

  it("does not collapse genuinely different addresses", () => {
    assert.notEqual(normalizeStreetLineKey("123 Main St"), normalizeStreetLineKey("12 Main St"));
    assert.notEqual(normalizeStreetLineKey("123 Main St"), normalizeStreetLineKey("123 Maine St"));
    assert.notEqual(normalizeStreetLineKey("123 Main St"), normalizeStreetLineKey("123 Main Ave"));
  });

  it("returns an empty key for blank input", () => {
    assert.equal(normalizeStreetLineKey("   "), "");
  });
});

describe("normalizeUnitKey", () => {
  it("strips unit prefixes and punctuation", () => {
    for (const input of ["204", "#204", "Unit 204", "unit 204", "Apt. 204", "Suite 204", "Ste 204"]) {
      assert.equal(normalizeUnitKey(input), "204", input);
    }
  });

  it("keeps alphanumeric unit labels distinct", () => {
    assert.equal(normalizeUnitKey("204A"), "204a");
    assert.notEqual(normalizeUnitKey("204"), normalizeUnitKey("204a"));
    assert.equal(normalizeUnitKey("Entire Property"), "entire property");
  });
});

describe("parseAddressHint", () => {
  it("splits a leading dash unit from the street line", () => {
    assert.deepEqual(parseAddressHint("204-123 Main St"), {
      streetKey: "123 main street",
      unitKey: "204",
    });
    assert.deepEqual(parseAddressHint("204 - 123 Main Street"), {
      streetKey: "123 main street",
      unitKey: "204",
    });
  });

  it("splits a leading hash unit from the street line", () => {
    assert.deepEqual(parseAddressHint("#204 123 Main St"), {
      streetKey: "123 main street",
      unitKey: "204",
    });
  });

  it("does not mistake a hyphenated street number for a unit", () => {
    // No digit follows the dash-and-space form here, so the whole value stays a street line.
    assert.deepEqual(parseAddressHint("123 Main St"), {
      streetKey: "123 main street",
      unitKey: null,
    });
    assert.equal(parseAddressHint("1200 West Georgia Street").unitKey, null);
  });

  it("returns an empty street key for blank input", () => {
    assert.deepEqual(parseAddressHint("  "), { streetKey: "", unitKey: null });
  });
});

describe("normalizeIntegrationEmail", () => {
  it("lowercases and unwraps angle brackets", () => {
    assert.equal(normalizeIntegrationEmail("  Jane.Doe@Example.COM "), "jane.doe@example.com");
    assert.equal(normalizeIntegrationEmail("Jane Doe <jane@example.com>"), "jane@example.com");
  });

  it("rejects values that are not addresses", () => {
    assert.equal(normalizeIntegrationEmail(""), null);
    assert.equal(normalizeIntegrationEmail("   "), null);
    assert.equal(normalizeIntegrationEmail("no-at-sign"), null);
    assert.equal(normalizeIntegrationEmail("two addresses@a.com b@c.com"), null);
  });
});
