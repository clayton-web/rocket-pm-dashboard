/**
 * Temporary public-intake compatibility for RentalListing cutover.
 *
 * When enabled (default), units with no rental-listing history may still appear
 * via the legacy active property/unit path. Units that already have any listing
 * record (DRAFT/PUBLISHED/PAUSED/CLOSED) never use legacy fallback — staff intent
 * is authoritative as soon as a listing exists.
 *
 * Env: RENTAL_LISTING_PUBLIC_FALLBACK
 * - unset / empty → true (compatibility on)
 * - true / 1 / yes → true
 * - false / 0 / no → false
 * - any other non-empty value → false (fail closed for unknown strings)
 */
export function isRentalListingPublicFallbackEnabled(): boolean {
  try {
    const raw = process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
    if (typeof raw !== "string") return true;
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return true;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    return false;
  } catch {
    return true;
  }
}
