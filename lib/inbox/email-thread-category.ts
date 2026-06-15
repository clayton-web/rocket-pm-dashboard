import type { EmailThreadCategory } from "@prisma/client";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

/** Finalized PM stakeholder bin order for the inbox homepage (excludes Tenant Inquiries). */
export const INBOX_STAKEHOLDER_BIN_ORDER = [
  "LANDLORD_COMMUNICATION",
  "TENANT_COMMUNICATION",
  "STRATA",
  "UNCATEGORIZED",
] as const satisfies readonly EmailThreadCategory[];

export type InboxStakeholderBinCategory = (typeof INBOX_STAKEHOLDER_BIN_ORDER)[number];

/** Dashboard inbox crates in display order. All Inbox is handled separately. */
export const INBOX_CRATE_ORDER: readonly EmailThreadCategory[] = [
  "LANDLORD_COMMUNICATION",
  "TENANT_COMMUNICATION",
  "STRATA",
  "TENANT_INQUIRY",
  "UNCATEGORIZED",
] as const;

export const ALL_INBOX_CRATE = "all" as const;

export type InboxCrateFilter = EmailThreadCategory | typeof ALL_INBOX_CRATE;

export const EMAIL_THREAD_CATEGORY_LABELS: Record<EmailThreadCategory, string> = {
  LANDLORD_COMMUNICATION: "Landlord Communication",
  TENANT_COMMUNICATION: "Tenant Communication",
  STRATA: "Strata",
  TENANT_INQUIRY: "Tenant Inquiries",
  UNCATEGORIZED: "Unsorted",
};

/** Short labels for stakeholder bins. */
export const INBOX_STAKEHOLDER_BIN_SHORT_LABELS: Record<InboxStakeholderBinCategory, string> = {
  LANDLORD_COMMUNICATION: "Landlords",
  TENANT_COMMUNICATION: "Tenants",
  STRATA: "Strata",
  UNCATEGORIZED: "Unsorted",
};

export type InboxSecondaryNavLink = {
  crate: InboxCrateFilter;
  label: string;
  count: number;
  countLabel: string;
};

export type InboxBrowseAllLink = {
  crate: typeof ALL_INBOX_CRATE;
  label: string;
  count: number;
};

export const STAKEHOLDER_BIN_EMPTY_MESSAGES: Record<InboxStakeholderBinCategory, string> = {
  LANDLORD_COMMUNICATION: "No landlord threads waiting for a reply.",
  TENANT_COMMUNICATION: "No tenant threads waiting for a reply.",
  STRATA: "No strata threads waiting for a reply.",
  UNCATEGORIZED: "No unsorted threads.",
};

export const STAKEHOLDER_BIN_SECTION_IDS: Record<InboxStakeholderBinCategory, string> = {
  LANDLORD_COMMUNICATION: "landlord-communication",
  TENANT_COMMUNICATION: "tenant-communication",
  STRATA: "strata-communication",
  UNCATEGORIZED: "unsorted",
};

export const EMAIL_THREAD_CATEGORY_DESCRIPTIONS: Record<EmailThreadCategory, string> = {
  LANDLORD_COMMUNICATION:
    "Property owner/landlord messages, owner approvals, reporting, expenses, rent updates.",
  TENANT_COMMUNICATION:
    "Current tenant messages, repairs, rent, notices, complaints, move-out coordination.",
  STRATA: "Strata council, strata manager, bylaws, minutes, levies, move-in/out forms, strata documents.",
  TENANT_INQUIRY:
    "New rental leads, viewing requests, applications, availability questions.",
  UNCATEGORIZED: "Synced emails that have not yet been sorted into a stakeholder lane.",
};

export const ALL_INBOX_CRATE_LABEL = "All threads";

export function formatPriorityRailCountLabel(
  category: EmailThreadCategory,
  count: number,
): string {
  if (category === "UNCATEGORIZED") {
    return count === 1 ? "1 item" : `${count} items`;
  }
  return count === 1 ? "1 waiting" : `${count} waiting`;
}

