import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeEarliestValidMoveOutDate,
  deriveRentDueDayFromLeaseStart,
  getAllowedMoveOutDates,
  isMoveOutDateValid,
  isRentalPeriodBoundary,
  toDateOnlyUTC,
} from "./notice-rules";

function d(iso: string): Date {
  return toDateOnlyUTC(iso);
}

describe("deriveRentDueDayFromLeaseStart", () => {
  it("uses UTC day component of lease start", () => {
    assert.equal(deriveRentDueDayFromLeaseStart(d("2026-02-15")), 15);
    assert.equal(deriveRentDueDayFromLeaseStart(d("2026-03-01")), 1);
  });
});

describe("computeEarliestValidMoveOutDate — rent due day 1", () => {
  const tenancy = { rentDueDay: 1, leaseEndDate: null };

  it("notice June 2 → earliest August 1", () => {
    const earliest = computeEarliestValidMoveOutDate(d("2026-06-02"), tenancy);
    assert.equal(earliest.toISOString().slice(0, 10), "2026-08-01");
  });

  it("notice June 28 → earliest August 1", () => {
    const earliest = computeEarliestValidMoveOutDate(d("2026-06-28"), tenancy);
    assert.equal(earliest.toISOString().slice(0, 10), "2026-08-01");
  });

  it("notice May 31 → earliest July 1", () => {
    const earliest = computeEarliestValidMoveOutDate(d("2026-05-31"), tenancy);
    assert.equal(earliest.toISOString().slice(0, 10), "2026-07-01");
  });
});

describe("computeEarliestValidMoveOutDate — rent due day 15", () => {
  const tenancy = { rentDueDay: 15, leaseEndDate: null };

  it("notice June 2 → earliest July 15", () => {
    const earliest = computeEarliestValidMoveOutDate(d("2026-06-02"), tenancy);
    assert.equal(earliest.toISOString().slice(0, 10), "2026-07-15");
  });

  it("notice June 28 → earliest August 15", () => {
    const earliest = computeEarliestValidMoveOutDate(d("2026-06-28"), tenancy);
    assert.equal(earliest.toISOString().slice(0, 10), "2026-08-15");
  });
});

describe("fixed-term lease restrictions", () => {
  it("clamps earliest end to first boundary after lease end", () => {
    const tenancy = { rentDueDay: 1, leaseEndDate: d("2026-12-31") };
    const earliest = computeEarliestValidMoveOutDate(d("2026-06-02"), tenancy);
    // Lease inclusive through Dec 31 → earliest period boundary afterward is Jan 1.
    assert.equal(earliest.toISOString().slice(0, 10), "2027-01-01");
  });

  it("rejects move-out before fixed term expires", () => {
    const tenancy = { rentDueDay: 1, leaseEndDate: d("2026-12-31") };
    const result = isMoveOutDateValid(d("2026-08-01"), d("2026-06-02"), tenancy);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.ok(result.errors.some((e) => e.includes("fixed-term")));
      assert.ok(result.codes.includes("BEFORE_FIXED_TERM"));
    }
  });

  it("allows boundary on or after earliest when fixed-term bound applies", () => {
    const tenancy = { rentDueDay: 1, leaseEndDate: d("2026-12-31") };
    const result = isMoveOutDateValid(d("2027-01-01"), d("2026-06-02"), tenancy);
    assert.equal(result.valid, true);
  });
});

describe("isMoveOutDateValid", () => {
  const tenancy = { rentDueDay: 1, leaseEndDate: null };

  it("rejects non-boundary dates", () => {
    const result = isMoveOutDateValid(d("2026-08-02"), d("2026-06-02"), tenancy);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.ok(result.errors.includes("Notice must end on a rental-period boundary."));
      assert.ok(result.codes.includes("NOT_ON_BOUNDARY"));
    }
  });

  it("rejects insufficient notice on boundary", () => {
    const result = isMoveOutDateValid(d("2026-07-01"), d("2026-06-02"), tenancy);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.ok(result.errors.includes("A full rental period of notice is required."));
      assert.ok(result.codes.includes("INSUFFICIENT_NOTICE"));
    }
  });

  it("accepts earliest valid boundary", () => {
    const result = isMoveOutDateValid(d("2026-08-01"), d("2026-06-02"), tenancy);
    assert.equal(result.valid, true);
  });
});

describe("getAllowedMoveOutDates", () => {
  it("returns period boundaries from earliest upward", () => {
    const tenancy = { rentDueDay: 1, leaseEndDate: null };
    const allowed = getAllowedMoveOutDates(d("2026-06-02"), tenancy, {
      maxDate: d("2026-10-01"),
      limit: 4,
    });
    assert.deepEqual(
      allowed.map((x) => x.toISOString().slice(0, 10)),
      ["2026-08-01", "2026-09-01", "2026-10-01"],
    );
  });
});

describe("isRentalPeriodBoundary", () => {
  it("handles short months for rent due day 31", () => {
    assert.equal(isRentalPeriodBoundary(d("2026-01-31"), 31), true);
    assert.equal(isRentalPeriodBoundary(d("2026-02-28"), 31), true);
    assert.equal(isRentalPeriodBoundary(d("2026-02-15"), 31), false);
  });
});
