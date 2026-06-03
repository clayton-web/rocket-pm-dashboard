import type { TenancyStatus } from "@prisma/client";

const NEXT_STATUS: Partial<Record<TenancyStatus, TenancyStatus>> = {
  pending_move_in: "active",
  active: "notice_received",
  notice_received: "move_out_scheduled",
  move_out_scheduled: "inspection_scheduled",
  inspection_scheduled: "inspection_completed",
  inspection_completed: "ended",
  ended: "archived",
};

const ADVANCE_LABELS: Partial<Record<TenancyStatus, string>> = {
  pending_move_in: "Mark active",
  inspection_completed: "Mark ended",
  ended: "Archive",
};

/** Statuses staff cannot set via generic lifecycle advance (dedicated flows required). */
export const STAFF_BLOCKED_ADVANCE_TARGETS: ReadonlySet<TenancyStatus> = new Set([
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
]);

export function getNextTenancyStatus(current: TenancyStatus): TenancyStatus | null {
  return NEXT_STATUS[current] ?? null;
}

export function getAdvanceTenancyStatusLabel(current: TenancyStatus): string | null {
  return ADVANCE_LABELS[current] ?? null;
}

export function isValidTenancyStatusTransition(
  current: TenancyStatus,
  next: TenancyStatus,
): boolean {
  const allowed = NEXT_STATUS[current];
  return allowed === next;
}
