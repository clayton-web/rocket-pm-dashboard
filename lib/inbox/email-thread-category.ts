import type { EmailThreadCategory } from "@prisma/client";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

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
  UNCATEGORIZED: "Uncategorized",
};

export const EMAIL_THREAD_CATEGORY_DESCRIPTIONS: Record<EmailThreadCategory, string> = {
  LANDLORD_COMMUNICATION:
    "Property owner/landlord messages, owner approvals, reporting, expenses, rent updates.",
  TENANT_COMMUNICATION:
    "Current tenant messages, repairs, rent, notices, complaints, move-out coordination.",
  STRATA: "Strata council, strata manager, bylaws, minutes, levies, move-in/out forms, strata documents.",
  TENANT_INQUIRY:
    "New rental leads, viewing requests, applications, availability questions.",
  UNCATEGORIZED: "Synced emails that have not yet been classified.",
};

export const ALL_INBOX_CRATE_LABEL = "All Inbox";

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
