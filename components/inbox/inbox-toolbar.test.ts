import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SyncFreshnessLevel } from "@/lib/gmail/sync-freshness";

export function shouldShowRestartSyncButton(level: SyncFreshnessLevel): boolean {
  return level === "sync_stuck";
}

describe("InboxToolbar restart sync visibility", () => {
  it("shows Restart Sync only when sync is stuck", () => {
    assert.equal(shouldShowRestartSyncButton("sync_stuck"), true);
    assert.equal(shouldShowRestartSyncButton("in_progress"), false);
    assert.equal(shouldShowRestartSyncButton("fresh"), false);
    assert.equal(shouldShowRestartSyncButton("never"), false);
  });
});
