import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  computeCrateCounts,
  computeCrateNeedsReplyCounts,
  filterRowsByCrate,
  isEmailThreadCategory,
  isInboxCrateFilter,
  mapAssignmentGroupByToCrateCounts,
} from "./email-thread-category";

function row(
  categories: InboxThreadDisplayRow["categories"],
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
    category: categories[0] ?? "UNCATEGORIZED",
    categories,
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
    actionState: "no_action",
    stakeholderLabel: "Unsorted",
    primaryContextLabel: "Test",
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

  it("filters rows by crate using overlapping categories", () => {
    const rows = [
      row(["UNCATEGORIZED"], "1", "2026-06-09T10:00:00.000Z"),
      row(["STRATA"], "2"),
      row(["TENANT_COMMUNICATION", "STRATA"], "3"),
      row(["UNCATEGORIZED"], "4", "2026-06-09T14:00:00.000Z"),
    ];

    const strata = filterRowsByCrate(rows, "STRATA");
    assert.deepEqual(strata.map((entry) => entry.id).sort(), ["2", "3"]);

    const uncategorized = filterRowsByCrate(rows, "UNCATEGORIZED");
    assert.deepEqual(uncategorized.map((entry) => entry.id), ["4", "1"]);
  });

  it("computes overlapping crate counts", () => {
    const counts = computeCrateCounts([
      row(["UNCATEGORIZED"], "1"),
      row(["STRATA"], "2"),
      row(["TENANT_COMMUNICATION", "STRATA"], "3"),
    ]);

    assert.equal(counts.UNCATEGORIZED, 1);
    assert.equal(counts.STRATA, 2);
    assert.equal(counts.TENANT_COMMUNICATION, 1);
    assert.equal(counts.all, 3);
  });

  it("maps assignment groupBy results to overlapping crate counts", () => {
    const counts = mapAssignmentGroupByToCrateCounts(
      [
        { category: "STRATA", _count: { _all: 4 } },
        { category: "TENANT_COMMUNICATION", _count: { _all: 2 } },
      ],
      5,
    );

    assert.equal(counts.STRATA, 4);
    assert.equal(counts.TENANT_COMMUNICATION, 2);
    assert.equal(counts.all, 5);
  });

  it("computes overlapping needs-reply counts per crate", () => {
    const counts = computeCrateNeedsReplyCounts([
      row(["LANDLORD_COMMUNICATION"], "1"),
      row(["TENANT_COMMUNICATION", "STRATA"], "2"),
      row(["STRATA"], "3"),
    ].map((entry, index) => ({
      ...entry,
      needsReply: index < 2,
    })));

    assert.equal(counts.LANDLORD_COMMUNICATION, 1);
    assert.equal(counts.TENANT_COMMUNICATION, 1);
    assert.equal(counts.STRATA, 1);
    assert.equal(counts.UNCATEGORIZED, 0);
  });
});
