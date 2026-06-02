export type MaintenanceWorkflowStatus = "new" | "dispatched" | "completed" | "cancelled";

export type MaintenanceTriageUrgency = "emergency" | "urgent" | "routine";

export type MaintenanceTriageSummary = {
  urgency: MaintenanceTriageUrgency;
  suggestedTrade: string;
  summary: string;
  technicalAppendix?: string;
};

export type TenantPhotoPlaceholder = { id: string; label: string };
