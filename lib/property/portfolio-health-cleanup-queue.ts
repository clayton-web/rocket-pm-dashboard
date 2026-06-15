import type { PortfolioHealthFilteredRow } from "@/lib/property/portfolio-health-cleanup-filters";

export type HealthCleanupTenancyQueueEntry = {
  tenancyId: string;
  propertyId: string;
  propertyLabel: string;
  unitLabel: string;
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

export function selectNextTenancyInCleanupQueue(
  queue: HealthCleanupTenancyQueueEntry[],
  excludeTenancyId: string,
): HealthCleanupTenancyQueueEntry | null {
  const normalizedExclude = excludeTenancyId.trim();
  const currentIndex = queue.findIndex((entry) => entry.tenancyId === normalizedExclude);
  if (currentIndex >= 0) {
    return queue[currentIndex + 1] ?? null;
  }
  return queue[0] ?? null;
}
