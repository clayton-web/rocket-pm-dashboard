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
  categoryAssignments: [],
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
    assert.deepEqual(rows[0]?.categories, ["UNCATEGORIZED"]);
  });

  it("exposes multiple category chips from assignments", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [
        {
          ...baseThread,
          category: "TENANT_COMMUNICATION",
          categoryAssignments: [
            { category: "TENANT_COMMUNICATION", source: "RULE", reason: "Tenant match", assignedAt: new Date() },
            { category: "STRATA", source: "RULE", reason: "BCS1234", assignedAt: new Date() },
          ],
        },
      ],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.deepEqual(rows[0]?.categories, ["TENANT_COMMUNICATION", "STRATA"]);
  });

  it("does not flag manual uncategorized threads for classification review", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [
        {
          ...baseThread,
          categorySource: "manual",
          categoryAssignments: [{ category: "STRATA", source: "MANUAL", reason: null, assignedAt: new Date() }],
        },
      ],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.equal(rows[0]?.needsClassificationReview, false);
    assert.deepEqual(rows[0]?.badges, []);
  });
});
