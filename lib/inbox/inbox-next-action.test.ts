import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labelForInboxActionState } from "@/lib/inbox/inbox-thread-display";
import {
  deriveInboxNextAction,
  INBOX_NEXT_ACTION_LABELS,
} from "./inbox-next-action";

describe("deriveInboxNextAction", () => {
  it("returns Draft review for review-required inbound (label matches Inbox UI)", () => {
    const next = deriveInboxNextAction({
      reviewRequired: true,
      unreadInbound: true,
      needsReply: true,
    });
    assert.equal(next.kind, "draft_review");
    assert.equal(next.label, "Draft review");
    assert.equal(next.label, labelForInboxActionState("draft_review"));
    assert.equal(next.label, INBOX_NEXT_ACTION_LABELS.draft_review);
    assert.equal(next.actionable, true);
  });

  it("returns New reply needed for unread inbound without draft review", () => {
    const next = deriveInboxNextAction({
      reviewRequired: false,
      unreadInbound: true,
      needsReply: true,
    });
    assert.equal(next.kind, "new_reply_needed");
    assert.equal(next.label, "New reply needed");
    assert.equal(next.label, labelForInboxActionState("new_reply_needed"));
    assert.equal(next.actionable, true);
  });

  it("returns Reply needed for read inbound", () => {
    const next = deriveInboxNextAction({
      reviewRequired: false,
      unreadInbound: false,
      needsReply: true,
    });
    assert.equal(next.kind, "reply_needed");
    assert.equal(next.label, "Reply needed");
    assert.equal(next.label, labelForInboxActionState("reply_needed"));
    assert.equal(next.actionable, true);
  });

  it("returns no_action when not needs_reply (does not imply Ops eligibility)", () => {
    const next = deriveInboxNextAction({
      reviewRequired: false,
      unreadInbound: false,
      needsReply: false,
    });
    assert.equal(next.kind, "no_action");
    assert.equal(next.label, INBOX_NEXT_ACTION_LABELS.no_action);
    assert.equal(next.actionable, false);
    assert.equal(labelForInboxActionState("no_action"), null);
  });

  it("prefers draft review over reply even when needs_reply is false (display only)", () => {
    // Draft-review-only outbound: actionable label exists, but Ops loader must still exclude.
    const next = deriveInboxNextAction({
      reviewRequired: true,
      unreadInbound: false,
      needsReply: false,
    });
    assert.equal(next.kind, "draft_review");
    assert.equal(next.actionable, true);
  });
});
