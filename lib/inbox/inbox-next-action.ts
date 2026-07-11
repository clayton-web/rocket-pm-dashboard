import {
  deriveActionState,
  labelForInboxActionState,
  type InboxThreadActionState,
} from "@/lib/inbox/inbox-thread-display";

/**
 * Pure next-action derivation for Inbox thread action states.
 * Labels are shared with Inbox list meta lines via {@link labelForInboxActionState}.
 *
 * Operations eligibility (needs_reply) is enforced separately by the Ops queue loader.
 * This helper only describes display action state — a draft-review-only outbound thread
 * can return an actionable label here but must still be excluded from Ops 2B.1.
 */

export type InboxNextActionKind = InboxThreadActionState;

export type InboxNextAction = {
  kind: InboxNextActionKind;
  /** User-facing next-action label (matches Inbox UI). */
  label: string;
  /** True when the action state itself is an actionable display state (not no_action). */
  actionable: boolean;
};

export const INBOX_NEXT_ACTION_LABELS = {
  draft_review: "Draft review",
  new_reply_needed: "New reply needed",
  reply_needed: "Reply needed",
  no_action: "No action",
} as const satisfies Record<InboxNextActionKind, string>;

export function deriveInboxNextAction(args: {
  reviewRequired: boolean;
  unreadInbound: boolean;
  needsReply: boolean;
}): InboxNextAction {
  const kind = deriveActionState(args);
  const sharedLabel = labelForInboxActionState(kind);
  return {
    kind,
    label: sharedLabel ?? INBOX_NEXT_ACTION_LABELS.no_action,
    actionable: kind !== "no_action",
  };
}
