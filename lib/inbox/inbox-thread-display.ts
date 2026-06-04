import { isPmContextLink, parseEmailThreadContextLinks, type PmContextLink } from "@/lib/ai/email-context-links";
import type { LatestDraftSnapshot, LatestMessageSnapshot, InboxThreadRecord } from "@/lib/inbox/inbox-thread-data";
import { getPmLinkDisplay, resolvePmLinkDisplay, type PmLinkDisplay } from "@/lib/inbox/pm-link-display";

const LIST_CHIP_KINDS = new Set<PmContextLink["kind"]>(["property", "tenancy", "maintenance_request"]);

export type InboxThreadBadge = "review_required" | "draft_ready";

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
  needsReply: boolean;
  unreadInbound: boolean;
  unlinked: boolean;
  reviewRequired: boolean;
  hasDraftReady: boolean;
  draftCreatedAt: string | null;
  badges: InboxThreadBadge[];
  chips: InboxThreadChip[];
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

function buildBadges(reviewRequired: boolean, hasDraft: boolean): InboxThreadBadge[] {
  if (reviewRequired) return ["review_required"];
  if (hasDraft) return ["draft_ready"];
  return [];
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

    return {
      id: thread.id,
      subject: thread.subject,
      snippet: thread.snippet,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      isUnread: thread.isUnread,
      participantEmails: thread.participantEmails,
      needsReply,
      unreadInbound,
      unlinked,
      reviewRequired,
      hasDraftReady,
      draftCreatedAt: draft?.createdAt.toISOString() ?? null,
      badges: buildBadges(reviewRequired, draft != null),
      chips: buildChips(pmLinks, displayMap),
    };
  });
}
