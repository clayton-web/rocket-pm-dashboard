"use client";

import Link from "next/link";
import {
  buildInboxBrowseAllLink,
  buildInboxSecondaryNavLinks,
  type InboxCrateActionCounts,
  type InboxCrateCounts,
  type InboxCrateFilter,
} from "@/lib/inbox/email-thread-category";

function mailboxCrateQuery(mailboxId: string, crate: InboxCrateFilter) {
  const params = new URLSearchParams({ mailbox: mailboxId, crate });
  return `/inbox?${params.toString()}`;
}

export function InboxSecondaryLinks(props: {
  mailboxId: string;
  crateCounts: InboxCrateCounts;
  crateActionCounts: InboxCrateActionCounts;
  activeCrate: InboxCrateFilter | null;
}) {
  const { mailboxId, crateCounts, crateActionCounts, activeCrate } = props;
  const secondaryLinks = buildInboxSecondaryNavLinks({ crateActionCounts });
  const browseAll = buildInboxBrowseAllLink(crateCounts);

  return (
    <div className="space-y-2 border-t border-neutral-100 pt-4">
      <p className="text-xs font-medium text-neutral-500">Other</p>
      {secondaryLinks.map((link) => (
        <Link
          key={link.crate}
          href={mailboxCrateQuery(mailboxId, link.crate)}
          className={`flex items-center justify-between gap-3 text-sm ${
            activeCrate === link.crate
              ? "font-medium text-neutral-900 underline"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <span>{link.label}</span>
          <span className="tabular-nums text-neutral-500">{link.countLabel}</span>
        </Link>
      ))}
      <Link
        href={mailboxCrateQuery(mailboxId, browseAll.crate)}
        className={`inline-block text-sm ${
          activeCrate === browseAll.crate
            ? "font-medium text-neutral-900 underline"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        {browseAll.label} ({browseAll.count})
      </Link>
    </div>
  );
}

export function inboxCommandCenterQuery(mailboxId: string) {
  return `/inbox?${new URLSearchParams({ mailbox: mailboxId }).toString()}`;
}
