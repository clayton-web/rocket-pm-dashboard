import { listMailboxesForInbox } from "@/lib/gmail/sync-permissions";
import {
  loadInboxThreadsForMailbox,
  loadLatestDraftsByThreadId,
  loadLatestMessagesByThreadId,
  type LatestMessageSnapshot,
} from "@/lib/inbox/inbox-thread-data";
import {
  buildInboxThreadDisplayRows,
  type InboxThreadActionState,
  type InboxThreadChip,
  type InboxThreadDisplayRow,
} from "@/lib/inbox/inbox-thread-display";
import type { StaffContext } from "@/lib/services/staff-context";

/**
 * Focused Inbox Operations queue — deterministic needs_reply only.
 * Does not call getInboxCommandCenter; does not load briefing attention.
 *
 * Mailbox failure strategy: any mailbox load failure fails the entire Inbox Ops
 * source (Promise.all), matching other Operations sources' all-or-nothing loaders.
 * Partial cross-mailbox results are not returned.
 */

/** Same cap as {@link loadInboxThreadsForMailbox}. */
export const INBOX_OPS_THREAD_CAP_PER_MAILBOX = 100;

export type InboxOpsQueueRow = {
  threadId: string;
  mailboxId: string;
  organizationId: string;
  subject: string | null;
  senderLabel: string;
  stakeholderLabel: string;
  actionState: InboxThreadActionState;
  unlinked: boolean;
  propertyLabel: string | null;
  unitLabel: string | null;
  lastMessageAt: string | null;
  /** True when latest message exists and is inbound — Ops eligibility gate. */
  needsReply: boolean;
  reviewRequired: boolean;
  unreadInbound: boolean;
};

/**
 * Deterministic needs_reply eligibility — identical to Inbox display:
 * latest message exists AND latest message is inbound (!isOutbound).
 */
export function isInboxNeedsReplyLatestMessage(
  latest: LatestMessageSnapshot | undefined | null,
): boolean {
  return latest != null && !latest.isOutbound;
}

export function filterNeedsReplyThreadIds(
  threadIds: string[],
  latestByThreadId: Map<string, LatestMessageSnapshot>,
): string[] {
  return threadIds.filter((id) => isInboxNeedsReplyLatestMessage(latestByThreadId.get(id)));
}

/**
 * Prefer tenancy, then property chips from Inbox display rows for Ops location fields.
 * Chip labels use the same formats as {@link buildInboxThreadDisplayRows}.
 */
export function extractOpsPropertyUnitFromChips(
  chips: InboxThreadChip[],
): { propertyLabel: string | null; unitLabel: string | null } {
  const tenancy = chips.find((chip) => chip.kind === "tenancy");
  if (tenancy) {
    const stripped = tenancy.label.replace(/^Tenancy · /, "");
    const match = stripped.match(/^(.+?) · Unit (.+?)(?: · .+)?$/);
    if (match) {
      return { propertyLabel: match[1] ?? null, unitLabel: match[2] ?? null };
    }
  }

  const property = chips.find((chip) => chip.kind === "property");
  if (property) {
    return {
      propertyLabel: property.label.replace(/^Property · /, ""),
      unitLabel: null,
    };
  }

  return { propertyLabel: null, unitLabel: null };
}

export function mapDisplayRowToInboxOpsQueueRow(args: {
  row: InboxThreadDisplayRow;
  mailboxId: string;
  organizationId: string;
}): InboxOpsQueueRow {
  const { propertyLabel, unitLabel } = extractOpsPropertyUnitFromChips(args.row.chips);

  return {
    threadId: args.row.id,
    mailboxId: args.mailboxId,
    organizationId: args.organizationId,
    subject: args.row.subject,
    senderLabel: args.row.senderLabel,
    stakeholderLabel: args.row.stakeholderLabel,
    actionState: args.row.actionState,
    unlinked: args.row.unlinked,
    propertyLabel,
    unitLabel,
    lastMessageAt: args.row.lastMessageAt,
    needsReply: args.row.needsReply,
    reviewRequired: args.row.reviewRequired,
    unreadInbound: args.row.unreadInbound,
  };
}

/** First occurrence wins — EmailThread is mailbox-scoped; defensive against duplicates. */
export function dedupeInboxOpsRowsByThreadId(rows: InboxOpsQueueRow[]): InboxOpsQueueRow[] {
  const seen = new Set<string>();
  const out: InboxOpsQueueRow[] = [];
  for (const row of rows) {
    if (seen.has(row.threadId)) continue;
    seen.add(row.threadId);
    out.push(row);
  }
  return out;
}

type MailboxRef = { id: string };

async function loadNeedsReplyRowsForMailbox(args: {
  organizationId: string;
  mailboxId: string;
}): Promise<InboxOpsQueueRow[]> {
  const threads = await loadInboxThreadsForMailbox(args.organizationId, args.mailboxId);
  if (threads.length === 0) return [];

  const threadIds = threads.map((t) => t.id);
  const latestMessages = await loadLatestMessagesByThreadId(threadIds);
  const needsReplyIds = new Set(filterNeedsReplyThreadIds(threadIds, latestMessages));
  if (needsReplyIds.size === 0) return [];

  const eligibleThreads = threads.filter((t) => needsReplyIds.has(t.id));
  const eligibleIds = eligibleThreads.map((t) => t.id);

  // Drafts only for eligible needs_reply threads (action-state label, not eligibility).
  const latestDrafts = await loadLatestDraftsByThreadId(args.organizationId, eligibleIds);

  const displayRows = await buildInboxThreadDisplayRows(
    args.organizationId,
    eligibleThreads,
    latestMessages,
    latestDrafts,
  );

  return displayRows
    .filter((row) => row.needsReply)
    .map((row) =>
      mapDisplayRowToInboxOpsQueueRow({
        row,
        mailboxId: args.mailboxId,
        organizationId: args.organizationId,
      }),
    );
}

/**
 * Union needs_reply threads across all mailboxes visible via listMailboxesForInbox.
 * Does not apply property-assignment filtering.
 */
export async function listNeedsReplyInboxQueueForStaff(
  ctx: StaffContext,
): Promise<InboxOpsQueueRow[]> {
  const mailboxes: MailboxRef[] = await listMailboxesForInbox({
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    activeRole: ctx.organizationRole,
  });

  if (mailboxes.length === 0) return [];

  // Fail-fast across mailboxes: one failure fails the Inbox Ops source.
  const perMailbox = await Promise.all(
    mailboxes.map((mailbox) =>
      loadNeedsReplyRowsForMailbox({
        organizationId: ctx.organizationId,
        mailboxId: mailbox.id,
      }),
    ),
  );

  return dedupeInboxOpsRowsByThreadId(perMailbox.flat());
}
