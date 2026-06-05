/**
 * Read-only historical lease rent comparables for the Rental Ad Assistant.
 *
 * Returns signed-lease rents from the organization's portfolio only.
 * These are NOT asking rents, market guarantees, or official rent recommendations.
 * Official rent remains Tenancy.monthlyRent.
 *
 * This module must not write to Tenancy, Property, Unit, or RentalAdAssistantDraft.
 * It must not import from rental-ad-assistant-draft.service.
 */
import type { PrismaClient } from "@prisma/client";
import { formatPropertyUnitLine } from "@/lib/property/display";
import type { RentalAdAssistantCompsSnapshot } from "@/lib/validation/rental-ad-assistant";

export const INTERNAL_RENT_COMPS_LABEL =
  "Historical lease rents from signed leases in your portfolio";

const DEFAULT_MONTHS_BACK = 24;
const DEFAULT_SAMPLE_LIMIT = 20;
const MAX_BEDROOMS = 50;

export type GetInternalRentCompsInput = {
  organizationId: string;
  city: string;
  bedrooms?: number | null;
  monthsBack?: number;
  limit?: number;
};

type TenancyCompRow = {
  monthlyRent: { toString(): string } | number | string;
  leaseStartDate: Date;
  unit: {
    bedrooms: number | null;
    unitNumber: string;
  };
  property: {
    name: string;
    streetLine1: string;
    streetLine2: string | null;
    city: string;
  };
};

function normalizeCity(city: string): string {
  return city.trim();
}

function decimalToMoney(value: TenancyCompRow["monthlyRent"]): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function formatLeaseStartDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/** Exported for tests — median of all values in the matching set. */
export function medianRent(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 100) / 100;
  }
  return sorted[mid]!;
}

function resolveBedroomQuery(bedrooms: number | null | undefined): {
  bedroomsMin: number;
  bedroomsMax: number;
  filterByBedrooms: boolean;
} {
  if (bedrooms === undefined || bedrooms === null) {
    return { bedroomsMin: 0, bedroomsMax: MAX_BEDROOMS, filterByBedrooms: false };
  }
  return {
    bedroomsMin: Math.max(0, bedrooms - 1),
    bedroomsMax: Math.min(MAX_BEDROOMS, bedrooms + 1),
    filterByBedrooms: true,
  };
}

function rowMatchesBedrooms(row: TenancyCompRow, bedroomsMin: number, bedroomsMax: number): boolean {
  const beds = row.unit.bedrooms;
  if (beds === null || beds === undefined) return false;
  return beds >= bedroomsMin && beds <= bedroomsMax;
}

function toSample(row: TenancyCompRow) {
  return {
    propertyDisplay: formatPropertyUnitLine(row.property, row.unit.unitNumber),
    bedrooms: row.unit.bedrooms,
    monthlyLeaseRent: decimalToMoney(row.monthlyRent),
    leaseStartDate: formatLeaseStartDate(row.leaseStartDate),
  };
}

/**
 * Loads historical signed-lease rents for advertising guidance only.
 * Read-only — never mutates leasing or draft records.
 */
export async function getInternalRentCompsForRentalAdAssistant(
  prisma: PrismaClient,
  input: GetInternalRentCompsInput,
): Promise<RentalAdAssistantCompsSnapshot> {
  const city = normalizeCity(input.city);
  if (!city) {
    return emptyCompsSnapshot(city, input);
  }

  const monthsBack =
    input.monthsBack !== undefined && input.monthsBack > 0
      ? Math.floor(input.monthsBack)
      : DEFAULT_MONTHS_BACK;
  const sampleLimit =
    input.limit !== undefined && input.limit > 0
      ? Math.floor(input.limit)
      : DEFAULT_SAMPLE_LIMIT;

  const bedroomQuery = resolveBedroomQuery(input.bedrooms);
  const leaseStartCutoff = subtractMonths(new Date(), monthsBack);

  const rows = await prisma.tenancy.findMany({
    where: {
      monthlyRent: { gt: 0 },
      leaseStartDate: { gte: leaseStartCutoff },
      property: {
        organizationId: input.organizationId,
        city: { equals: city, mode: "insensitive" },
      },
    },
    orderBy: { leaseStartDate: "desc" },
    select: {
      monthlyRent: true,
      leaseStartDate: true,
      unit: {
        select: {
          bedrooms: true,
          unitNumber: true,
        },
      },
      property: {
        select: {
          name: true,
          streetLine1: true,
          streetLine2: true,
          city: true,
        },
      },
    },
  });

  const matching = bedroomQuery.filterByBedrooms
    ? rows.filter((row) => rowMatchesBedrooms(row, bedroomQuery.bedroomsMin, bedroomQuery.bedroomsMax))
    : rows;

  const rents = matching
    .map((row) => decimalToMoney(row.monthlyRent))
    .filter((rent) => rent > 0);

  const count = rents.length;
  const median = medianRent(rents);
  const min = count > 0 ? Math.min(...rents) : null;
  const max = count > 0 ? Math.max(...rents) : null;
  const samples = matching.slice(0, sampleLimit).map(toSample);

  return {
    label: INTERNAL_RENT_COMPS_LABEL,
    count,
    median,
    min,
    max,
    samples,
    query: {
      city,
      bedroomsMin: bedroomQuery.bedroomsMin,
      bedroomsMax: bedroomQuery.bedroomsMax,
      monthsBack,
    },
  };
}

function emptyCompsSnapshot(
  city: string,
  input: GetInternalRentCompsInput,
): RentalAdAssistantCompsSnapshot {
  const bedroomQuery = resolveBedroomQuery(input.bedrooms);
  const monthsBack =
    input.monthsBack !== undefined && input.monthsBack > 0
      ? Math.floor(input.monthsBack)
      : DEFAULT_MONTHS_BACK;

  return {
    label: INTERNAL_RENT_COMPS_LABEL,
    count: 0,
    median: null,
    min: null,
    max: null,
    samples: [],
    query: {
      city,
      bedroomsMin: bedroomQuery.bedroomsMin,
      bedroomsMax: bedroomQuery.bedroomsMax,
      monthsBack,
    },
  };
}
