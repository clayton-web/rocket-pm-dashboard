import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors suggested lease-start priority used in getApplicationDetailForStaff. */
function suggestLeaseStart(input: {
  desiredMoveInDate: string | null;
  listingAvailableDate: string | null;
}): { date: string | null; source: "application" | "listing" | null } {
  if (input.desiredMoveInDate) {
    return { date: input.desiredMoveInDate, source: "application" };
  }
  if (input.listingAvailableDate) {
    return { date: input.listingAvailableDate, source: "listing" };
  }
  return { date: null, source: null };
}

describe("suggested lease start prefill priority", () => {
  it("prefers application desired move-in over listing available date", () => {
    const result = suggestLeaseStart({
      desiredMoveInDate: "2026-09-01",
      listingAvailableDate: "2026-08-15",
    });
    assert.equal(result.date, "2026-09-01");
    assert.equal(result.source, "application");
  });

  it("falls back to listing available date", () => {
    const result = suggestLeaseStart({
      desiredMoveInDate: null,
      listingAvailableDate: "2026-08-15",
    });
    assert.equal(result.date, "2026-08-15");
    assert.equal(result.source, "listing");
  });

  it("returns blank when neither exists", () => {
    const result = suggestLeaseStart({
      desiredMoveInDate: null,
      listingAvailableDate: null,
    });
    assert.equal(result.date, null);
    assert.equal(result.source, null);
  });
});
