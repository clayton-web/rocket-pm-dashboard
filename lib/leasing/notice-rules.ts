/**
 * Tenancy-end notice validation (rental-period boundaries, full-period notice, fixed-term floor).
 * UI-agnostic — used by tenant portal, staff review, and future move-out automation.
 */

/** Full rental periods of notice required after the period containing notice. */
export const NOTICE_PERIOD_COUNT = 1;

/**
 * Earliest valid move-out is the period boundary this many months after the period start
 * that contains the notice date (NOTICE_PERIOD_COUNT + 1 period starts).
 */
const PERIOD_START_OFFSET_MONTHS = NOTICE_PERIOD_COUNT + 1;

export const NOTICE_RULE_ERRORS = {
  NOT_ON_BOUNDARY: "Notice must end on a rental-period boundary.",
  INSUFFICIENT_NOTICE: "A full rental period of notice is required.",
  BEFORE_FIXED_TERM: "The fixed-term lease does not expire until",
} as const;

export type NoticeRuleErrorCode = keyof typeof NOTICE_RULE_ERRORS;

export type NoticeRulesTenancy = {
  rentDueDay: number;
  leaseEndDate: Date | null;
};

export type MoveOutValidationResult =
  | { valid: true }
  | { valid: false; errors: string[]; codes: NoticeRuleErrorCode[] };

export type GetAllowedMoveOutDatesOptions = {
  /** Inclusive upper bound for generated dates (default: 24 months after earliest valid). */
  maxDate?: Date;
  /** Maximum number of dates to return (default 36). */
  limit?: number;
};

const MS_PER_DAY = 86_400_000;

/** Normalize to UTC noon on calendar date (matches tenancy @db.Date handling in app). */
export function toDateOnlyUTC(value: Date | string): Date {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error("Date string must be YYYY-MM-DD");
    }
    return new Date(`${trimmed}T12:00:00.000Z`);
  }
  return new Date(`${value.toISOString().slice(0, 10)}T12:00:00.000Z`);
}

export function assertValidRentDueDay(rentDueDay: number): void {
  if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 31) {
    throw new Error("rentDueDay must be an integer from 1 to 31");
  }
}

/** Default rent period anchor from lease start (conversion / admin). */
export function deriveRentDueDayFromLeaseStart(leaseStartDate: Date): number {
  const day = toDateOnlyUTC(leaseStartDate).getUTCDate();
  assertValidRentDueDay(day);
  return day;
}

function compareDateOnly(a: Date, b: Date): number {
  return toDateOnlyUTC(a).getTime() - toDateOnlyUTC(b).getTime();
}

function daysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampRentDueDayForMonth(year: number, monthIndex: number, rentDueDay: number): number {
  return Math.min(rentDueDay, daysInMonthUTC(year, monthIndex));
}

