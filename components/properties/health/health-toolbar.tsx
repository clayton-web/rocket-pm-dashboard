"use client";

import { buttonClasses } from "@/components/portal/button";
import { formControlClasses } from "@/components/portal/form-control";
import { SURFACE_PANEL, toggleTileClasses } from "@/components/portal/ui";
import {
  PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS,
  PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS,
  PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  PORTFOLIO_HEALTH_SORT_LABELS,
  PORTFOLIO_HEALTH_SORTS,
  type PortfolioHealthSort,
} from "@/lib/property/portfolio-health-ranking";
import { useId, useState } from "react";

function FilterGroup({
  legend,
  filters,
  selected,
  onToggle,
}: {
  legend: string;
  filters: PortfolioHealthCleanupFilter[];
  selected: PortfolioHealthCleanupFilter[];
  onToggle: (filter: PortfolioHealthCleanupFilter) => void;
}) {
  return (
    <div role="group" aria-label={legend}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
        {legend}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => {
          const active = selected.includes(filter);
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onToggle(filter)}
              className={toggleTileClasses(active)}
              aria-pressed={active}
            >
              {PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS[filter]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Search, ordering, and the cleanup filters in one strip.
 *
 * The eleven cleanup filters used to sit permanently on the page as two rows of tiles, which
 * pushed the actual property list below the fold. They keep their values, labels, AND semantics
 * and URL encoding exactly — only their presentation moves behind a disclosure that reports how
 * many are active, so the page opens on the data instead of on its controls.
 */
export function HealthToolbar({
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  selectedFilters,
  onToggleFilter,
  onClearFilters,
  visibleCount,
  totalCount,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sort: PortfolioHealthSort;
  onSortChange: (sort: PortfolioHealthSort) => void;
  selectedFilters: PortfolioHealthCleanupFilter[];
  onToggleFilter: (filter: PortfolioHealthCleanupFilter) => void;
  onClearFilters: () => void;
  visibleCount: number;
  totalCount: number;
}) {
  const searchId = useId();
  const sortId = useId();
  const panelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(selectedFilters.length > 0);

  const trimmedQuery = searchQuery.trim();
  const filterCount = selectedFilters.length;

  return (
    <section aria-label="Property health controls" className={`mb-3 ${SURFACE_PANEL}`}>
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search properties by address, unit, or tenant
          </label>
          <input
            id={searchId}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search address, unit, postal code, or tenant"
            autoComplete="off"
            className={formControlClasses({ size: "sm" })}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-xs font-medium text-foreground-muted">
            Sort
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => onSortChange(event.target.value as PortfolioHealthSort)}
            className={formControlClasses({ size: "sm", className: "w-auto" })}
          >
            {PORTFOLIO_HEALTH_SORTS.map((option) => (
              <option key={option} value={option}>
                {PORTFOLIO_HEALTH_SORT_LABELS[option]}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={panelId}
            onClick={() => setFiltersOpen((open) => !open)}
            className={buttonClasses({ variant: filterCount > 0 ? "primary" : "secondary", size: "xs" })}
          >
            Filters
            {filterCount > 0 ? <span className="tabular-nums">({filterCount})</span> : null}
            <span aria-hidden="true">{filtersOpen ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div id={panelId} className="flex flex-col gap-3 border-t border-border px-3 py-3">
          <p className="text-xs text-foreground-muted">
            Properties must match every selected filter. Units show only the matching issues.
          </p>
          <FilterGroup
            legend="Tenant issues"
            filters={PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS}
            selected={selectedFilters}
            onToggle={onToggleFilter}
          />
          <FilterGroup
            legend="Property issues"
            filters={PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS}
            selected={selectedFilters}
            onToggle={onToggleFilter}
          />
        </div>
      ) : null}

      <p
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-2 border-t border-border px-3 py-2 text-xs text-foreground-muted"
      >
        <span className="tabular-nums">
          Showing {visibleCount} of {totalCount} propert{totalCount === 1 ? "y" : "ies"}
        </span>
        {trimmedQuery ? <span>· search “{trimmedQuery}”</span> : null}
        {filterCount > 0 ? (
          <>
            <span className="tabular-nums">
              · {filterCount} active filter{filterCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Clear filters
            </button>
          </>
        ) : null}
      </p>
    </section>
  );
}
