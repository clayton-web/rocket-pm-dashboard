import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStreetLineKey } from "@/lib/integrations/pm-context/normalize-address-hint";
import {
  findLikelyDuplicateAddresses,
  PROPERTY_ADDRESS_DUPLICATE_WARNING,
  type PropertyAddressIdentity,
} from "@/lib/property/property-address-duplicates";

function identity(overrides: Partial<PropertyAddressIdentity> = {}): PropertyAddressIdentity {
  return {
    propertyId: "prop-candidate",
    streetLine1: "123 Main St",
    streetLine2: null,
    city: "Vancouver",
    postalCode: "V6B 1A1",
    ...overrides,
  };
}

describe("property address duplicate detection", () => {
  it("warns on an obvious same-organization duplicate", () => {
    const matches = findLikelyDuplicateAddresses(identity(), [
      identity({ propertyId: "prop-other" }),
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.propertyId, "prop-other");
    assert.equal(matches[0]?.confidence, "likely");
  });

  it("matches across abbreviation and casing differences", () => {
    // Shares the PM-context resolver's canonicalization, so a warning here predicts a real
    // collision there.
    assert.equal(normalizeStreetLineKey("123 Main St"), normalizeStreetLineKey("123 main street"));

    const matches = findLikelyDuplicateAddresses(identity({ streetLine1: "123 Main St W" }), [
      identity({ propertyId: "prop-other", streetLine1: "123 main street west" }),
    ]);

    assert.equal(matches.length, 1);
  });

  it("never reports the candidate against itself", () => {
    assert.deepEqual(findLikelyDuplicateAddresses(identity(), [identity()]), []);
  });

  it("does not warn when the same street name is in another city", () => {
    const matches = findLikelyDuplicateAddresses(identity({ city: "Vancouver" }), [
      identity({ propertyId: "prop-other", city: "Burnaby" }),
    ]);

    assert.deepEqual(matches, []);
  });

  it("does not warn for a duplex or suite differentiated by street line 2", () => {
    const matches = findLikelyDuplicateAddresses(identity({ streetLine2: "Upper" }), [
      identity({ propertyId: "prop-lower", streetLine2: "Lower" }),
    ]);

    assert.deepEqual(matches, []);
  });

  it("treats unit designator spellings as the same unit", () => {
    const matches = findLikelyDuplicateAddresses(identity({ streetLine2: "Unit 2" }), [
      identity({ propertyId: "prop-other", streetLine2: "#2" }),
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.confidence, "likely");
  });

  it("downgrades to possible when only one record names a unit", () => {
    const matches = findLikelyDuplicateAddresses(identity({ streetLine2: null }), [
      identity({ propertyId: "prop-suite", streetLine2: "Laneway" }),
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.confidence, "possible");
  });

  it("reports a postal code disagreement on the same civic address", () => {
    const matches = findLikelyDuplicateAddresses(identity({ postalCode: "V6B 1A1" }), [
      identity({ propertyId: "prop-other", postalCode: "V5K 0A1" }),
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.postalCodeMismatch, true);
  });

  it("does not claim a postal mismatch against an import placeholder", () => {
    const matches = findLikelyDuplicateAddresses(identity(), [
      identity({ propertyId: "prop-other", postalCode: "TBD 0T0" }),
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.postalCodeMismatch, false);
  });

  it("produces nothing for a blank or unparseable street line", () => {
    assert.deepEqual(
      findLikelyDuplicateAddresses(identity({ streetLine1: "" }), [
        identity({ propertyId: "prop-other" }),
      ]),
      [],
    );
    assert.deepEqual(
      findLikelyDuplicateAddresses(identity({ city: "" }), [
        identity({ propertyId: "prop-other", city: "" }),
      ]),
      [],
    );
  });

  it("orders likely matches ahead of possible ones", () => {
    const matches = findLikelyDuplicateAddresses(identity({ streetLine2: null }), [
      identity({ propertyId: "prop-suite", streetLine2: "Coach House" }),
      identity({ propertyId: "prop-exact", streetLine2: null }),
    ]);

    assert.deepEqual(
      matches.map((match) => match.propertyId),
      ["prop-exact", "prop-suite"],
    );
  });

  it("hedges rather than asserting identity", () => {
    assert.match(PROPERTY_ADDRESS_DUPLICATE_WARNING, /may already/);
  });
});
