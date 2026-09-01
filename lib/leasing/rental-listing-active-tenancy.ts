import type { TenancyStatus } from "@prisma/client";
import {
  CURRENT_TENANCY_STATUSES,
  isCurrentTenancyStatus,
} from "@/lib/leasing/tenancy-occupancy";

/**
 * Occupancy statuses that block publishing a rental listing for a unit.
 *
 * Rule: a unit with a tenancy in one of these statuses is treated as currently
 * occupied (or still in an active occupancy lifecycle). Historical `ended` and
 * `archived` tenancies do not block publishing. This is the shared occupancy
 * rule from `lib/leasing/tenancy-occupancy` — publish blocking and "is this the
 * current tenant" answer the same question today.
 *
 * Property.serviceRelationship does **not** affect this guard. Managed,
 * pre-management, and placement-only properties use the same occupancy check.
 * Tenancy rows are created only after application approval + conversion today;
 * a placement-only property with no Tenancy row is never blocked by this rule.
 *
 * Later: managed units may need an "available after move-out" override;
 * placement-only completions may need a non-managed Placement record instead
 * of a full Tenancy (see docs/rental-listings.md). If that override lands, this
 * list diverges from the occupancy rule and gets its own definition again.
 */
export const PUBLISH_BLOCKING_TENANCY_STATUSES: readonly TenancyStatus[] =
  CURRENT_TENANCY_STATUSES;

export const ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE =
  "This unit has an active or in-progress tenancy. Close or end that tenancy before publishing a listing.";

export function isPublishBlockingTenancyStatus(status: TenancyStatus | string): boolean {
  return isCurrentTenancyStatus(status);
}
