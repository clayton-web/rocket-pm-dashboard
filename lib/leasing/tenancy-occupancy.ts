import type { TenancyStatus } from "@prisma/client";

/**
 * Single source of truth for whether a tenancy represents current occupancy.
 *
 * `pending_move_in` counts as current because the unit is already committed to an incoming
 * tenancy. Everything from `notice_received` through `inspection_completed` is still an
 * in-progress occupancy lifecycle, so those remain current until the tenancy is `ended`.
 *
 * Consumers must not re-derive this list. Anything reading occupancy currency (staff property
 * pages, rental listing publish guards, the Rocket Communicator context resolver) imports from
 * here so a lifecycle change lands in one place.
 */
export const CURRENT_TENANCY_STATUSES: readonly TenancyStatus[] = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
] as const;

/** Tenancies that have finished. A historical match must never be shown as the current tenant. */
export const HISTORICAL_TENANCY_STATUSES: readonly TenancyStatus[] = ["ended", "archived"] as const;

/**
 * Occupancy currency for a tenancy.
 *
 * Every `TenancyStatus` maps to exactly one of these today; the union has no third member so a
 * new status added to the enum surfaces as a type error here rather than being silently treated
 * as historical.
 */
export type TenancyOccupancyCurrency = "current" | "historical";

const CURRENT_STATUS_SET: ReadonlySet<string> = new Set(CURRENT_TENANCY_STATUSES);

export function isCurrentTenancyStatus(status: TenancyStatus | string): boolean {
  return CURRENT_STATUS_SET.has(status);
}

export function getTenancyOccupancyCurrency(
  status: TenancyStatus | string,
): TenancyOccupancyCurrency {
  return isCurrentTenancyStatus(status) ? "current" : "historical";
}
