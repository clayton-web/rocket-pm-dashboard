"use client";

import Link from "next/link";
import {
  ALL_INBOX_CRATE,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
  type InboxCrateActionCounts,
  type InboxCrateCounts,
  type InboxCrateFilter,
} from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

function mailboxCrateQuery(mailboxId: string, crate: InboxCrateFilter) {
  const params = new URLSearchParams({ mailbox: mailboxId, crate });
  return `/inbox?${params.toString()}`;
}

function CratePill({
  href,
  label,
  count,
  active,
  secondary,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : secondary
            ? "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
            : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400"
      }`}
    >
      <span
        className={`font-semibold tabular-nums ${
          active ? "text-white" : secondary ? "text-neutral-700" : "text-neutral-900"
        }`}
      >
        {count}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function InboxCrateNav(props: {
  mailboxId: string;
  crateCounts: InboxCrateCounts;
  crateActionCounts: InboxCrateActionCounts;
  activeCrate: InboxCrateFilter | null;
}) {
  const { mailboxId, crateCounts, crateActionCounts, activeCrate } = props;

  const primaryCrates = INBOX_CRATE_ORDER.filter(
    (category) => category !== "UNCATEGORIZED",
  ).map((category: EmailThreadCategory) => ({
    crate: category as InboxCrateFilter,
    label: EMAIL_THREAD_CATEGORY_LABELS[category],
    count: crateActionCounts[category],
  }));

  const unsortedCrate = {
    crate: "UNCATEGORIZED" as InboxCrateFilter,
    label: EMAIL_THREAD_CATEGORY_LABELS.UNCATEGORIZED,
    count: crateCounts.UNCATEGORIZED,
  };

  const allInboxCrate = {
    crate: ALL_INBOX_CRATE,
    label: "All Inbox",
    count: crateCounts.all,
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-900">Browse by stakeholder</h2>
      <p className="text-xs text-neutral-600">
        Counts show threads needing reply. Unsorted shows total cleanup items.
      </p>
      <div className="flex flex-wrap gap-2">
        {primaryCrates.map(({ crate, label, count }) => (
          <CratePill
            key={crate}
            href={mailboxCrateQuery(mailboxId, crate)}
            label={label}
            count={count}
            active={activeCrate === crate}
          />
        ))}
        <CratePill
          href={mailboxCrateQuery(mailboxId, unsortedCrate.crate)}
          label={unsortedCrate.label}
          count={unsortedCrate.count}
          active={activeCrate === unsortedCrate.crate}
        />
        <CratePill
          href={mailboxCrateQuery(mailboxId, allInboxCrate.crate)}
          label={allInboxCrate.label}
          count={allInboxCrate.count}
          active={activeCrate === allInboxCrate.crate}
          secondary
        />
      </div>
    </div>
  );
}

export function inboxCommandCenterQuery(mailboxId: string) {
  return `/inbox?${new URLSearchParams({ mailbox: mailboxId }).toString()}`;
}
