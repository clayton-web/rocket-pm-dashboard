import type { ManagerWorkflowStatus } from "@/lib/maintenance/types";

/**
 * Pure next-action derivation for maintenance manager workflow states.
 * Labels for open "new" use the Operations-approved copy; dispatched uses the
 * same verb as MaintenanceActionCard ("Mark as completed").
 */

export type MaintenanceNextActionKind =
  | "review_and_dispatch"
  | "mark_as_completed"
  | "none";

export type MaintenanceNextAction = {
  kind: MaintenanceNextActionKind;
  /** User-facing next-action label for Operations and shared callers. */
  label: string;
  /** False when the request is terminal (completed / cancelled). */
  eligible: boolean;
};

export const MAINTENANCE_NEXT_ACTION_LABELS = {
  review_and_dispatch: "Review and dispatch",
  mark_as_completed: "Mark as completed",
  none: "No further action",
} as const satisfies Record<MaintenanceNextActionKind, string>;

/** Manager-list status labels — keep in sync with maintenance-manager-list. */
export function labelForManagerWorkflowStatus(status: ManagerWorkflowStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "dispatched":
      return "Dispatched";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function deriveMaintenanceNextAction(
  managerStatus: ManagerWorkflowStatus,
): MaintenanceNextAction {
  switch (managerStatus) {
    case "new":
      return {
        kind: "review_and_dispatch",
        label: MAINTENANCE_NEXT_ACTION_LABELS.review_and_dispatch,
        eligible: true,
      };
    case "dispatched":
      return {
        kind: "mark_as_completed",
        label: MAINTENANCE_NEXT_ACTION_LABELS.mark_as_completed,
        eligible: true,
      };
    case "completed":
    case "cancelled":
      return {
        kind: "none",
        label: MAINTENANCE_NEXT_ACTION_LABELS.none,
        eligible: false,
      };
  }
}