export function buildInboxSecondaryNavLinks(args: {
  crateActionCounts: InboxCrateActionCounts;
}): InboxSecondaryNavLink[] {
  const count = args.crateActionCounts.TENANT_INQUIRY;
  return [
    {
      crate: "TENANT_INQUIRY",
      label: EMAIL_THREAD_CATEGORY_LABELS.TENANT_INQUIRY,
      count,
      countLabel: formatPriorityRailCountLabel("TENANT_INQUIRY", count),
    },
  ];
}

export function buildInboxBrowseAllLink(crateCounts: InboxCrateCounts): InboxBrowseAllLink {
  return {
    crate: ALL_INBOX_CRATE,
    label: "Browse all threads",
    count: crateCounts.all,
  };
}

export type EmailThreadCategorySource = "manual" | "ai" | "rule" | "approved_rule";

const CATEGORY_SET = new Set<string>(INBOX_CRATE_ORDER);

export function isEmailThreadCategory(value: string): value is EmailThreadCategory {
  return CATEGORY_SET.has(value);
}

export function isInboxCrateFilter(value: string | undefined): value is InboxCrateFilter {
  if (!value) return false;
  if (value === ALL_INBOX_CRATE) return true;
  return isEmailThreadCategory(value);
}

export function filterRowsByCrate(
  rows: InboxThreadDisplayRow[],
  crate: InboxCrateFilter,
): InboxThreadDisplayRow[] {
  if (crate === ALL_INBOX_CRATE) {
    return [...rows].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  }

  return rows
    .filter((row) => row.categories.includes(crate))
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
}

export type InboxCrateCounts = Record<EmailThreadCategory, number> & {
  all: number;
};

/** Needs-reply counts per crate from loaded display rows (overlapping assignments allowed). */
export type InboxCrateActionCounts = InboxCrateCounts;

export function computeCrateNeedsReplyCounts(rows: InboxThreadDisplayRow[]): InboxCrateActionCounts {
  const counts: InboxCrateActionCounts = {
    LANDLORD_COMMUNICATION: 0,
    TENANT_COMMUNICATION: 0,
    STRATA: 0,
    TENANT_INQUIRY: 0,
    UNCATEGORIZED: 0,
    all: 0,
  };

  for (const row of rows) {
    if (!row.needsReply) continue;
    for (const category of row.categories) {
      counts[category] += 1;
    }
  }

  return counts;
}

export function computeCrateCounts(rows: InboxThreadDisplayRow[]): InboxCrateCounts {
  const counts: InboxCrateCounts = {
    LANDLORD_COMMUNICATION: 0,
    TENANT_COMMUNICATION: 0,
    STRATA: 0,
    TENANT_INQUIRY: 0,
    UNCATEGORIZED: 0,
    all: rows.length,
  };

  for (const row of rows) {
    for (const category of row.categories) {
      counts[category] += 1;
    }
  }

  return counts;
}

export function mapAssignmentGroupByToCrateCounts(
  groups: ReadonlyArray<{ category: EmailThreadCategory; _count: { _all: number } }>,
  totalThreads: number,
): InboxCrateCounts {
  const counts: InboxCrateCounts = {
    LANDLORD_COMMUNICATION: 0,
    TENANT_COMMUNICATION: 0,
    STRATA: 0,
    TENANT_INQUIRY: 0,
    UNCATEGORIZED: 0,
    all: totalThreads,
  };

  for (const group of groups) {
    counts[group.category] = group._count._all;
  }

  return counts;
}

/** @deprecated Use mapAssignmentGroupByToCrateCounts for overlapping crate counts. */
export function mapGroupByToCrateCounts(
  groups: ReadonlyArray<{ category: EmailThreadCategory; _count: { _all: number } }>,
): InboxCrateCounts {
  const counts: InboxCrateCounts = {
    LANDLORD_COMMUNICATION: 0,
    TENANT_COMMUNICATION: 0,
    STRATA: 0,
    TENANT_INQUIRY: 0,
    UNCATEGORIZED: 0,
    all: 0,
  };

  for (const group of groups) {
    counts[group.category] = group._count._all;
    counts.all += group._count._all;
  }

  return counts;
}

export function inboxCrateLabel(crate: InboxCrateFilter): string {
  if (crate === ALL_INBOX_CRATE) return ALL_INBOX_CRATE_LABEL;
  return EMAIL_THREAD_CATEGORY_LABELS[crate];
}
