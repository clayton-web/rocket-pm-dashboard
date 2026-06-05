import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMarketRentResearchFormPrefill } from "./prefill-from-property-profile";

describe("buildMarketRentResearchFormPrefill", () => {
  it("pre-fills research form from property profile", () => {
    const prefill = buildMarketRentResearchFormPrefill({
      city: "Vancouver",
      profile: {
        propertyType: "condo",
        bedrooms: 2,
        bathrooms: 1.5,
        approxSqft: 900,
      },
    });
    assert.equal(prefill.city, "Vancouver");
    assert.equal(prefill.propertyType, "condo");
    assert.equal(prefill.bedrooms, "2");
    assert.equal(prefill.bathrooms, "1.5");
    assert.equal(prefill.sqft, "900");
  });

  it("leaves blanks when profile fields are missing", () => {
    const prefill = buildMarketRentResearchFormPrefill({
      city: "Burnaby",
      profile: {
        propertyType: null,
        bedrooms: null,
        bathrooms: null,
        approxSqft: null,
      },
    });
    assert.equal(prefill.city, "Burnaby");
    assert.equal(prefill.propertyType, "");
    assert.equal(prefill.bedrooms, "");
    assert.equal(prefill.bathrooms, "");
    assert.equal(prefill.sqft, "");
  });

  it("falls back to unit bedrooms when profile bedrooms are missing", () => {
    const prefill = buildMarketRentResearchFormPrefill({
      city: "Vancouver",
      profile: {
        propertyType: "townhouse",
        bedrooms: null,
        bathrooms: null,
        approxSqft: null,
      },
      unitBedrooms: 3,
    });
    assert.equal(prefill.bedrooms, "3");
  });
});

describe("market rent research panel prefill wiring", () => {
  it("uses property profile prefill helper in the panel", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../components/properties/market-rent-research-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /buildMarketRentResearchFormPrefill/);
    assert.match(source, /propertyProfile/);
  });
});

describe("property profile boundaries", () => {
  it("does not touch tenancy, application, lease, portal, or official rent fields", async () => {
    const { readFile } = await import("node:fs/promises");
    const serviceSource = await readFile(
      new URL("../services/property.service.ts", import.meta.url),
      "utf8",
    );
    const schemaSource = await readFile(
      new URL("../../prisma/schema.prisma", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(serviceSource, /monthlyRent/);
    assert.doesNotMatch(serviceSource, /Tenancy/);
    assert.match(schemaSource, /propertyType String\?/);
    assert.match(schemaSource, /monthlyRent/);
    assert.doesNotMatch(schemaSource, /askingRent/);
  });
});
