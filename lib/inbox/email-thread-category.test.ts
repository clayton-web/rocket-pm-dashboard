import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  computeCrateCounts,
  filterRowsByCrate,
  isEmailThreadCategory,
  isInboxCrateFilter,
  mapGroupByToCrateCounts,
} from "./email-thread-category";

function row(
  category: InboxThreadDisplayRow["category"],
  id = "1",
  lastMessageAt = "2026-06-09T12:00:00.000Z",
): InboxThreadDisplayRow {
  return {
    id,
    subject: "Test",
    snippet: null,
    lastMessageAt,
    isUnread: false,
    participantEmails: [],
    category,
    categorySource: null,
    categoryConfidence: null,
    categoryAiReason: null,
    lastClassificationAttemptAt: null,
    needsClassificationReview: false,
    needsReply: false,
    unreadInbound: false,
    unlinked: true,
    reviewRequired: false,
    hasDraftReady: false,
    draftCreatedAt: null,
    badges: [],
    chips: [],
  };
}

describe("email-thread-category", () => {
  it("validates category and crate filter params", () => {
    assert.equal(isEmailThreadCategory("STRATA"), true);
    assert.equal(isEmailThreadCategory("INVALID"), false);
    assert.equal(isInboxCrateFilter("UNCATEGORIZED"), true);
    assert.equal(isInboxCrateFilter("all"), true);
    assert.equal(isInboxCrateFilter(undefined), false);
  });

  it("filters rows by crate", () => {
    const rows = [
      row("UNCATEGORIZED", "1", "2026-06-09T10:00:00.000Z"),
      row("STRATA", "2"),
      row("TENANT_INQUIRY", "3"),
      row("UNCATEGORIZED", "4", "2026-06-09T14:00:00.000Z"),
    ];

    const uncategorized = filterRowsByCrate(rows, "UNCATEGORIZED");
    assert.equal(uncategorized.length, 2);
    assert.deepEqual(uncategorized.map((r) => r.id), ["4", "1"]);

    assert.equal(filterRowsByCrate(rows, "all").length, 4);
    assert.equal(filterRowsByCrate(rows, "LANDLORD_COMMUNICATION").length, 0);
  });

  it("computes crate counts including all inbox total", () => {
    const counts = computeCrateCounts([
      row("UNCATEGORIZED", "1"),
      row("STRATA", "2"),
      row("UNCATEGORIZED", "3"),
    ]);

    assert.equal(counts.UNCATEGORIZED, 2);
    assert.equal(counts.STRATA, 1);
    assert.equal(counts.TENANT_INQUIRY, 0);
    assert.equal(counts.all, 3);
  });

  it("maps prisma groupBy results to crate counts", () => {
    const counts = mapGroupByToCrateCounts([
      { category: "UNCATEGORIZED", _count: { _all: 4 } },
      { category: "STRATA", _count: { _all: 2 } },
      { category: "TENANT_INQUIRY", _count: { _all: 1 } },
    ]);

    assert.equal(counts.UNCATEGORIZED, 4);
    assert.equal(counts.STRATA, 2);
    assert.equal(counts.TENANT_INQUIRY, 1);
    assert.equal(counts.LANDLORD_COMMUNICATION, 0);
    assert.equal(counts.all, 7);
  });
});
