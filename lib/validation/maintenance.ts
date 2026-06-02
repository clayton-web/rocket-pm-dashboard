import type { MaintenanceTrade, MaintenanceUrgency } from "@prisma/client";
import type { ManagerWorkflowStatus } from "@/lib/maintenance/types";

const URGENCIES = new Set<MaintenanceUrgency>(["routine", "urgent", "emergency"]);
const TRADES = new Set<MaintenanceTrade>([
  "general",
  "plumbing",
  "electrical",
  "hvac",
  "appliance",
  "structural",
  "other",
]);

export function parseCreatedMaintenanceRequestId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

export type PostMaintenanceBody = {
  tenancyId: string;
  title: string;
  description: string;
  issueType?: string;
  triage_urgency?: MaintenanceUrgency;
  triage_trade?: MaintenanceTrade;
  triage_summary?: string;
};

export function parsePostMaintenanceBody(body: unknown): PostMaintenanceBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;

  const forbiddenKeys = [
    "property_id",
    "propertyId",
    "unit_id",
    "unitId",
    "organizationId",
    "status",
    "assigned_to_name",
  ];
  for (const key of forbiddenKeys) {
    if (key in o) {
      return { error: `Field not allowed: ${key}` };
    }
  }

  const tenancyId = typeof o.tenancyId === "string" ? o.tenancyId.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description = typeof o.description === "string" ? o.description : "";

  if (!tenancyId) return { error: "tenancyId is required" };
  if (!title || title.length > 500) return { error: "title is required (max 500 chars)" };
  if (description.length > 50_000) return { error: "description is too long" };

  let triage_urgency: MaintenanceUrgency | undefined;
  if (o.triage_urgency !== undefined) {
    if (typeof o.triage_urgency !== "string" || !URGENCIES.has(o.triage_urgency as MaintenanceUrgency)) {
      return { error: "Invalid triage_urgency" };
    }
    triage_urgency = o.triage_urgency as MaintenanceUrgency;
  }

  let triage_trade: MaintenanceTrade | undefined;
  if (o.triage_trade !== undefined) {
    if (typeof o.triage_trade !== "string" || !TRADES.has(o.triage_trade as MaintenanceTrade)) {
      return { error: "Invalid triage_trade" };
    }
    triage_trade = o.triage_trade as MaintenanceTrade;
  }

  const triage_summary = typeof o.triage_summary === "string" ? o.triage_summary : undefined;
  const issueType = typeof o.issueType === "string" ? o.issueType : undefined;

  return {
    tenancyId,
    title,
    description,
    issueType,
    triage_urgency,
    triage_trade,
    triage_summary,
  };
}

export type PatchMaintenanceBody = {
  status?: ManagerWorkflowStatus;
  assigned_to_name?: string | null;
  completion_note?: string | null;
};

const WORKFLOW_STATUSES = new Set<ManagerWorkflowStatus>([
  "new",
  "dispatched",
  "completed",
  "cancelled",
]);

export function parsePatchMaintenanceBody(body: unknown): PatchMaintenanceBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return { error: "At least one field is required" };
  }

  const allowed = new Set(["status", "assigned_to_name", "completion_note"]);
  for (const key of keys) {
    if (!allowed.has(key)) {
      return { error: `Unknown field: ${key}` };
    }
  }

  const out: PatchMaintenanceBody = {};

  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !WORKFLOW_STATUSES.has(o.status as ManagerWorkflowStatus)) {
      return { error: "Invalid status" };
    }
    out.status = o.status as ManagerWorkflowStatus;
  }

  if (o.assigned_to_name !== undefined) {
    if (o.assigned_to_name === null) {
      out.assigned_to_name = null;
    } else if (typeof o.assigned_to_name === "string") {
      if (o.assigned_to_name.length > 500) return { error: "assigned_to_name too long" };
      out.assigned_to_name = o.assigned_to_name;
    } else {
      return { error: "Invalid assigned_to_name" };
    }
  }

  if (o.completion_note !== undefined) {
    if (o.completion_note === null) {
      out.completion_note = null;
    } else if (typeof o.completion_note === "string") {
      if (o.completion_note.length > 20_000) return { error: "completion_note too long" };
      out.completion_note = o.completion_note;
    } else {
      return { error: "Invalid completion_note" };
    }
  }

  return out;
}
