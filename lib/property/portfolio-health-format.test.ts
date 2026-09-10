import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPortfolioHealthDocumentsState,
  formatPortfolioHealthOccupancy,
  formatPortfolioHealthOwnerState,
  formatPortfolioHealthUpdatedAt,
} from "@/lib/property/portfolio-health-format";

describe("formatPortfolioHealthOccupancy", () => {
  it("distinguishes no units from a vacant property", () => {
    assert.equal(
      formatPortfolioHealthOccupancy({ unitCount: 0, occupiedUnitCount: 0, isVacant: true }).short,
      "No units",
    );
    assert.equal(
      formatPortfolioHealthOccupancy({ unitCount: 2, occupiedUnitCount: 0, isVacant: true }).short,
      "Vacant",
    );
  });

  it("shows occupied over total when partially occupied", () => {
    const cell = formatPortfolioHealthOccupancy({
      unitCount: 3,
      occupiedUnitCount: 2,
      isVacant: false,
    });
    assert.equal(cell.short, "2/3");
    assert.equal(cell.description, "2 of 3 units occupied");
  });

  it("calls a fully occupied property out in the description", () => {
    const cell = formatPortfolioHealthOccupancy({
      unitCount: 2,
      occupiedUnitCount: 2,
      isVacant: false,
    });
    assert.equal(cell.short, "2/2");
    assert.match(cell.description, /Fully occupied/);
  });

  it("uses the singular for a one-unit property", () => {
    assert.match(
      formatPortfolioHealthOccupancy({ unitCount: 1, occupiedUnitCount: 1, isVacant: false })
        .description,
      /1 unit\b/,
    );
  });
});

describe("owner and document cells", () => {
  it("reports owner contact state", () => {
    assert.equal(formatPortfolioHealthOwnerState("ok").short, "Complete");
    assert.equal(formatPortfolioHealthOwnerState("missing").short, "Missing");
  });

  it("reports document state", () => {
    assert.equal(formatPortfolioHealthDocumentsState("ok").short, "Uploaded");
    assert.equal(formatPortfolioHealthDocumentsState("missing").short, "None");
  });
});

describe("formatPortfolioHealthUpdatedAt", () => {
  const now = new Date("2026-08-31T12:00:00.000Z");

  it("handles a missing or unparseable timestamp", () => {
    assert.equal(formatPortfolioHealthUpdatedAt(null, now).short, "—");
    assert.equal(formatPortfolioHealthUpdatedAt("not-a-date", now).short, "—");
  });

  it("buckets by whole UTC days", () => {
    const cases: Array<[string, string]> = [
      ["2026-08-31T01:00:00.000Z", "Today"],
      ["2026-08-30T23:00:00.000Z", "1d"],
      ["2026-08-25T12:00:00.000Z", "6d"],
      ["2026-06-01T12:00:00.000Z", "3mo"],
      ["2024-08-31T12:00:00.000Z", "2y"],
    ];
    for (const [iso, expected] of cases) {
      assert.equal(formatPortfolioHealthUpdatedAt(iso, now).short, expected, iso);
    }
  });

  it("always carries an exact date for the tooltip and screen reader", () => {
    const cell = formatPortfolioHealthUpdatedAt("2026-08-25T12:00:00.000Z", now);
    assert.equal(cell.short, "6d");
    assert.equal(cell.description, "Last updated Aug 25, 2026");
  });

  it("shows the exact date rather than a negative age for a future timestamp", () => {
    const cell = formatPortfolioHealthUpdatedAt("2026-09-05T12:00:00.000Z", now);
    assert.equal(cell.short, "Sep 5, 2026");
  });
});
