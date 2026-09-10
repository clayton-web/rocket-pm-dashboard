"use client";

import { InlineNotice, PortalPageHeader, SURFACE_PANEL } from "@/components/portal/ui";
import {
  HealthPropertyRow,
  HealthTableHeader,
} from "@/components/properties/health/health-property-row";
import { HealthSummaryStrip } from "@/components/properties/health/health-summary-strip";
import { HealthToolbar } from "@/components/properties/health/health-toolbar";
import {
  normalizeCleanupFilters,
  parseCleanupFiltersParam,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";
import type {
  PortfolioHealthRow,
  PortfolioHealthSummary,
} from "@/lib/property/portfolio-health";
import {
  parsePortfolioHealthSort,
  type PortfolioHealthSort,
} from "@/lib/property/portfolio-health-ranking";
import {
  composePortfolioHealthUrlParams,
  parseSearchQueryParam,
  PORTFOLIO_HEALTH_SORT_PARAM,
  PORTFOLIO_HEALTH_STATUS_PARAM,
} from "@/lib/property/portfolio-health-search";
import type { HealthViewState } from "@/lib/property/portfolio-health-return";
import {
  buildPortfolioHealthView,
  parsePortfolioHealthStatusFilter,
  type PortfolioHealthStatusFilter,
} from "@/lib/property/portfolio-health-view";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function PropertyPortfolioHealth({
  rows,
  summary,
  loadError,
}: {
  rows: PortfolioHealthRow[];
  summary: PortfolioHealthSummary;
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialFilters = useMemo(
    () => parseCleanupFiltersParam(searchParams.get("filters")),
    [searchParams],
  );
  const [selectedFilters, setSelectedFilters] =
    useState<PortfolioHealthCleanupFilter[]>(initialFilters);
  const [searchQuery, setSearchQuery] = useState(() =>
    parseSearchQueryParam(searchParams.get("q")),
  );
  const [status, setStatus] = useState<PortfolioHealthStatusFilter>(() =>
    parsePortfolioHealthStatusFilter(searchParams.get(PORTFOLIO_HEALTH_STATUS_PARAM)),
  );
  const [sort, setSort] = useState<PortfolioHealthSort>(() =>
    parsePortfolioHealthSort(searchParams.get(PORTFOLIO_HEALTH_SORT_PARAM)),
  );

  /**
   * Expansion is local and keyed by property id. A row removed by a filter or search simply
   * stops rendering — nothing looks the id up — and gets its expanded state back if it returns,
   * which is why the set is not pruned when the visible rows change.
   */
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggleExpanded = useCallback((propertyId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(propertyId)) next.add(propertyId);
      return next;
    });
  }, []);

  // Read once per navigation so URL writes below never feed back into a render loop.
  const searchParamsString = searchParams.toString();
  const searchParamsRef = useRef(searchParamsString);
  searchParamsRef.current = searchParamsString;

  const writeUrl = useCallback(
    (next: {
      filters: PortfolioHealthCleanupFilter[];
      query: string;
      status: PortfolioHealthStatusFilter;
      sort: PortfolioHealthSort;
    }) => {
      const params = composePortfolioHealthUrlParams({
        filters: next.filters,
        query: next.query,
        status: next.status,
        sort: next.sort,
        base: searchParamsRef.current,
      });
      const serialized = params.toString();
      router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const toggleFilter = useCallback(
    (filter: PortfolioHealthCleanupFilter) => {
      setSelectedFilters((current) => {
        const next = normalizeCleanupFilters(
          current.includes(filter)
            ? current.filter((item) => item !== filter)
            : [...current, filter],
        );
        writeUrl({ filters: next, query: searchQuery, status, sort });
        return next;
      });
    },
    [searchQuery, sort, status, writeUrl],
  );

  const clearFilters = useCallback(() => {
    setSelectedFilters([]);
    writeUrl({ filters: [], query: searchQuery, status, sort });
  }, [searchQuery, sort, status, writeUrl]);

  const changeStatus = useCallback(
    (next: PortfolioHealthStatusFilter) => {
      setStatus(next);
      writeUrl({ filters: selectedFilters, query: searchQuery, status: next, sort });
    },
    [searchQuery, selectedFilters, sort, writeUrl],
  );

  const changeSort = useCallback(
    (next: PortfolioHealthSort) => {
      setSort(next);
      writeUrl({ filters: selectedFilters, query: searchQuery, status, sort: next });
    },
    [searchQuery, selectedFilters, status, writeUrl],
  );

  // Filtering is immediate from local state; only the URL write is debounced, so typing stays
  // responsive without a soft navigation per keystroke.
  const initialSearchSync = useRef(true);
  useEffect(() => {
    if (initialSearchSync.current) {
      initialSearchSync.current = false;
      return;
    }
    const timer = setTimeout(
      () => writeUrl({ filters: selectedFilters, query: searchQuery, status, sort }),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchQuery, selectedFilters, sort, status, writeUrl]);

  const { rows: visibleRows } = useMemo(
    () => buildPortfolioHealthView({ rows, filters: selectedFilters, query: searchQuery, status, sort }),
    [rows, selectedFilters, searchQuery, status, sort],
  );

  const cleanupDone = searchParams.get("cleanupDone") === "1";
  const trimmedQuery = searchQuery.trim();

  /**
   * The exact worklist state every outbound edit link carries, so returning from an edit restores
   * this view rather than a widened one.
   */
  const viewState = useMemo<HealthViewState>(
    () => ({ filters: selectedFilters, query: searchQuery, status, sort }),
    [selectedFilters, searchQuery, status, sort],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PortalPageHeader
        eyebrow="Properties"
        title="Property documents & health"
        description={
          <>
            Read-only data-quality triage for the active portfolio.{" "}
            <Link href="/properties" className="font-medium underline underline-offset-2">
              Back to properties
            </Link>
          </>
        }
      />

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      {cleanupDone ? (
        <InlineNotice className="mb-4">
          Cleanup complete for this worklist. Nothing left to fix in the current view.
        </InlineNotice>
      ) : null}

      <HealthSummaryStrip
        summary={summary}
        status={status}
        onStatusChange={changeStatus}
        selectedFilters={selectedFilters}
        onToggleFilter={toggleFilter}
      />

      <HealthToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sort={sort}
        onSortChange={changeSort}
        selectedFilters={selectedFilters}
        onToggleFilter={toggleFilter}
        onClearFilters={clearFilters}
        visibleCount={visibleRows.length}
        totalCount={rows.length}
      />

      {rows.length === 0 ? (
        <InlineNotice>No properties found for this organization.</InlineNotice>
      ) : visibleRows.length === 0 ? (
        <InlineNotice>
          {trimmedQuery && selectedFilters.length > 0
            ? "No properties match this search and the selected filters."
            : trimmedQuery
              ? "No properties match this search."
              : "No properties match the selected filters."}
        </InlineNotice>
      ) : (
        <div className={`overflow-hidden ${SURFACE_PANEL}`}>
          <HealthTableHeader />
          <ul aria-label="Properties by health priority">
            {visibleRows.map((row) => (
              <HealthPropertyRow
                key={row.propertyId}
                row={row}
                expanded={expandedIds.has(row.propertyId)}
                onToggle={toggleExpanded}
                viewState={viewState}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
