import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LatestMessageSnapshot } from "@/lib/inbox/inbox-thread-data";
import type { InboxThreadChip, InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  INBOX_OPS_THREAD_CAP_PER_MAILBOX,
  dedupeInboxOpsRowsByThreadId,
  extractOpsPropertyUnitFromChips,
  filterNeedsReplyThreadIds,
  isInboxNeedsReplyLatestMessage,
  mapDisplayRowToInboxOpsQueueRow,
  type InboxOpsQueueRow,
} from "./inbox-ops-queue";

function latest(overrides: Partial<LatestMessageSnapshot> = {}): LatestMessageSnapshot {
  return {
    isOutbound: false,
    isUnread: true,
    sentAt: new Date("2026-07-01T12:00:00.000Z"),
    fromAddr: "tenant@example.com",
    latestInboundFromAddr: "tenant@example.com",
    ...overrides,
  };
}

function displayRow(overrides: Partial<InboxThreadDisplayRow> = {}): InboxThreadDisplayRow {
  return {
    id: "thread_1",
    subject: "Leak in kitchen",
    snippet: "Please help",
    lastMessageAt: "2026-07-01T12:00:00.000Z",
    isUnread: true,
    participantEmails: ["tenant@example.com"],
    category: "TENANT_COMMUNICATION",
    categories: ["TENANT_COMMUNICATION"],
    categorySource: null,
    categoryConfidence: null,
    categoryAiReason: null,
    lastClassificationAttemptAt: null,
    needsClassificationReview: false,
    needsReply: true,
    unreadInbound: true,
    unlinked: false,
    reviewRequired: false,
    hasDraftReady: false,
    draftCreatedAt: null,
    badges: [],
    chips: [],
    actionState: "new_reply_needed",
    stakeholderLabel: "Tenant",
    primaryContextLabel: "Oak Tower · Unit 4B",
    senderLabel: "Ada Tenant",
    senderEmail: "tenant@example.com",
    metaLine: "New reply needed · Oak Tower · Unit 4B",
    ...overrides,
  };
}

describe("inbox-ops-queue eligibility", () => {
  it("includes latest inbound messages (needs_reply)", () => {
    assert.equal(isInboxNeedsReplyLatestMessage(latest({ isOutbound: false })), true);
  });

  it("excludes latest outbound messages", () => {
    assert.equal(isInboxNeedsReplyLatestMessage(latest({ isOutbound: true })), false);
  });

  it("excludes threads with no latest message", () => {
    assert.equal(isInboxNeedsReplyLatestMessage(undefined), false);
    assert.equal(isInboxNeedsReplyLatestMessage(null), false);
  });

  it("filterNeedsReplyThreadIds matches Inbox needs_reply semantics only", () => {
    const map = new Map<string, LatestMessageSnapshot>([
      ["in", latest({ isOutbound: false })],
      ["out", latest({ isOutbound: true })],
    ]);
    assert.deepEqual(filterNeedsReplyThreadIds(["in", "out", "missing"], map), ["in"]);
  });

  it("documents the same 100-thread-per-mailbox cap as Inbox loaders", () => {
    assert.equal(INBOX_OPS_THREAD_CAP_PER_MAILBOX, 100);
  });
});

describe("extractOpsPropertyUnitFromChips", () => {
  it("parses tenancy chips into property and unit", () => {
    const chips: InboxThreadChip[] = [
      { kind: "tenancy", label: "Tenancy · Oak Tower · Unit 4B · Ada Tenant" },
    ];
    assert.deepEqual(extractOpsPropertyUnitFromChips(chips), {
      propertyLabel: "Oak Tower",
      unitLabel: "4B",
    });
  });

  it("parses property chips without unit", () => {
    const chips: InboxThreadChip[] = [{ kind: "property", label: "Property · Oak Tower" }];
    assert.deepEqual(extractOpsPropertyUnitFromChips(chips), {
      propertyLabel: "Oak Tower",
      unitLabel: null,
    });
  });

  it("returns nulls when unlinked (no chips)", () => {
    assert.deepEqual(extractOpsPropertyUnitFromChips([]), {
      propertyLabel: null,
      unitLabel: null,
    });
  });
});

describe("mapDisplayRowToInboxOpsQueueRow", () => {
  it("maps display fields and preserves needs_reply / action state", () => {
    const row = mapDisplayRowToInboxOpsQueueRow({
      row: displayRow({
        chips: [{ kind: "tenancy", label: "Tenancy · Oak Tower · Unit 4B" }],
        unlinked: false,
        reviewRequired: true,
        actionState: "draft_review",
      }),
      mailboxId: "mb_1",
      organizationId: "org_1",
    });

    assert.equal(row.threadId, "thread_1");
    assert.equal(row.mailboxId, "mb_1");
    assert.equal(row.organizationId, "org_1");
    assert.equal(row.needsReply, true);
    assert.equal(row.reviewRequired, true);
    assert.equal(row.actionState, "draft_review");
    assert.equal(row.propertyLabel, "Oak Tower");
    assert.equal(row.unitLabel, "4B");
    assert.equal(row.senderLabel, "Ada Tenant");
    assert.equal(row.stakeholderLabel, "Tenant");
  });

  it("preserves unlinked inbound rows with unlinked flag", () => {
    const row = mapDisplayRowToInboxOpsQueueRow({
      row: displayRow({ unlinked: true, chips: [] }),
      mailboxId: "mb_1",
      organizationId: "org_1",
    });
    assert.equal(row.unlinked, true);
    assert.equal(row.needsReply, true);
    assert.equal(row.propertyLabel, null);
  });
});

describe("dedupeInboxOpsRowsByThreadId", () => {
  it("keeps the first mailbox occurrence for a thread id", () => {
    const a: InboxOpsQueueRow = {
      threadId: "t1",
      mailboxId: "mb_a",
      organizationId: "org_1",
      subject: "A",
      senderLabel: "S",
      stakeholderLabel: "Tenant",
      actionState: "reply_needed",
      unlinked: false,
      propertyLabel: null,
      unitLabel: null,
      lastMessageAt: null,
      needsReply: true,
      reviewRequired: false,
      unreadInbound: false,
    };
    const b = { ...a, mailboxId: "mb_b", subject: "B" };
    const deduped = dedupeInboxOpsRowsByThreadId([a, b]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.mailboxId, "mb_a");
  });
});
