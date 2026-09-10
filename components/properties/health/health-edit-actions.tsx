"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/portal/button";
import {
  PORTFOLIO_HEALTH_MISSING_LABELS,
  type PortfolioHealthMissingItemKey,
} from "@/lib/property/portfolio-health";
import type { PortfolioHealthFilteredRow } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  portfolioHealthEditTarget,
  propertyEditSectionAnchor,
} from "@/lib/property/portfolio-health-edit-targets";
import { orderPortfolioHealthIssueKeys } from "@/lib/property/portfolio-health-ranking";
import {
  buildHealthEditPropertyHref,
  type HealthViewState,
} from "@/lib/property/portfolio-health-return";

/**
 * Property-level edit entry points for one Property Health row.
 *
 * Every control is a link into the canonical Property Detail editor carrying the worklist state,
 * so returning lands back on the same filtered, searched and sorted list. Nothing here duplicates
 * the editor, and nothing renders unless the viewer can actually save: a control that predictably
 * fails is worse than no control.
 *
 * Fix labels are derived from `PORTFOLIO_HEALTH_MISSING_LABELS`, the same source the issue chips
 * use, so the two can never describe the same issue differently.
 */
function FixLink({
  issueKey,
  href,
}: {
  issueKey: PortfolioHealthMissingItemKey;
  href: string;
}) {
  const label = PORTFOLIO_HEALTH_MISSING_LABELS[issueKey];
  return (
    <Link href={href} className={buttonClasses({ variant: "secondary", size: "xs" })}>
      Fix
      <span className="sr-only">: {label}</span>
      <span aria-hidden="true" className="text-foreground-subtle">
        · {label}
      </span>
    </Link>
  );
}

export function HealthPropertyEditActions({
  row,
  viewState,
}: {
  row: PortfolioHealthFilteredRow;
  viewState: HealthViewState;
}) {
  if (!row.canEdit) {
    return (
      <p className="text-xs text-foreground-subtle">
        You have view-only access to this property.
      </p>
    );
  }

  const issueKeys = orderPortfolioHealthIssueKeys(row.visiblePropertyMissingItemKeys);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={buildHealthEditPropertyHref(row.propertyId, viewState, {
          anchor: propertyEditSectionAnchor("address"),
        })}
        className={buttonClasses({ variant: "primary", size: "xs" })}
      >
        Edit property
        <span className="sr-only"> {row.propertyLabel}</span>
      </Link>

      {issueKeys.map((issueKey) => {
        const target = portfolioHealthEditTarget(issueKey);

        if (target.kind === "property") {
          return (
            <FixLink
              key={issueKey}
              issueKey={issueKey}
              href={buildHealthEditPropertyHref(row.propertyId, viewState, {
                anchor: propertyEditSectionAnchor(target.section),
                field: target.field,
              })}
            />
          );
        }

        // Documents stay with the existing upload workflow on the property page.
        if (target.kind === "documents") {
          return (
            <FixLink
              key={issueKey}
              issueKey={issueKey}
              href={buildHealthEditPropertyHref(row.propertyId, viewState, {
                anchor: "documents",
              })}
            />
          );
        }

        // Tenant, rent and lease issues are repaired per unit, below.
        return null;
      })}
    </div>
  );
}
