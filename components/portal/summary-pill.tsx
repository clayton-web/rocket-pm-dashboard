import Link from "next/link";
import React from "react";

/**
 * Compact count-and-label jump target used by the operational command centres.
 *
 * Consolidated from four byte-identical copies (inbox, operations, leasing, onboarding). It stays
 * deliberately small: a count, a label, and a link. It is not a KPI card.
 *
 * In-page anchors render a plain `<a>` and routed destinations render `next/link`, which is what
 * the original copies did and what keeps hash navigation working.
 */
export function SummaryPill({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  if (count === 0) return null;

  const className =
    "inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-foreground-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  const content = (
    <>
      <span className="font-semibold tabular-nums text-foreground">{count}</span>
      <span>{label}</span>
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
