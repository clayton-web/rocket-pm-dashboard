"use client";

import Link from "next/link";
import {
  ALL_INBOX_CRATE,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
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
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400"
      }`}
    >
      <span className={`font-semibold tabular-nums ${active ? "text-white" : "text-neutral-900"}`}>
        {count}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function InboxCrateNav(props: {
  mailboxId: string;
  crateCounts: InboxCrateCounts;
  activeCrate: InboxCrateFilter | null;
}) {
  const { mailboxId, crateCounts, activeCrate } = props;

  const crates: { crate: InboxCrateFilter; label: string; count: number }[] = [
    ...INBOX_CRATE_ORDER.map((category: EmailThreadCategory) => ({
      crate: category as InboxCrateFilter,
      label: EMAIL_THREAD_CATEGORY_LABELS[category],
      count: crateCounts[category],
    })),
    {
      crate: ALL_INBOX_CRATE,
      label: "All Inbox",
      count: crateCounts.all,
    },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-900">Inbox crates</h2>
      <p className="text-xs text-neutral-600">
        Rocket PM categories for synced Gmail threads. Gmail labels are not changed.
      </p>
      <div className="flex flex-wrap gap-2">
        {crates.map(({ crate, label, count }) => (
          <CratePill
            key={crate}
            href={mailboxCrateQuery(mailboxId, crate)}
            label={label}
            count={count}
            active={activeCrate === crate}
          />
        ))}
      </div>
    </div>
  );
}

export function inboxCommandCenterQuery(mailboxId: string) {
  return `/inbox?${new URLSearchParams({ mailbox: mailboxId }).toString()}`;
}
