import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDateOverdue,
  isDateTimeWithinUpcomingWindow,
  isDateWithinUpcomingWindow,
} from "./date-windows";

describe("date-windows", () => {
  it("treats yesterday as overdue and today as not", () => {
    assert.equal(isDateOverdue("2026-07-09", "2026-07-10"), true);
    assert.equal(isDateOverdue("2026-07-10", "2026-07-10"), false);
    assert.equal(isDateOverdue("2026-07-11", "2026-07-10"), false);
  });

  it("includes the 7-day upcoming boundary", () => {
    assert.equal(isDateWithinUpcomingWindow("2026-07-10", { today: "2026-07-10" }), true);
    assert.equal(isDateWithinUpcomingWindow("2026-07-17", { today: "2026-07-10" }), true);
    assert.equal(isDateWithinUpcomingWindow("2026-07-18", { today: "2026-07-10" }), false);
    assert.equal(isDateWithinUpcomingWindow("2026-07-09", { today: "2026-07-10" }), false);
  });

  it("supports datetime upcoming windows", () => {
    const reference = new Date("2026-07-10T12:00:00.000Z");
    assert.equal(
      isDateTimeWithinUpcomingWindow("2026-07-12T15:00:00.000Z", { reference }),
      true,
    );
    assert.equal(
      isDateTimeWithinUpcomingWindow("2026-07-20T15:00:00.000Z", { reference }),
      false,
    );
  });
});
