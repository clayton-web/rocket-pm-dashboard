"use client";

import { buttonClasses } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import {
  AttentionStatusBadge,
  IssueChipList,
  IssueTierCountLine,
} from "@/components/properties/health/health-status";
import { HealthPropertyEditActions } from "@/components/properties/health/health-edit-actions";
import type { PortfolioHealthFilteredRow } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  formatPortfolioHealthDocumentsState,
  formatPortfolioHealthOccupancy,
  formatPortfolioHealthOwnerState,
  formatPortfolioHealthUpdatedAt,
  type PortfolioHealthCell,
} from "@/lib/property/portfolio-health-format";
import { portfolioHealthRowTierCounts } from "@/lib/property/portfolio-health-ranking";
import { propertyEditSectionAnchor } from "@/lib/property/portfolio-health-edit-targets";
import {
  buildHealthEditPropertyHref,
  buildHealthEditTenancyHref,
  type HealthViewState,
} from "@/lib/property/portfolio-health-return";
import Link from "next/link";

/**
 * One grid template, used by both the column header and every row, so a column can never be
 * added to one and not the other.
 *
 * Below the breakpoint the same cells reflow into a two-column compact list row: the address
 * takes the width and the status sits opposite it, with the detail columns deferred to the
 * expanded panel rather than scrolled off the side of a desktop table.
 *
 * The multi-column layout starts at `xl`, not `lg`, because the dashboard shell spends a fixed
 * 240px on its sidebar: a 1024px viewport leaves roughly 736px of content, which crushed the
 * address column to an ellipsis. At `xl` there is about 990px to work with, which the eight
 * columns fit.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 xl:grid-cols-[minmax(0,2.2fr)_9.5rem_minmax(0,2.8fr)_4rem_5rem_4.5rem_4.5rem_4.5rem] xl:gap-y-0";

const DETAIL_CELL = "hidden xl:block text-xs text-foreground-muted";

/**
 * Visual column labels only. Each cell carries its own description in screen-reader text,
 * because a header row of plain text is announced once at the top of the list and is not
 * re-associated with the hundredth row the way a real `<th>` would be.
 */
export function HealthTableHeader() {
  return (
    <div
      aria-hidden="true"
      className={`${ROW_GRID} hidden border-b border-border bg-surface-muted py-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle xl:grid`}
    >
      <span>Property</span>
      <span>Health</span>
      <span>Issues</span>
      <span>Units</span>
      <span>Owner</span>
      <span>Docs</span>
      <span>Updated</span>
      <span className="text-right">Actions</span>
    </div>
  );
}

/**
 * The abbreviation is shown and the full sentence is announced, rather than both being read out.
 * `title` gives sighted users the same expansion on hover.
 */
function DetailCell({ label, cell }: { label: string; cell: PortfolioHealthCell }) {
  return (
    <span className={DETAIL_CELL} title={cell.description}>
      <span aria-hidden="true">{cell.short}</span>
      <span className="sr-only">
        {label}: {cell.description}
      </span>
    </span>
  );
}

