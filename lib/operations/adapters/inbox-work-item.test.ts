import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxOpsQueueRow } from "@/lib/inbox/inbox-ops-queue";
import { INBOX_NEXT_ACTION_LABELS } from "@/lib/inbox/inbox-next-action";
import { classifyWorkItem } from "../classify-work-item";
import {
  adaptInboxThreadToWorkItemDraft,
  buildInboxNeedsReplyViewAllHref,
  buildInboxThreadHref,
  formatInboxOpsSubject,
} from "./inbox-work-item";

function baseRow(overrides: Partial<InboxOpsQueueRow> = {}): InboxOpsQueueRow {
  return {
    threadId: "thread_1",
    mailboxId: "mb_1",
    organizationId: "org_1",
    subject: "Leak in kitchen",
    senderLabel: "Ada Tenant",
    stakeholderLabel: "Tenant",
    actionState: "reply_needed",
    unlinked: false,
    propertyLabel: "Oak Tower",
    unitLabel: "4B",
    lastMessageAt: "2026-07-01T12:00:00.000Z",
    needsReply: true,
    reviewRequired: false,
    unreadInbound: false,
    ...overrides,
  };
}

describe("adaptInboxThreadToWorkItemDraft", () => {
  it("builds stable key, record type, mailbox-aware href, and needs_attention signals", () => {
    const draft = adaptInboxThreadToWorkItemDraft(baseRow());
    assert.ok(draft);
    assert.equal(draft.key, "inbox:thread_1");
    assert.equal(draft.recordType, "inbox_thread");
    assert.equal(draft.recordId, "thread_1");
    assert.equal(draft.title, "Leak in kitchen");
    assert.equal(draft.subtitle, "Ada Tenant");
    assert.equal(draft.propertyLabel, "Oak Tower");
    assert.equal(draft.unitLabel, "4B");
    assert.equal(draft.statusLabel, "Tenant");
    assert.equal(draft.nextActionLabel, INBOX_NEXT_ACTION_LABELS.reply_needed);
    assert.equal(draft.href, "/inbox/thread_1?mailbox=mb_1");
    assert.equal(draft.viewAllHref, "/inbox?mailbox=mb_1&queue=needs_reply");
    assert.equal(draft.workflowBadge, "Inbox");
    assert.equal(draft.dueAt, null);
    assert.equal(draft.waitingOn, "staff");
    assert.equal(draft.assignedToLabel, null);
    assert.equal(draft.urgency, "normal");
    assert.deepEqual(draft.secondaryIndicators, []);
    assert.equal(draft.signals.requiresStaffAction, true);
    assert.equal(draft.signals.isOverdue, false);
    assert.equal(draft.signals.isWaitingOnOther, false);
    assert.equal(draft.signals.isComingUp, false);
    assert.equal("snippet" in draft, false);
  });

  it("uses Draft review label when eligible needs_reply also has review-required draft", () => {
    const draft = adaptInboxThreadToWorkItemDraft(
      baseRow({
        reviewRequired: true,
        unreadInbound: true,
        actionState: "draft_review",
      }),
    );
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, INBOX_NEXT_ACTION_LABELS.draft_review);
  });

  it("uses New reply needed for unread inbound without draft review", () => {
    const draft = adaptInboxThreadToWorkItemDraft(
      baseRow({ unreadInbound: true, actionState: "new_reply_needed" }),
    );
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, INBOX_NEXT_ACTION_LABELS.new_reply_needed);
  });

  it("adds Unlinked secondary indicator only for eligible unlinked needs_reply", () => {
    const draft = adaptInboxThreadToWorkItemDraft(baseRow({ unlinked: true, propertyLabel: null }));
    assert.ok(draft);
    assert.deepEqual(draft.secondaryIndicators, ["Unlinked"]);
  });

  it("falls back to (No subject) like Inbox UI", () => {
    assert.equal(formatInboxOpsSubject(null), "(No subject)");
    assert.equal(formatInboxOpsSubject("  "), "(No subject)");
    const draft = adaptInboxThreadToWorkItemDraft(baseRow({ subject: null }));
    assert.ok(draft);
    assert.equal(draft.title, "(No subject)");
  });

  it("returns null when needsReply is false (draft-review-only must not enter Ops)", () => {
    assert.equal(
      adaptInboxThreadToWorkItemDraft(
        baseRow({
          needsReply: false,
          reviewRequired: true,
          actionState: "draft_review",
        }),
      ),
      null,
    );
  });

  it("classifies only into needs_attention — never overdue, waiting, or coming_up", () => {
    const draft = adaptInboxThreadToWorkItemDraft(baseRow());
    assert.ok(draft);
    const classified = classifyWorkItem(draft);
    assert.ok(classified);
    assert.equal(classified.primarySection, "needs_attention");
    assert.equal(classified.isOverdue, false);
  });

  it("keeps normal urgency for unread inbound (no high urgency mapping)", () => {
    const draft = adaptInboxThreadToWorkItemDraft(
      baseRow({ unreadInbound: true, actionState: "new_reply_needed" }),
    );
    assert.ok(draft);
    assert.equal(draft.urgency, "normal");
  });

  it("encodes mailbox and thread ids in deep links", () => {
    assert.equal(
      buildInboxThreadHref("t/1", "mb 2"),
      "/inbox/t%2F1?mailbox=mb%202",
    );
    assert.equal(
      buildInboxNeedsReplyViewAllHref("mb 2"),
      "/inbox?mailbox=mb%202&queue=needs_reply",
    );
  });
});
