import { isPmContextLink, parseEmailThreadContextLinks, type PmContextLink } from "@/lib/ai/email-context-links";
import { isClassificationReviewThread } from "@/lib/inbox/classification-review";
import type { EmailThreadCategory } from "@prisma/client";
import type { LatestDraftSnapshot, LatestMessageSnapshot, InboxThreadRecord } from "@/lib/inbox/inbox-thread-data";
import { getEffectiveCategories, getPrimaryStakeholderCategory, STAKEHOLDER_SHORT_LABELS } from "@/lib/inbox/thread-category-assignments";
import { getPmLinkDisplay, resolvePmLinkDisplay, type PmLinkDisplay } from "@/lib/inbox/pm-link-display";

const LIST_CHIP_KINDS = new Set<PmContextLink["kind"]>(["property", "tenancy", "maintenance_request"]);

export type InboxThreadBadge = "review_required" | "classification_review" | "draft_ready";

export type InboxThreadActionState =
  | "draft_review"
  | "new_reply_needed"
  | "reply_needed"
  | "no_action";

export type InboxThreadChip = {
  kind: PmContextLink["kind"];
  label: string;
};

export type InboxThreadDisplayRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  isUnread: boolean;
  participantEmails: string[];
  category: EmailThreadCategory;
  categories: EmailThreadCategory[];
  categorySource: string | null;
  categoryConfidence: number | null;
  categoryAiReason: string | null;
  lastClassificationAttemptAt: string | null;
  needsClassificationReview: boolean;
  needsReply: boolean;
  unreadInbound: boolean;
  unlinked: boolean;
  reviewRequired: boolean;
  hasDraftReady: boolean;
  draftCreatedAt: string | null;
  badges: InboxThreadBadge[];
  chips: InboxThreadChip[];
  actionState: InboxThreadActionState;
  stakeholderLabel: string;
  primaryContextLabel: string;
};

function chipPrefix(kind: PmContextLink["kind"]): string {
  if (kind === "property") return "Property";
  if (kind === "tenancy") return "Tenancy";
  if (kind === "maintenance_request") return "Maintenance";
  return "";
}

function buildChips(pmLinks: PmContextLink[], displayMap: Map<string, PmLinkDisplay>): InboxThreadChip[] {
  const chips: InboxThreadChip[] = [];
  for (const link of pmLinks) {
    if (!LIST_CHIP_KINDS.has(link.kind)) continue;
    const display = getPmLinkDisplay(displayMap, link);
    if (!display) continue;
    chips.push({
      kind: link.kind,
      label: `${chipPrefix(link.kind)} · ${display.chipLabel}`,
    });
  }
  return chips;
}

function buildBadges(
  reviewRequired: boolean,
  needsClassificationReview: boolean,
  hasDraft: boolean,
): InboxThreadBadge[] {
  if (reviewRequired) return ["review_required"];
  if (needsClassificationReview) return ["classification_review"];
  if (hasDraft) return ["draft_ready"];
  return [];
}

export function deriveActionState(args: {
  reviewRequired: boolean;
  unreadInbound: boolean;
  needsReply: boolean;
}): InboxThreadActionState {
  if (args.reviewRequired) return "draft_review";
  if (args.unreadInbound) return "new_reply_needed";
  if (args.needsReply) return "reply_needed";
  return "no_action";
}

const PRIMARY_CHIP_KIND_ORDER: PmContextLink["kind"][] = [
  "tenancy",
  "property",
  "maintenance_request",
];

function stripChipPrefix(label: string): string {
  return label.replace(/^(Property|Tenancy|Maintenance) · /, "");
}

export function derivePrimaryContextLabel(args: {
  chips: InboxThreadChip[];
  stakeholderLabel: string;
  subject: string | null;
  unlinked: boolean;
}): string {
  for (const kind of PRIMARY_CHIP_KIND_ORDER) {
    const chip = args.chips.find((entry) => entry.kind === kind);
    if (chip) return stripChipPrefix(chip.label);
  }

  if (args.unlinked) return `${args.stakeholderLabel} · Unlinked`;
  const trimmedSubject = args.subject?.trim();
  if (trimmedSubject) return trimmedSubject;
  return args.stakeholderLabel;
}

export function deriveStakeholderLabel(categories: EmailThreadCategory[]): string {
  const primary = getPrimaryStakeholderCategory(categories);
  return STAKEHOLDER_SHORT_LABELS[primary];
}

export async function buildInboxThreadDisplayRows(
  organizationId: string,
  threads: InboxThreadRecord[],
  latestMessages: Map<string, LatestMessageSnapshot>,
  latestDrafts: Map<string, LatestDraftSnapshot>,
): Promise<InboxThreadDisplayRow[]> {
  const allPmLinks: PmContextLink[] = [];
  for (const thread of threads) {
    const links = parseEmailThreadContextLinks(thread.contextLinks).filter(isPmContextLink);
    allPmLinks.push(...links);
  }

  const displayMap = await resolvePmLinkDisplay(organizationId, allPmLinks);

  return threads.map((thread) => {
    const pmLinks = parseEmailThreadContextLinks(thread.contextLinks).filter(isPmContextLink);
    const latest = latestMessages.get(thread.id);
    const draft = latestDrafts.get(thread.id);
    const needsReply = latest != null && !latest.isOutbound;
    const unreadInbound = thread.isUnread && needsReply;
    const unlinked = pmLinks.length === 0;
    const reviewRequired = draft?.reviewRequired ?? false;
    const hasDraftReady = draft != null && !reviewRequired;
    const categories = getEffectiveCategories(thread.categoryAssignments, thread.category);
    const effectiveCategories: EmailThreadCategory[] =
      categories.length > 0 ? categories : ["UNCATEGORIZED"];
    const needsClassificationReview = isClassificationReviewThread({
      category: thread.category,
      categorySource: thread.categorySource,
      lastClassificationAttemptAt: thread.lastClassificationAttemptAt,
      assignments: thread.categoryAssignments,
    });
    const chips = buildChips(pmLinks, displayMap);
    const stakeholderLabel = deriveStakeholderLabel(effectiveCategories);
    const actionState = deriveActionState({ reviewRequired, unreadInbound, needsReply });
    const primaryContextLabel = derivePrimaryContextLabel({
      chips,
      stakeholderLabel,
      subject: thread.subject,
      unlinked,
    });

    return {
      id: thread.id,
      subject: thread.subject,
      snippet: thread.snippet,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      isUnread: thread.isUnread,
      participantEmails: thread.participantEmails,
      category: thread.category,
      categories: effectiveCategories,
      categorySource: thread.categorySource,
      categoryConfidence: thread.categoryConfidence,
      categoryAiReason: thread.categoryAiReason,
      lastClassificationAttemptAt: thread.lastClassificationAttemptAt?.toISOString() ?? null,
      needsClassificationReview,
      needsReply,
      unreadInbound,
      unlinked,
      reviewRequired,
      hasDraftReady,
      draftCreatedAt: draft?.createdAt.toISOString() ?? null,
      badges: buildBadges(reviewRequired, needsClassificationReview, draft != null),
      chips,
      actionState,
      stakeholderLabel,
      primaryContextLabel,
    };
  });
}
