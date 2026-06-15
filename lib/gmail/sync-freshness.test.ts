import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSyncFreshness } from "@/lib/gmail/sync-freshness";

describe("getSyncFreshness", () => {
  const now = new Date("2026-06-03T12:00:00.000Z");

  it("returns in_progress when sync is active", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T11:00:00.000Z"),
      syncInProgress: true,
      now,
    });
    assert.equal(result.level, "in_progress");
    assert.equal(result.label, "Sync in progress");
  });

  it("returns sync_stuck when active sync job exceeds restart threshold", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T11:00:00.000Z"),
      activeSyncJob: {
        status: "RUNNING",
        startedAt: new Date(now.getTime() - 6 * 60 * 1000),
      },
      now,
    });
    assert.equal(result.level, "sync_stuck");
  });

  it("returns never when never synced", () => {
    const result = getSyncFreshness({ lastSyncedAt: null, now });
    assert.equal(result.level, "never");
    assert.equal(result.label, "Never synced");
  });

  it("returns fresh for recent sync", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T11:55:00.000Z"),
      now,
    });
    assert.equal(result.level, "fresh");
    assert.equal(result.label, "Last synced 5 min ago");
  });

  it("returns stale for older sync within overdue window", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T10:00:00.000Z"),
      now,
    });
    assert.equal(result.level, "stale");
    assert.equal(result.label, "Last synced 2 hours ago");
  });

  it("returns overdue beyond threshold", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-01T12:00:00.000Z"),
      now,
    });
    assert.equal(result.level, "overdue");
    assert.equal(result.label, "Sync overdue");
  });
});
