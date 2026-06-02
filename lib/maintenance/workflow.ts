import type { MaintenanceRequestStatus } from "@prisma/client";
import type { ManagerWorkflowStatus } from "@/lib/maintenance/types";

export function toManagerWorkflowStatus(status: MaintenanceRequestStatus): ManagerWorkflowStatus {
  switch (status) {
    case "new":
    case "triaged":
      return "new";
    case "dispatched":
    case "in_progress":
    case "awaiting_owner_approval":
    case "scheduled":
      return "dispatched";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "new";
  }
}

const ALLOWED: Record<ManagerWorkflowStatus, readonly ManagerWorkflowStatus[]> = {
  new: ["dispatched", "cancelled"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export class MaintenanceWorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceWorkflowTransitionError";
  }
}

export function assertAllowedManagerTransition(
  current: ManagerWorkflowStatus,
  next: ManagerWorkflowStatus,
): void {
  if (current === next) return;
  const allowed = ALLOWED[current];
  if (!allowed.includes(next)) {
    throw new MaintenanceWorkflowTransitionError(
      `Invalid status transition: ${current} → ${next}.`,
    );
  }
}

export function prismaStatusForManagerPatch(
  current: MaintenanceRequestStatus,
  next: ManagerWorkflowStatus,
): MaintenanceRequestStatus {
  if (next === "new") {
    return current === "triaged" ? "triaged" : "new";
  }
  if (next === "dispatched") {
    if (current === "new" || current === "triaged") return "dispatched";
    return current;
  }
  if (next === "completed") return "completed";
  if (next === "cancelled") return "cancelled";
  return current;
}
