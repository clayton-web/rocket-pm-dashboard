import type { RentalListingStatus } from "@prisma/client";

/** Statuses that count as the single "open" listing for a unit (service-enforced). */
export const OPEN_RENTAL_LISTING_STATUSES: readonly RentalListingStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
] as const;

export const RENTAL_LISTING_STATUS_LABELS: Record<RentalListingStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export function isOpenRentalListingStatus(status: RentalListingStatus | string): boolean {
  return (OPEN_RENTAL_LISTING_STATUSES as readonly string[]).includes(status);
}

export function isPubliclyVisibleRentalListingStatus(
  status: RentalListingStatus | string,
): boolean {
  return status === "PUBLISHED";
}

export function formatRentalListingStatus(status: RentalListingStatus | string): string {
  if (status in RENTAL_LISTING_STATUS_LABELS) {
    return RENTAL_LISTING_STATUS_LABELS[status as RentalListingStatus];
  }
  return status;
}

/** Staff unit card badge when there is no open listing. */
export function rentalListingUnitStatusLabel(
  status: RentalListingStatus | string | null | undefined,
): string {
  if (!status) return "Not listed";
  return formatRentalListingStatus(status);
}
