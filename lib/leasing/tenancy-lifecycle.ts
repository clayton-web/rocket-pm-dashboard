import type { TenancyStatus } from "@prisma/client";

const NEXT_STATUS: Partial<Record<TenancyStatus, TenancyStatus>> = {
  pending_move_in: "active",
  active: "notice_received",
  notice_received: "move_out_scheduled",
  move_out_scheduled: "ended",
  ended: "archived",
};

const ADVANCE_LABELS: Partial<Record<TenancyStatus, string>> = {
  pending_move_in: "Mark active",
  active: "Notice received",
  notice_received: "Schedule move-out",
  move_out_scheduled: "Mark ended",
  ended: "Archive",
};

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