function periodStartForYearMonth(year: number, monthIndex: number, rentDueDay: number): Date {
  assertValidRentDueDay(rentDueDay);
  const day = clampRentDueDayForMonth(year, monthIndex, rentDueDay);
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function addDaysUTC(date: Date, days: number): Date {
  const d = toDateOnlyUTC(date);
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function addMonthsToPeriodStart(start: Date, months: number, rentDueDay: number): Date {
  const d = toDateOnlyUTC(start);
  let year = d.getUTCFullYear();
  let monthIndex = d.getUTCMonth() + months;
  while (monthIndex > 11) {
    year += 1;
    monthIndex -= 12;
  }
  while (monthIndex < 0) {
    year -= 1;
    monthIndex += 12;
  }
  return periodStartForYearMonth(year, monthIndex, rentDueDay);
}

/**
 * Rental period start containing `date` (inclusive start, exclusive next period).
 */
export function getPeriodStartContainingDate(date: Date, rentDueDay: number): Date {
  assertValidRentDueDay(rentDueDay);
  const d = toDateOnlyUTC(date);
  let year = d.getUTCFullYear();
  let monthIndex = d.getUTCMonth();
  let start = periodStartForYearMonth(year, monthIndex, rentDueDay);
  if (compareDateOnly(d, start) < 0) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
    start = periodStartForYearMonth(year, monthIndex, rentDueDay);
  }
  return start;
}

/** True when `date` is the first day of a rental period for this rent due day. */
export function isRentalPeriodBoundary(date: Date, rentDueDay: number): boolean {
  const d = toDateOnlyUTC(date);
  const start = getPeriodStartContainingDate(d, rentDueDay);
  return compareDateOnly(d, start) === 0;
}

/**
 * First period boundary strictly after fixed-term expiry (leaseEndDate inclusive).
 */
export function getEarliestEndAfterFixedTerm(leaseEndDate: Date, rentDueDay: number): Date {
  const end = toDateOnlyUTC(leaseEndDate);
  if (isRentalPeriodBoundary(end, rentDueDay)) {
    const periodStart = getPeriodStartContainingDate(end, rentDueDay);
    return addMonthsToPeriodStart(periodStart, 1, rentDueDay);
  }
  return getPeriodStartContainingDate(addDaysUTC(end, 1), rentDueDay);
}

/**
 * Earliest valid tenant-requested tenancy end date for a notice given on `noticeGivenDate`.
 */
export function computeEarliestValidMoveOutDate(
  noticeGivenDate: Date,
  tenancy: NoticeRulesTenancy,
): Date {
  assertValidRentDueDay(tenancy.rentDueDay);
  const given = toDateOnlyUTC(noticeGivenDate);
  const periodStart = getPeriodStartContainingDate(given, tenancy.rentDueDay);
  let earliest = addMonthsToPeriodStart(
    periodStart,
    PERIOD_START_OFFSET_MONTHS,
    tenancy.rentDueDay,
  );

  if (tenancy.leaseEndDate != null) {
    const afterFixed = getEarliestEndAfterFixedTerm(tenancy.leaseEndDate, tenancy.rentDueDay);
    if (compareDateOnly(earliest, afterFixed) < 0) {
      earliest = afterFixed;
    }
  }

  return earliest;
}

function formatDateLabel(date: Date): string {
  return toDateOnlyUTC(date).toISOString().slice(0, 10);
}

export function isMoveOutDateValid(
  proposedMoveOutDate: Date,
  noticeGivenDate: Date,
  tenancy: NoticeRulesTenancy,
): MoveOutValidationResult {
  assertValidRentDueDay(tenancy.rentDueDay);
  const proposed = toDateOnlyUTC(proposedMoveOutDate);
  const errors: string[] = [];
  const codes: NoticeRuleErrorCode[] = [];

  if (!isRentalPeriodBoundary(proposed, tenancy.rentDueDay)) {
    errors.push(NOTICE_RULE_ERRORS.NOT_ON_BOUNDARY);
    codes.push("NOT_ON_BOUNDARY");
  }

  const earliest = computeEarliestValidMoveOutDate(noticeGivenDate, tenancy);
  if (compareDateOnly(proposed, earliest) < 0) {
    if (tenancy.leaseEndDate != null) {
      const afterFixed = getEarliestEndAfterFixedTerm(tenancy.leaseEndDate, tenancy.rentDueDay);
      if (compareDateOnly(proposed, afterFixed) < 0 && compareDateOnly(earliest, afterFixed) >= 0) {
        errors.push(`${NOTICE_RULE_ERRORS.BEFORE_FIXED_TERM} ${formatDateLabel(afterFixed)}.`);
        codes.push("BEFORE_FIXED_TERM");
      } else {
        errors.push(NOTICE_RULE_ERRORS.INSUFFICIENT_NOTICE);
        codes.push("INSUFFICIENT_NOTICE");
      }
    } else {
      errors.push(NOTICE_RULE_ERRORS.INSUFFICIENT_NOTICE);
      codes.push("INSUFFICIENT_NOTICE");
    }
  }

  if (errors.length === 0) {
    return { valid: true };
  }
  return { valid: false, errors, codes };
}

/**
 * Discrete allowed tenancy end dates from earliest valid through `maxDate` (period boundaries).
 */
export function getAllowedMoveOutDates(
  noticeGivenDate: Date,
  tenancy: NoticeRulesTenancy,
  options?: GetAllowedMoveOutDatesOptions,
): Date[] {
  const earliest = computeEarliestValidMoveOutDate(noticeGivenDate, tenancy);
  const maxDate =
    options?.maxDate ??
    addMonthsToPeriodStart(earliest, 24, tenancy.rentDueDay);
  const limit = options?.limit ?? 36;

  const dates: Date[] = [];
  let cursor = earliest;
  while (compareDateOnly(cursor, maxDate) <= 0 && dates.length < limit) {
    dates.push(cursor);
    const periodStart = getPeriodStartContainingDate(cursor, tenancy.rentDueDay);
    cursor = addMonthsToPeriodStart(periodStart, 1, tenancy.rentDueDay);
  }
  return dates;
}
