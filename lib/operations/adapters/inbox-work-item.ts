import { deriveInboxNextAction } from "@/lib/inbox/inbox-next-action";
import type { InboxOpsQueueRow } from "@/lib/inbox/inbox-ops-queue";
import type { OperationalWorkItemDraft } from "@/lib/operations/work-item";

/** Subject fallback matches Inbox list / thread detail. */
export function formatInboxOpsSubject(subject: string | null | undefined): string {
  return subject?.trim() || "(No subject)";
}

export function buildInboxThreadHref(threadId: string, mailboxId: string): string {
  return `/inbox/${encodeURIComponent(threadId)}?mailbox=${encodeURIComponent(mailboxId)}`;
}

export function buildInboxNeedsReplyViewAllHref(mailboxId: string): string {
  return `/inbox?mailbox=${encodeURIComponent(mailboxId)}&queue=needs_reply`;
}

/**
 * Adapt an eligible needs_reply Inbox Ops row into an Operations draft.
 * Returns null if the row is not needs_reply (defensive — loader should already filter).
 *
 * Eligibility is needs_reply only. Action-state labels (including Draft review) are
 * display-only and must not admit draft-review-only outbound threads.
 */
export function adaptInboxThreadToWorkItemDraft(
  row: InboxOpsQueueRow,
): OperationalWorkItemDraft | null {
  if (!row.needsReply) {
    return null;
  }

  const next = deriveInboxNextAction({
    reviewRequired: row.reviewRequired,
    unreadInbound: row.unreadInbound,
    needsReply: row.needsReply,
  });

  const secondaryIndicators: string[] = [];
  if (row.unlinked) {
    secondaryIndicators.push("Unlinked");
  }
  // Stakeholder is statusLabel — do not duplicate as a secondary chip.

  return {
    key: `inbox:${row.threadId}`,
    recordType: "inbox_thread",
    recordId: row.threadId,
    title: formatInboxOpsSubject(row.subject),
    subtitle: row.senderLabel || null,
    propertyLabel: row.propertyLabel,
    unitLabel: row.unitLabel,
    statusLabel: row.stakeholderLabel || "Needs reply",
    nextActionLabel: next.label,
    href: buildInboxThreadHref(row.threadId, row.mailboxId),
    viewAllHref: buildInboxNeedsReplyViewAllHref(row.mailboxId),
    workflowBadge: "Inbox",
    dueAt: null,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: "normal",
    secondaryIndicators,
    signals: {
      requiresStaffAction: true,
      isOverdue: false,
      isWaitingOnOther: false,
      isComingUp: false,
    },
  };
}
