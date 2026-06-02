import type { MaintenanceRequestStatus, MaintenanceUrgency } from "@prisma/client";

/** Manager UI workflow buckets (maps from richer Prisma statuses). */
export type ManagerWorkflowStatus = "new" | "dispatched" | "completed" | "cancelled";

export type MaintenanceApiRow = {
  id: string;
  property_id: string;
  property_name: string;
  unit_id: string;
  unit_label: string;
  tenant_name: string | null;
  title: string;
  description: string;
  status: ManagerWorkflowStatus;
  submitted_at: string;
  triage_urgency: string;
  triage_trade: string;
  triage_summary: string | null;
  dispatched_at: string | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  completion_note: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceTriageUrgency = MaintenanceUrgency;

export { type MaintenanceRequestStatus };
