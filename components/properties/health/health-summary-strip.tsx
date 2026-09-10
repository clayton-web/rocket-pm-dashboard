"use client";

import { SURFACE_PANEL, toggleTileClasses } from "@/components/portal/ui";
import type { PortfolioHealthSummary } from "@/lib/property/portfolio-health";
import type { PortfolioHealthCleanupFilter } from "@/lib/property/portfolio-health-cleanup-filters";
import { buildPortfolioHealthFilterShortcuts } from "@/lib/property/portfolio-health-filter-shortcuts";
import {
  PORTFOLIO_HEALTH_STATUS_FILTER_LABELS,
  PORTFOLIO_HEALTH_STATUS_FILTERS,
  type PortfolioHealthStatusFilter,
} from "@/lib/property/portfolio-health-view";

/**
 * How many issue shortcuts the strip offers before deferring to the full filter panel.
 *
 * The brief is explicit that this page must not go back to two rows of toggle tiles, so the
 * strip surfaces only the largest piles of work; the remaining filters stay one click away in
 * the toolbar's filter disclosure.
 */
const MAX_SHORTCUTS = 4;

const STATUS_COUNTS: Record<PortfolioHealthStatusFilter, (s: PortfolioHealthSummary) => number> = {
  all: (s) => s.activeProperties,
  needs_attention: (s) => s.needsAttention,
  minor: (s) => s.minor,
  clear: (s) => s.clear,
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold tabular-nums text-foreground">{value}</span>{" "}
      <span className="text-foreground-muted">{label}</span>
    </span>
  );
}

/**
 * Replaces the nine-tile summary grid. The status totals and the status filter are the same
 * control rather than two rows showing the same numbers: on a triage page, a total staff cannot
 * act on is just decoration.
 */
export function HealthSummaryStrip({
  summary,
  status,
  onStatusChange,
  selectedFilters,
  onToggleFilter,
}: {
  summary: PortfolioHealthSummary;
  status: PortfolioHealthStatusFilter;
  onStatusChange: (status: PortfolioHealthStatusFilter) => void;
  selectedFilters: PortfolioHealthCleanupFilter[];
  onToggleFilter: (filter: PortfolioHealthCleanupFilter) => void;
}) {
  const shortcuts = buildPortfolioHealthFilterShortcuts(summary.issueSnapshot).slice(0, MAX_SHORTCUTS);

  return (
    <section
      aria-label="Portfolio health summary"
      className={`mb-4 ${SURFACE_PANEL}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by health status">
          {PORTFOLIO_HEALTH_STATUS_FILTERS.map((option) => {
            const active = status === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusChange(option)}
                className={toggleTileClasses(active)}
              >
                <span className="tabular-nums">{STATUS_COUNTS[option](summary)}</span>{" "}
                {PORTFOLIO_HEALTH_STATUS_FILTER_LABELS[option]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Metric label="tenancies" value={summary.activeTenancies} />
          <Metric label="vacant" value={summary.vacant} />
        </div>
      </div>

      {shortcuts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            Top issues
          </span>
          {shortcuts.map((shortcut) => {
            const active = selectedFilters.includes(shortcut.filter);
            return (
              <button
                key={shortcut.filter}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleFilter(shortcut.filter)}
                className={toggleTileClasses(active)}
              >
                {/* Separated, because "Rent = $0 57" reads as one broken value. */}
                {shortcut.label} <span aria-hidden="true">·</span>{" "}
                <span className="tabular-nums">{shortcut.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
