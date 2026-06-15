import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  computeInboxSummary,
  filterClassificationReview,
  filterNeedsReply,
  isInboxQueueParam,
  sortNeedsReplyByStakeholderThenAge,
} from "./inbox-thread-queues";

function row(
  overrides: Partial<InboxThreadDisplayRow> & Pick<InboxThreadDisplayRow, "id">,
): InboxThreadDisplayRow {
  return {
    subject: "Test",
    snippet: null,
    lastMessageAt: "2026-06-09T12:00:00.000Z",
    isUnread: false,
    participantEmails: [],
    category: "UNCATEGORIZED",
    categories: ["UNCATEGORIZED"],
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
    ...overrides,
  };
}

describe("inbox-thread-queues", () => {
  it("accepts classification_review queue param", () => {
    assert.equal(isInboxQueueParam("classification_review"), true);
    assert.equal(isInboxQueueParam("needs_review"), true);
    assert.equal(isInboxQueueParam("invalid"), false);
  });

  it("filters classification review threads by display flag", () => {
    const rows = [
      row({
        id: "1",
        needsClassificationReview: true,
        lastClassificationAttemptAt: "2026-06-09T10:00:00.000Z",
      }),
      row({ id: "2", needsClassificationReview: false }),
      row({
        id: "3",
        needsClassificationReview: true,
        lastClassificationAttemptAt: "2026-06-09T14:00:00.000Z",
      }),
    ];

    const filtered = filterClassificationReview(rows);
    assert.deepEqual(filtered.map((item) => item.id), ["3", "1"]);
  });

  it("includes classification review count from db total in summary", () => {
    const summary = computeInboxSummary(
      [
        row({ id: "1", needsClassificationReview: true }),
        row({ id: "2", reviewRequired: true }),
      ],
      0,
      7,
    );

    assert.equal(summary.classificationReview, 7);
    assert.equal(summary.reviewRequired, 1);
    assert.equal(summary.totalUnique, 2);
  });

  it("sorts needs reply by stakeholder priority then oldest waiting first", () => {
    const rows = sortNeedsReplyByStakeholderThenAge([
      row({
        id: "tenant-new",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION"],
        lastMessageAt: "2026-06-09T14:00:00.000Z",
      }),
      row({
        id: "landlord-old",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T08:00:00.000Z",
      }),
      row({
        id: "landlord-new",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T16:00:00.000Z",
      }),
      row({
        id: "unsorted",
        needsReply: true,
        categories: ["UNCATEGORIZED"],
        lastMessageAt: "2026-06-09T06:00:00.000Z",
      }),
    ]);

    assert.deepEqual(rows.map((entry) => entry.id), [
      "landlord-old",
      "landlord-new",
      "tenant-new",
      "unsorted",
    ]);
  });

  it("uses highest-priority category when sorting multi-category threads", () => {
    const sorted = filterNeedsReply([
      row({
        id: "tenant-strata",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION", "STRATA"],
        lastMessageAt: "2026-06-09T10:00:00.000Z",
      }),
      row({
        id: "landlord",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T12:00:00.000Z",
      }),
    ]);

    assert.deepEqual(sorted.map((entry) => entry.id), ["landlord", "tenant-strata"]);
  });
});
