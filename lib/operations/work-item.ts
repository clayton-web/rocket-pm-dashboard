/**
 * Presentation-only work item model for the Operations Centre.
 * Does not persist; does not alter domain statuses or workflows.
 */

export const OPERATIONS_SECTIONS = [
  "needs_attention",
  "overdue",
  "waiting",
  "coming_up",
] as const;

export type OperationsSection = (typeof OPERATIONS_SECTIONS)[number];

export const OPERATIONS_SECTION_LABELS: Record<OperationsSection, string> = {
  needs_attention: "Needs attention",
  overdue: "Overdue",
  waiting: "Waiting",
  coming_up: "Coming up",
};

export type OperationalRecordType =
  | "prospect"
  | "application"
  | "tenancy"
  | "notice"
  | "maintenance";

export type WaitingOnParty =
  | "staff"
  | "tenant"
  | "owner"
  | "applicant"
  | "vendor"
  | "system"
  | null;

export type WorkItemUrgency = "high" | "normal" | "low";

/**
 * Domain-neutral intra-section urgency order (lower = higher priority).
 * Used after overdue and dueAt comparisons.
 */
export const WORK_ITEM_URGENCY_RANK: Record<WorkItemUrgency, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Signals used by the classifier. Adapters set these; they do not assign
 * primarySection themselves.
 */
export type WorkItemClassificationSignals = {
  /** Staff must take an action now (not purely waiting / scheduled). */
  requiresStaffAction: boolean;
  /** Past a due/scheduled operational date. */
  isOverdue: boolean;
  /** Deterministically waiting on a non-staff party. */
  isWaitingOnOther: boolean;
  /** Has an upcoming operational date inside the configured window. */
  isComingUp: boolean;
};

/**
 * Normalized item before section assignment.
 */
export type OperationalWorkItemDraft = {
  key: string;
  recordType: OperationalRecordType;
  recordId: string;
  title: string;
  subtitle: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  statusLabel: string;
  /** User-facing next-action copy from existing workflow helpers / label maps. */
  nextActionLabel: string;
  /** Existing detail or queue route. */
  href: string;
  /** Module queue for “view all”. */
  viewAllHref: string;
  workflowBadge: string;
  dueAt: string | null;
  waitingOn: WaitingOnParty;
  assignedToLabel: string | null;
  urgency: WorkItemUrgency;
  secondaryIndicators: string[];
  signals: WorkItemClassificationSignals;
};

export type OperationalWorkItem = Omit<OperationalWorkItemDraft, "signals"> & {
  primarySection: OperationsSection;
  /** Mirrors signals.isOverdue for display. */
  isOverdue: boolean;
};

export const OPERATIONS_PREVIEW_LIMIT = 8;

export const WAITING_ON_LABELS: Record<Exclude<WaitingOnParty, null>, string> = {
  staff: "Waiting on staff",
  tenant: "Waiting on tenant",
  owner: "Waiting on owner",
  applicant: "Waiting on applicant",
  vendor: "Waiting on vendor",
  system: "Waiting on system",
};
