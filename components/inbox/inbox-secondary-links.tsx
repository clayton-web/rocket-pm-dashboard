"use client";

import Link from "next/link";
import { FOCUS_RING } from "@/components/portal/focus";
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
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-xs font-medium text-foreground-subtle">Other</p>
      {secondaryLinks.map((link) => (
        <Link
          key={link.crate}
          href={mailboxCrateQuery(mailboxId, link.crate)}
          aria-current={activeCrate === link.crate ? "true" : undefined}
          className={`flex items-center justify-between gap-3 rounded-sm text-sm ${FOCUS_RING} ${
            activeCrate === link.crate
              ? "font-medium text-foreground underline"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <span>{link.label}</span>
          <span className="tabular-nums text-foreground-subtle">{link.countLabel}</span>
        </Link>
      ))}
      <Link
        href={mailboxCrateQuery(mailboxId, browseAll.crate)}
        aria-current={activeCrate === browseAll.crate ? "true" : undefined}
        className={`inline-block rounded-sm text-sm ${FOCUS_RING} ${
          activeCrate === browseAll.crate
            ? "font-medium text-foreground underline"
            : "text-foreground-muted hover:text-foreground"
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
