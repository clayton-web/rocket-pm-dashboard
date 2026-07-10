import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isRentalListingPublicFallbackEnabled } from "./rental-listing-public-fallback";

const original = process.env.RENTAL_LISTING_PUBLIC_FALLBACK;

afterEach(() => {
  if (original === undefined) delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
  else process.env.RENTAL_LISTING_PUBLIC_FALLBACK = original;
});

describe("RENTAL_LISTING_PUBLIC_FALLBACK parsing", () => {
  it("does not treat the string false as truthy", () => {
    process.env.RENTAL_LISTING_PUBLIC_FALLBACK = "false";
    assert.equal(isRentalListingPublicFallbackEnabled(), false);
  });
});
