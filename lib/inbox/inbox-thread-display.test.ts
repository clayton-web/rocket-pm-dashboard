import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadRecord } from "@/lib/inbox/inbox-thread-data";
import type { LatestDraftSnapshot, LatestMessageSnapshot } from "@/lib/inbox/inbox-thread-data";
import {
  buildInboxThreadDisplayRows,
  deriveActionState,
  deriveInboxRowMetaLine,
  derivePrimaryContextLabel,
  deriveStakeholderLabel,
} from "./inbox-thread-display";

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
    assert.equal(rows[0]?.stakeholderLabel, "Unsorted");
    assert.equal(rows[0]?.primaryContextLabel, "Unsorted · Unlinked");
    assert.equal(rows[0]?.senderLabel, "strata@example.com");
    assert.equal(rows[0]?.metaLine, "Unlinked · Review");
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
    assert.equal(rows[0]?.stakeholderLabel, "Tenant");
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

  it("derives action states for reply and draft review", () => {
    assert.equal(
      deriveActionState({ reviewRequired: true, unreadInbound: true, needsReply: true }),
      "draft_review",
    );
    assert.equal(
      deriveActionState({ reviewRequired: false, unreadInbound: true, needsReply: true }),
      "new_reply_needed",
    );
    assert.equal(
      deriveActionState({ reviewRequired: false, unreadInbound: false, needsReply: true }),
      "reply_needed",
    );
    assert.equal(
      deriveActionState({ reviewRequired: false, unreadInbound: false, needsReply: false }),
      "no_action",
    );
  });

  it("derives stakeholder labels from primary category", () => {
    assert.equal(deriveStakeholderLabel(["STRATA", "TENANT_COMMUNICATION"]), "Tenant");
    assert.equal(deriveStakeholderLabel(["UNCATEGORIZED"]), "Unsorted");
  });

  it("derives primary context from chips, unlinked state, and subject fallback", () => {
    assert.equal(
      derivePrimaryContextLabel({
        chips: [{ kind: "tenancy", label: "Tenancy · Oak Tower · Unit 4B · Jane Doe" }],
        stakeholderLabel: "Tenant",
        subject: "Leak report",
        unlinked: false,
      }),
      "Oak Tower · Unit 4B · Jane Doe",
    );

    assert.equal(
      derivePrimaryContextLabel({
        chips: [],
        stakeholderLabel: "Landlord",
        subject: "Expense approval",
        unlinked: true,
      }),
      "Landlord · Unlinked",
    );

    assert.equal(
      derivePrimaryContextLabel({
        chips: [],
        stakeholderLabel: "Strata",
        subject: null,
        unlinked: false,
      }),
      "Strata",
    );
  });

  it("sets reply-needed action state from latest inbound message", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [{ ...baseThread, isUnread: false }],
      new Map<string, LatestMessageSnapshot>([
        [
          "thread_1",
          {
            isOutbound: false,
            isUnread: false,
            sentAt: new Date("2026-06-09T12:00:00.000Z"),
          },
        ],
      ]),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.equal(rows[0]?.needsReply, true);
    assert.equal(rows[0]?.actionState, "reply_needed");
  });

  it("derives meta line with action and PM context", () => {
    assert.equal(
      deriveInboxRowMetaLine({
        actionState: "reply_needed",
        stakeholderLabel: "Tenant",
        primaryContextLabel: "Oak Tower · Unit 4B",
        subject: "Leak report",
        unlinked: false,
        badges: [],
      }),
      "Reply needed · Oak Tower · Unit 4B",
    );
  });

  it("avoids redundant stakeholder label for unlinked threads", () => {
    assert.equal(
      deriveInboxRowMetaLine({
        actionState: "new_reply_needed",
        stakeholderLabel: "Unsorted",
        primaryContextLabel: "Unsorted · Unlinked",
        subject: "Strata notice",
        unlinked: true,
        badges: [],
      }),
      "New reply needed · Unlinked",
    );
  });

  it("derives sender label from participant emails when inbound sender is missing", async () => {
    const rows = await buildInboxThreadDisplayRows(
      "org_test",
      [baseThread],
      new Map<string, LatestMessageSnapshot>(),
      new Map<string, LatestDraftSnapshot>(),
    );

    assert.equal(rows[0]?.senderLabel, "strata@example.com");
    assert.equal(rows[0]?.senderEmail, "strata@example.com");
  });
});
