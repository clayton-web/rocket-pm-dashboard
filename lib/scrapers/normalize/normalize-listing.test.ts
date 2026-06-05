import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawScraperListing } from "../types";
import { normalizeScraperListing, normalizeScraperListings } from "./normalize-listing";

const rawListing: RawScraperListing = {
  source: "craigslist",
  sourceListingId: "123",
  sourceUrl: "https://example.com/listing/123",
  title: "2BR condo Kits",
  monthlyRent: 2500,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 800,
  city: "Vancouver",
  neighbourhood: "Kitsilano",
  postedAt: "2026-06-01T00:00:00.000Z",
  capturedAt: "2026-06-04T00:00:00.000Z",
  propertyTypeHint: "condo",
};

describe("normalizeScraperListing", () => {
  it("produces normalized comparable shape with defaults", () => {
    const normalized = normalizeScraperListing(rawListing);

    assert.equal(normalized.source, "craigslist");
    assert.equal(normalized.sourceListingId, "123");
    assert.equal(normalized.sourceUrl, rawListing.sourceUrl);
    assert.equal(normalized.title, rawListing.title);
    assert.equal(normalized.monthlyRent, 2500);
    assert.equal(normalized.currency, "CAD");
    assert.equal(normalized.bedrooms, 2);
    assert.equal(normalized.bathrooms, 1);
    assert.equal(normalized.sqft, 800);
    assert.equal(normalized.city, "Vancouver");
    assert.equal(normalized.neighbourhood, "Kitsilano");
    assert.equal(normalized.matchScore, 0);
    assert.deepEqual(normalized.matchReasons, []);
    assert.equal(normalized.excluded, false);
  });

  it("normalizes arrays", () => {
    const listings = normalizeScraperListings([rawListing, rawListing]);
    assert.equal(listings.length, 2);
    assert.equal(listings[0].sourceListingId, "123");
  });
});
