import React from "react";
import type { MaintenanceWorkflowStatus } from "./types";

/**
 * Maintenance keeps its own chip treatment rather than routing through `StatusBadge`.
 *
 * The queue separates two axes on purpose. Hue carries *urgency* — the emergency/urgent left-border
 * accent on a request row — while achromatic weight carries *workflow position*: outlined when new,
 * lightly filled once dispatched, filled dark ink when complete, and unboxed muted ink when
 * cancelled. Reading a row therefore means reading one colour system, not two.
 *
 * A shared `success` tone would break that. It would put green beside the red urgency accent in the
 * same row, and it would assert "completed is good news" when the queue is really saying "this is
 * finished, stop looking at it" — which the dark-then-faded progression says better. `cancelled`
 * also has no chip at all, which the badge primitive cannot express.
 *
 * So the treatment stays here, but the palette does not: every value below is a portal semantic
 * token, and the convention is deliberately achromatic. See docs/branding.md.
 */
const STATUS_CHIP: Record<MaintenanceWorkflowStatus, string> = {
  new: "border border-border-strong bg-surface text-foreground",
  dispatched: "bg-surface-muted text-foreground",
  completed: "bg-primary text-primary-foreground",
  cancelled: "text-foreground-subtle",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceWorkflowStatus, string> = {
  new: "New",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CHIP_BASE = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

export function maintenanceStatusChipClasses(status: MaintenanceWorkflowStatus): string {
  return `${CHIP_BASE} ${STATUS_CHIP[status]}`;
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceWorkflowStatus }) {
  return (
    <span className={maintenanceStatusChipClasses(status)}>{MAINTENANCE_STATUS_LABELS[status]}</span>
  );
}
