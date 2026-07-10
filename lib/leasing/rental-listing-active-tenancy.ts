import type { TenancyStatus } from "@prisma/client";

/**
 * Occupancy statuses that block publishing a rental listing for a unit.
 *
 * Rule: a unit with a tenancy in one of these statuses is treated as currently
 * occupied (or still in an active occupancy lifecycle). Historical `ended` and
 * `archived` tenancies do not block publishing.
 *
 * `pending_move_in` is included because the unit is already committed to an
 * incoming tenancy and should not be advertised as available.
 *
 * Property.serviceRelationship does **not** affect this guard. Managed,
 * pre-management, and placement-only properties use the same occupancy check.
 * Tenancy rows are created only after application approval + conversion today;
 * a placement-only property with no Tenancy row is never blocked by this rule.
 *
 * Later: managed units may need an "available after move-out" override;
 * placement-only completions may need a non-managed Placement record instead
 * of a full Tenancy (see docs/rental-listings.md).
 */
export const PUBLISH_BLOCKING_TENANCY_STATUSES: readonly TenancyStatus[] = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
] as const;

export const ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE =
  "This unit has an active or in-progress tenancy. Close or end that tenancy before publishing a listing.";

export function isPublishBlockingTenancyStatus(status: TenancyStatus | string): boolean {
  return (PUBLISH_BLOCKING_TENANCY_STATUSES as readonly string[]).includes(status);
}
