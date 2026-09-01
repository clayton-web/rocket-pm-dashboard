import type { PortfolioHealthRow } from "@/lib/property/portfolio-health";

/**
 * Cell formatting for the Property Health triage list.
 *
 * Every formatter returns both a `short` string for the dense column and a `description` that
 * spells the same fact out in full. The columns are narrow enough that the short form leans on
 * the column header for meaning, and the header is not announced per row, so the description is
 * what screen readers and tooltips get. Keeping the pair together stops the two from drifting.
 */
export type PortfolioHealthCell = {
  short: string;
  description: string;
};

type OccupancyInput = Pick<
  PortfolioHealthRow,
  "unitCount" | "occupiedUnitCount" | "isVacant"
>;

function pluralUnits(count: number): string {
  return count === 1 ? "1 unit" : `${count} units`;
}

export function formatPortfolioHealthOccupancy(row: OccupancyInput): PortfolioHealthCell {
  if (row.unitCount === 0) {
    return { short: "No units", description: "No units on this property" };
  }
  if (row.occupiedUnitCount === 0) {
    return { short: "Vacant", description: `Vacant — ${pluralUnits(row.unitCount)}, none occupied` };
  }

  const short = `${row.occupiedUnitCount}/${row.unitCount}`;
  if (row.occupiedUnitCount === row.unitCount) {
    return { short, description: `Fully occupied — ${pluralUnits(row.unitCount)}` };
  }
  return {
    short,
    description: `${row.occupiedUnitCount} of ${pluralUnits(row.unitCount)} occupied`,
  };
}

export function formatPortfolioHealthOwnerState(
  status: PortfolioHealthRow["ownerInfoStatus"],
): PortfolioHealthCell {
  return status === "ok"
    ? { short: "Complete", description: "Owner contact complete" }
    : { short: "Missing", description: "Missing owner contact" };
}

export function formatPortfolioHealthDocumentsState(
  status: PortfolioHealthRow["documentsStatus"],
): PortfolioHealthCell {
  return status === "ok"
    ? { short: "Uploaded", description: "Documents uploaded" }
    : { short: "None", description: "No documents uploaded" };
}

const MS_PER_DAY = 86_400_000;

/**
 * Deterministic exact date for the `title` and the screen-reader text. `en-CA` with an explicit
 * UTC zone so the tooltip does not disagree with the relative label for a reader in another
 * timezone, and so the string does not change with the runtime's locale.
 */
function formatExactDate(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Whole-UTC-day granularity: the column is a triage signal ("was this touched recently"), not an
 * audit timestamp, and day buckets keep the cell to a few characters. The exact date always
 * travels with it, so precision is available without widening the column.
 */
export function formatPortfolioHealthUpdatedAt(
  iso: string | null,
  now: Date = new Date(),
): PortfolioHealthCell {
  if (!iso) return { short: "—", description: "Last updated date unavailable" };

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { short: "—", description: "Last updated date unavailable" };
  }

  const exact = formatExactDate(parsed);
  const description = `Last updated ${exact}`;

  const startOfUtcDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor((startOfUtcDay(now) - startOfUtcDay(parsed)) / MS_PER_DAY);

  if (days < 0) return { short: exact, description };
  if (days === 0) return { short: "Today", description };
  if (days === 1) return { short: "1d", description };
  if (days < 30) return { short: `${days}d`, description };
  if (days < 365) return { short: `${Math.floor(days / 30)}mo`, description };
  return { short: `${Math.floor(days / 365)}y`, description };
}