function UnitDetail({
  slot,
  viewState,
  canEdit,
}: {
  slot: PortfolioHealthFilteredRow["visibleUnitSlots"][number];
  viewState: HealthViewState;
  canEdit: boolean;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-border py-2 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{slot.unitLabel}</p>
        {slot.tenantName ? (
          <p className="truncate text-xs text-foreground-muted">{slot.tenantName}</p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {slot.isVacant ? (
          <span className="text-xs text-foreground-subtle">No active tenancy</span>
        ) : (
          <IssueChipList issueKeys={slot.visibleTenantDataFlags} limit={Number.POSITIVE_INFINITY} />
        )}
      </div>

      {slot.tenancyId ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Tenancy edits authorize on the same property-manager predicate as `canEdit`, so a
              viewer without it would be sent to a form that refuses to save. */}
          {canEdit ? (
            <Link
              href={buildHealthEditTenancyHref(slot.tenancyId, viewState)}
              className={buttonClasses({ variant: "secondary", size: "xs" })}
            >
              Edit tenant info
            </Link>
          ) : null}
          <Link
            href={`/leasing/tenancies/${slot.tenancyId}`}
            className="text-xs font-medium text-foreground underline underline-offset-2"
          >
            Open tenancy
          </Link>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Diagnosis plus the edit entry points. Property-level issues link into the shared Property Detail
 * editor; tenant, rent and lease issues keep using the per-unit tenancy workflow below.
 */
function ExpandedDetail({
  row,
  panelId,
  viewState,
}: {
  row: PortfolioHealthFilteredRow;
  panelId: string;
  viewState: HealthViewState;
}) {
  const documents = formatPortfolioHealthDocumentsState(row.documentsStatus);
  const owner = formatPortfolioHealthOwnerState(row.ownerInfoStatus);
  const occupancy = formatPortfolioHealthOccupancy(row);
  const updated = formatPortfolioHealthUpdatedAt(row.updatedAt);

  return (
    <div id={panelId} className="border-t border-border bg-surface-muted px-3 py-3">
      <div className="flex flex-col gap-3">
        {/* Repeated on purpose: below `lg` these columns are not in the collapsed row at all. */}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs xl:hidden">
          {[
            { label: "Units", cell: occupancy },
            { label: "Owner", cell: owner },
            { label: "Docs", cell: documents },
            { label: "Updated", cell: updated },
          ].map(({ label, cell }) => (
            <div key={label} className="flex gap-1">
              <dt className="text-foreground-subtle">{label}</dt>
              <dd className="font-medium text-foreground" title={cell.description}>
                {cell.short}
              </dd>
            </div>
          ))}
        </dl>

        {row.hasImportPlaceholders ? (
          <p className="text-xs text-warning-foreground">
            Likely imported placeholders — review rent, deposit, and dates.
          </p>
        ) : null}

        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Property issues
          </h3>
          <IssueChipList
            issueKeys={row.visiblePropertyMissingItemKeys}
            limit={Number.POSITIVE_INFINITY}
          />
        </div>

        {row.visibleUnitSlots.length > 0 ? (
          <div>
            <h3 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Units
            </h3>
            <ul>
              {row.visibleUnitSlots.map((slot) => (
                <UnitDetail
                  key={slot.unitId}
                  slot={slot}
                  viewState={viewState}
                  canEdit={row.canEdit}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {/*
          The only editing entry point at every breakpoint. The collapsed row's Actions column is
          desktop-only, so on a phone this expanded panel is how a property gets edited at all.
        */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <HealthPropertyEditActions row={row} viewState={viewState} />
          <Link
            href={`/properties/${row.propertyId}`}
            className="text-xs font-medium text-foreground underline underline-offset-2"
          >
            Open property
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HealthPropertyRow({
  row,
  expanded,
  onToggle,
  viewState,
}: {
  row: PortfolioHealthFilteredRow;
  expanded: boolean;
  onToggle: (propertyId: string) => void;
  viewState: HealthViewState;
}) {
  const panelId = `health-detail-${row.propertyId}`;
  const counts = portfolioHealthRowTierCounts(row);

  return (
    <li className="border-b border-border last:border-b-0">
      <div className={`${ROW_GRID} items-start py-2 hover:bg-surface-muted xl:items-center`}>
        {/*
          The address is the disclosure control rather than a separate chevron next to inert
          text: it gives keyboard and pointer users the same large target, and keeps exactly one
          interactive element in the cell so the "Open" link never nests inside a button.
        */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? panelId : undefined}
          onClick={() => onToggle(row.propertyId)}
          className={`flex min-w-0 items-start gap-1.5 rounded-md text-left ${FOCUS_RING}`}
        >
          <span
            aria-hidden="true"
            className="mt-px w-3 shrink-0 text-sm leading-5 text-foreground-subtle"
          >
            {expanded ? "▾" : "▸"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {row.propertyLabel}
            </span>
            <span className="block truncate text-xs text-foreground-subtle">{row.cityLine}</span>
          </span>
        </button>

        <div className="flex flex-col items-end gap-0.5 justify-self-end xl:items-start xl:justify-self-start">
          <AttentionStatusBadge status={row.attentionStatus} />
          <IssueTierCountLine counts={counts} />
        </div>

        {/*
          Two chips plus a count, at both breakpoints. Three fitted the column only by wrapping
          onto three lines, which pushed the row past 90px and cost more scanning than the third
          issue bought; the full set is one click away in the expanded panel.
        */}
        <div className="col-span-2 min-w-0 xl:col-span-1">
          <IssueChipList issueKeys={row.missingItemKeys} limit={2} />
        </div>

        <DetailCell label="Units" cell={formatPortfolioHealthOccupancy(row)} />
        <DetailCell label="Owner" cell={formatPortfolioHealthOwnerState(row.ownerInfoStatus)} />
        <DetailCell label="Documents" cell={formatPortfolioHealthDocumentsState(row.documentsStatus)} />
        <DetailCell label="Updated" cell={formatPortfolioHealthUpdatedAt(row.updatedAt)} />

        {/*
          One control, so the column keeps its width and the row its height. Editors get the
          action they came for; everyone else keeps plain navigation. "Open property" is still in
          the expanded panel for both.
        */}
        <div className="hidden justify-end xl:flex">
          {row.canEdit ? (
            <Link
              href={buildHealthEditPropertyHref(row.propertyId, viewState, {
                anchor: propertyEditSectionAnchor("address"),
              })}
              className={buttonClasses({ variant: "secondary", size: "xs" })}
            >
              Edit
              <span className="sr-only"> {row.propertyLabel}</span>
            </Link>
          ) : (
            <Link
              href={`/properties/${row.propertyId}`}
              className={buttonClasses({ variant: "secondary", size: "xs" })}
            >
              Open
              <span className="sr-only"> {row.propertyLabel}</span>
            </Link>
          )}
        </div>
      </div>

      {expanded ? (
        <ExpandedDetail row={row} panelId={panelId} viewState={viewState} />
      ) : null}
    </li>
  );
}
