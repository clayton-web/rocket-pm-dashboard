import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatRentalListingStatus,
  isOpenRentalListingStatus,
  isPubliclyVisibleRentalListingStatus,
  rentalListingUnitStatusLabel,
} from "./rental-listing-status";

describe("rental listing status helpers", () => {
  it("treats draft/published/paused as open", () => {
    assert.equal(isOpenRentalListingStatus("DRAFT"), true);
    assert.equal(isOpenRentalListingStatus("PUBLISHED"), true);
    assert.equal(isOpenRentalListingStatus("PAUSED"), true);
    assert.equal(isOpenRentalListingStatus("CLOSED"), false);
  });

  it("treats only published as publicly visible", () => {
    assert.equal(isPubliclyVisibleRentalListingStatus("PUBLISHED"), true);
    assert.equal(isPubliclyVisibleRentalListingStatus("PAUSED"), false);
  });

  it("formats status labels", () => {
    assert.equal(formatRentalListingStatus("DRAFT"), "Draft");
    assert.equal(formatRentalListingStatus("PUBLISHED"), "Published");
  });

  it("returns Not listed when status is missing", () => {
    assert.equal(rentalListingUnitStatusLabel(null), "Not listed");
    assert.equal(rentalListingUnitStatusLabel(undefined), "Not listed");
    assert.equal(rentalListingUnitStatusLabel("PAUSED"), "Paused");
  });
});
