import type { PortfolioHealthMissingItemKey } from "@/lib/property/portfolio-health";
import type { PortfolioHealthFilteredRow } from "@/lib/property/portfolio-health-cleanup-filters";
import { portfolioHealthEditTarget } from "@/lib/property/portfolio-health-edit-targets";

export type HealthCleanupTenancyQueueEntry = {
  tenancyId: string;
  propertyId: string;
  propertyLabel: string;
  unitLabel: string;
};

export type HealthCleanupPropertyQueueEntry = {
  propertyId: string;
  propertyLabel: string;
  /** The issues on this property that the shared property editor can actually repair. */
  editableIssueKeys: PortfolioHealthMissingItemKey[];
};

export function flattenHealthCleanupTenancyQueue(
  rows: PortfolioHealthFilteredRow[],
): HealthCleanupTenancyQueueEntry[] {
  const queue: HealthCleanupTenancyQueueEntry[] = [];
  for (const row of rows) {
    for (const slot of row.visibleUnitSlots) {
      if (slot.isVacant || !slot.tenancyId) continue;
      queue.push({
        tenancyId: slot.tenancyId,
        propertyId: row.propertyId,
        propertyLabel: row.propertyLabel,
        unitLabel: slot.unitLabel,
      });
    }
  }
  return queue;
}

/**
 * Properties whose remaining issues can be fixed in the shared property editor.
 *
 * Two exclusions keep the queue honest. Rows the viewer cannot edit are skipped, so "next" never
 * lands on a page whose save would be refused. Issues repaired elsewhere are skipped too —
 * `documents` is an upload workflow and tenant data belongs to the tenancy editor — so a property
 * whose only outstanding issue is a missing document is not offered as a property edit.
 *
 * `visiblePropertyMissingItemKeys` is used rather than the full set so an active cleanup filter
 * narrows the queue the same way it narrows the visible rows.
 */
export function flattenHealthCleanupPropertyQueue(
  rows: PortfolioHealthFilteredRow[],
): HealthCleanupPropertyQueueEntry[] {
  const queue: HealthCleanupPropertyQueueEntry[] = [];
  for (const row of rows) {
    if (!row.canEdit) continue;
    const editableIssueKeys = row.visiblePropertyMissingItemKeys.filter(
      (key) => portfolioHealthEditTarget(key).kind === "property",
    );
    if (editableIssueKeys.length === 0) continue;
    queue.push({
      propertyId: row.propertyId,
      propertyLabel: row.propertyLabel,
      editableIssueKeys,
    });
  }
  return queue;
}

/**
 * Successor of `excludeId`, or the head of the queue when the current item is no longer in it.
 *
 * Falling back to the head is what makes the loop terminate cleanly: once an item is fixed it
 * stops matching the filters, so on the next hop it is absent and the queue advances from the
 * front rather than dead-ending.
 */
function selectNextInQueue<T>(
  queue: readonly T[],
  identify: (entry: T) => string,
  excludeId: string,
): T | null {
  const normalized = excludeId.trim();
  const currentIndex = queue.findIndex((entry) => identify(entry) === normalized);
  if (currentIndex >= 0) {
    return queue[currentIndex + 1] ?? null;
  }
  return queue[0] ?? null;
}

export function selectNextTenancyInCleanupQueue(
  queue: HealthCleanupTenancyQueueEntry[],
  excludeTenancyId: string,
): HealthCleanupTenancyQueueEntry | null {
  return selectNextInQueue(queue, (entry) => entry.tenancyId, excludeTenancyId);
}

export function selectNextPropertyInCleanupQueue(
  queue: HealthCleanupPropertyQueueEntry[],
  excludePropertyId: string,
): HealthCleanupPropertyQueueEntry | null {
  return selectNextInQueue(queue, (entry) => entry.propertyId, excludePropertyId);
}
