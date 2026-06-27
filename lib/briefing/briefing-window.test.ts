import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRIEFING_DEFAULT_LOOKBACK_HOURS,
  BRIEFING_MAX_LOOKBACK_HOURS,
} from "@/lib/briefing/briefing-types";
import { calculateBriefingWindow } from "@/lib/briefing/briefing-window";

describe("calculateBriefingWindow", () => {
  const now = new Date("2026-06-26T14:00:00.000Z");

  it("uses lookback hours when no prior completed run exists", () => {
    const window = calculateBriefingWindow({ now, lookbackHours: 12 });
    assert.equal(window.windowEnd.toISOString(), now.toISOString());
    assert.equal(
      window.windowStart.toISOString(),
      new Date(now.getTime() - 12 * 3_600_000).toISOString(),
    );
  });

  it("starts at previous run windowEnd when available", () => {
    const previousEnd = new Date("2026-06-26T07:00:00.000Z");
    const window = calculateBriefingWindow({
      now,
      lookbackHours: 12,
      lastCompletedRun: { windowEnd: previousEnd },
    });

    assert.equal(window.windowStart.toISOString(), previousEnd.toISOString());
    assert.equal(window.windowEnd.toISOString(), now.toISOString());
  });

  it("falls back to lookback when previous windowEnd is not before now", () => {
    const previousEnd = new Date("2026-06-26T15:00:00.000Z");
    const window = calculateBriefingWindow({
      now,
      lookbackHours: 6,
      lastCompletedRun: { windowEnd: previousEnd },
    });

    assert.equal(
      window.windowStart.toISOString(),
      new Date(now.getTime() - 6 * 3_600_000).toISOString(),
    );
  });

  it("clamps lookback to max hours", () => {
    const window = calculateBriefingWindow({ now, lookbackHours: 999 });
    const expectedStart = new Date(now.getTime() - BRIEFING_MAX_LOOKBACK_HOURS * 3_600_000);
    assert.equal(window.windowStart.toISOString(), expectedStart.toISOString());
  });

  it("uses default lookback for invalid values", () => {
    const window = calculateBriefingWindow({ now, lookbackHours: 0 });
    const expectedStart = new Date(
      now.getTime() - BRIEFING_DEFAULT_LOOKBACK_HOURS * 3_600_000,
    );
    assert.equal(window.windowStart.toISOString(), expectedStart.toISOString());
  });
});
