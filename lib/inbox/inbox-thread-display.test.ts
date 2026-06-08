import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadRecord } from "@/lib/inbox/inbox-thread-data";
import type { LatestDraftSnapshot, LatestMessageSnapshot } from "@/lib/inbox/inbox-thread-data";
import { buildInboxThreadDisplayRows } from "./inbox-thread-display";

const baseThread: InboxThreadRecord = {
  id: "thread_1",
  subject: "Strata notice",
  snippet: "Council meeting",
  lastMessageAt: new Date("2026-06-09T12:00:00.000Z"),
  isUnread: true,
  participantEmails: ["strata@example.com"],
  contextLinks: [],
  category: "UNCATEGORIZED",
  categorySource: null,
  categoryConfidence: 0.42,
  categoryAiReason: "Low confidence: could be tenant or strata.",
  lastClassificationAttemptAt: new Date("2026-06-09T13:00:00.000Z"),
};

describe("inbox-thread-display", () => {
  it("flags classification review threads and adds review badge", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [baseThread],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.needsClassificationReview, true);
    assert.deepEqual(rows[0]?.badges, ["classification_review"]);
    assert.equal(rows[0]?.categoryConfidence, 0.42);
    assert.equal(rows[0]?.categoryAiReason, "Low confidence: could be tenant or strata.");
  });

  it("prefers draft review badge over classification review badge", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [baseThread],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>([
        [
          baseThread.id,
          {
            id: "draft_1",
            classification: { review_required: true },
            createdAt: new Date("2026-06-09T14:00:00.000Z"),
            reviewRequired: true,
          },
        ],
      ]),
    );

    assert.deepEqual(rows[0]?.badges, ["review_required"]);
    assert.equal(rows[0]?.needsClassificationReview, true);
  });

  it("does not flag manual uncategorized threads for classification review", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [
        {
          ...baseThread,
          categorySource: "manual",
        },
      ],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.equal(rows[0]?.needsClassificationReview, false);
    assert.deepEqual(rows[0]?.badges, []);
  });
});
