import type { MaintenanceRequest, Property, TenancyContact, Unit } from "@prisma/client";
import { toManagerWorkflowStatus } from "@/lib/maintenance/workflow";
import type { MaintenanceApiRow } from "@/lib/maintenance/types";

export type MaintenanceRequestWithContext = MaintenanceRequest & {
  property: Pick<Property, "id" | "name">;
  unit: Pick<Unit, "id" | "unitNumber">;
  submittedByContact: Pick<TenancyContact, "firstName" | "lastName"> | null;
};

export function serializeMaintenanceRequest(row: MaintenanceRequestWithContext): MaintenanceApiRow {
  const tenantName = row.submittedByContact
    ? `${row.submittedByContact.firstName} ${row.submittedByContact.lastName}`.trim()
    : null;

  return {
    id: row.id,
    property_id: row.property.id,
    property_name: row.property.name,
    unit_id: row.unit.id,
    unit_label: row.unit.unitNumber,
    tenant_name: tenantName,
    title: row.title,
    description: row.description,
    status: toManagerWorkflowStatus(row.status),
    submitted_at: row.submittedAt.toISOString(),
    triage_urgency: row.urgency,
    triage_trade: row.trade,
    triage_summary: row.triageSummary,
    dispatched_at: row.dispatchedAt?.toISOString() ?? null,
    assigned_to_name: row.assignedVendorName?.trim() || null,
    completed_at: row.completedAt?.toISOString() ?? null,
    completion_note: row.completionNote,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
