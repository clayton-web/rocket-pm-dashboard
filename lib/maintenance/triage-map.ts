import type { MaintenanceTrade, MaintenanceUrgency } from "@prisma/client";

const ISSUE_TO_TRADE: Record<string, MaintenanceTrade> = {
  leak: "plumbing",
  heating: "hvac",
  electrical: "electrical",
  appliance: "appliance",
  other: "general",
};

export function tradeFromIssueLabel(label: string): MaintenanceTrade {
  const key = label.trim().toLowerCase();
  return ISSUE_TO_TRADE[key] ?? "general";
}

export function defaultUrgencyForIssue(): MaintenanceUrgency {
  return "routine";
}
