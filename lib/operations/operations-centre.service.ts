import { listApprovedApplicationsReadyToConvertForStaff } from "@/lib/leasing/application-conversion-staff-queue";
import { listApplicationQueueForStaff } from "@/lib/leasing/application-staff-queue";
import { listOffboardingAttentionForStaff } from "@/lib/leasing/offboarding-attention-queue";
import { listOnboardingAttentionForStaff } from "@/lib/leasing/onboarding-attention-queue";
import { listNewProspectQueueForStaff } from "@/lib/leasing/staff-queue";
import type { StaffContext } from "@/lib/services/staff-context";
import { adaptApplicationConversionToWorkItemDraft } from "@/lib/operations/adapters/application-work-item";
import { adaptApplicationReviewToWorkItemDraft } from "@/lib/operations/adapters/application-work-item";
import { adaptOffboardingToWorkItemDraft } from "@/lib/operations/adapters/offboarding-work-item";
import { adaptOnboardingToWorkItemDraft } from "@/lib/operations/adapters/onboarding-work-item";
import { adaptProspectToWorkItemDraft } from "@/lib/operations/adapters/prospect-work-item";
import { classifyWorkItems } from "@/lib/operations/classify-work-item";
import { loadOnboardingNextStepsForAttentionRows } from "@/lib/operations/onboarding-next-step-loader";
import {
  OPERATIONS_PREVIEW_LIMIT,
  OPERATIONS_SECTION_LABELS,
  OPERATIONS_SECTIONS,
  type OperationalWorkItem,
  type OperationalWorkItemDraft,
  type OperationsSection,
} from "@/lib/operations/work-item";

export type OperationsSourceId =
  | "prospects"
  | "application_review"
  | "application_conversion"
  | "onboarding"
  | "offboarding";

export type OperationsSourceError = {
  sourceId: OperationsSourceId;
  message: string;
};

export type OperationsCentreSection = {
  id: OperationsSection;
  label: string;
  total: number;
  preview: OperationalWorkItem[];
  viewAllHref: string | null;
};

export type OperationsCentreData = {
  sections: OperationsCentreSection[];
  summary: Record<OperationsSection, number> & { total: number };
  sourceErrors: OperationsSourceError[];
  previewLimit: number;
};

const SOURCE_LABELS: Record<OperationsSourceId, string> = {
  prospects: "Viewing requests",
  application_review: "Applications to review",
  application_conversion: "Approved applications",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
};

function defaultViewAllHref(section: OperationsSection): string | null {
  switch (section) {
    case "needs_attention":
      return "/leasing";
    case "overdue":
      return "/leasing/onboarding?queue=overdue";
    case "waiting":
      return "/leasing/prospects";
    case "coming_up":
      return "/leasing/onboarding?queue=upcoming";
  }
}

function sortItems(items: OperationalWorkItem[]): OperationalWorkItem[] {
  return [...items].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aDue = a.dueAt ?? "";
    const bDue = b.dueAt ?? "";
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    return a.title.localeCompare(b.title);
  });
}

type SourceResult = {
  sourceId: OperationsSourceId;
  drafts: OperationalWorkItemDraft[];
  error?: string;
};

async function loadProspectDrafts(ctx: StaffContext): Promise<SourceResult> {
  try {
    const rows = await listNewProspectQueueForStaff(ctx);
    const drafts = rows
      .map((row) => adaptProspectToWorkItemDraft(row))
      .filter((d): d is OperationalWorkItemDraft => d != null);
    return { sourceId: "prospects", drafts };
  } catch (e) {
    return {
      sourceId: "prospects",
      drafts: [],
      error: e instanceof Error ? e.message : "Failed to load viewing requests",
    };
  }
}

async function loadApplicationReviewDrafts(ctx: StaffContext): Promise<SourceResult> {
  try {
    const rows = await listApplicationQueueForStaff(ctx);
    return {
      sourceId: "application_review",
      drafts: rows.map(adaptApplicationReviewToWorkItemDraft),
    };
  } catch (e) {
    return {
      sourceId: "application_review",
      drafts: [],
      error: e instanceof Error ? e.message : "Failed to load applications",
    };
  }
}

async function loadApplicationConversionDrafts(ctx: StaffContext): Promise<SourceResult> {
  try {
    const rows = await listApprovedApplicationsReadyToConvertForStaff(ctx);
    const drafts = rows
      .map(adaptApplicationConversionToWorkItemDraft)
      .filter((d): d is OperationalWorkItemDraft => d != null);
    return { sourceId: "application_conversion", drafts };
  } catch (e) {
    return {
      sourceId: "application_conversion",
      drafts: [],
      error: e instanceof Error ? e.message : "Failed to load conversion queue",
    };
  }
}

async function loadOnboardingDrafts(ctx: StaffContext): Promise<SourceResult> {
  try {
    const rows = await listOnboardingAttentionForStaff(ctx);
    const nextSteps = await loadOnboardingNextStepsForAttentionRows(ctx, rows);
    const drafts: OperationalWorkItemDraft[] = [];
    for (const row of rows) {
      const nextStep = nextSteps.get(row.tenancy.id);
      if (!nextStep) continue;
      drafts.push(adaptOnboardingToWorkItemDraft(row, nextStep));
    }
    return { sourceId: "onboarding", drafts };
  } catch (e) {
    return {
      sourceId: "onboarding",
      drafts: [],
      error: e instanceof Error ? e.message : "Failed to load onboarding",
    };
  }
}

async function loadOffboardingDrafts(ctx: StaffContext): Promise<SourceResult> {
  try {
    const rows = await listOffboardingAttentionForStaff(ctx);
    return {
      sourceId: "offboarding",
      drafts: rows.map((row) => adaptOffboardingToWorkItemDraft(row)),
    };
  } catch (e) {
    return {
      sourceId: "offboarding",
      drafts: [],
      error: e instanceof Error ? e.message : "Failed to load offboarding",
    };
  }
}

/**
 * Compose leasing attention sources into a classified Operations Centre payload.
 * Uses existing staff queue loaders (org + property scoped). Isolates source failures.
 */
export async function getOperationsCentreForStaff(
  ctx: StaffContext,
): Promise<OperationsCentreData> {
  const settled = await Promise.all([
    loadProspectDrafts(ctx),
    loadApplicationReviewDrafts(ctx),
    loadApplicationConversionDrafts(ctx),
    loadOnboardingDrafts(ctx),
    loadOffboardingDrafts(ctx),
  ]);

  const sourceErrors: OperationsSourceError[] = [];
  const allDrafts: OperationalWorkItemDraft[] = [];

  for (const source of settled) {
    if (source.error) {
      sourceErrors.push({
        sourceId: source.sourceId,
        message: `${SOURCE_LABELS[source.sourceId]}: ${source.error}`,
      });
    }
    allDrafts.push(...source.drafts);
  }

  const classified = classifyWorkItems(allDrafts);

  const bySection = new Map<OperationsSection, OperationalWorkItem[]>();
  for (const section of OPERATIONS_SECTIONS) {
    bySection.set(section, []);
  }
  for (const item of classified) {
    bySection.get(item.primarySection)?.push(item);
  }

  const summary = {
    needs_attention: 0,
    overdue: 0,
    waiting: 0,
    coming_up: 0,
    total: 0,
  };

  const sections: OperationsCentreSection[] = OPERATIONS_SECTIONS.map((id) => {
    const items = sortItems(bySection.get(id) ?? []);
    summary[id] = items.length;
    summary.total += items.length;
    const preview = items.slice(0, OPERATIONS_PREVIEW_LIMIT);
    const viewAllHref =
      preview[0]?.viewAllHref ?? defaultViewAllHref(id);
    return {
      id,
      label: OPERATIONS_SECTION_LABELS[id],
      total: items.length,
      preview,
      viewAllHref: items.length > OPERATIONS_PREVIEW_LIMIT ? viewAllHref : viewAllHref,
    };
  });

  return {
    sections,
    summary,
    sourceErrors,
    previewLimit: OPERATIONS_PREVIEW_LIMIT,
  };
}

/** Test helper: classify pre-built drafts the same way as the service. */
export function buildOperationsCentreFromDrafts(
  drafts: OperationalWorkItemDraft[],
  sourceErrors: OperationsSourceError[] = [],
): OperationsCentreData {
  const classified = classifyWorkItems(drafts);
  const bySection = new Map<OperationsSection, OperationalWorkItem[]>();
  for (const section of OPERATIONS_SECTIONS) {
    bySection.set(section, []);
  }
  for (const item of classified) {
    bySection.get(item.primarySection)?.push(item);
  }

  const summary = {
    needs_attention: 0,
    overdue: 0,
    waiting: 0,
    coming_up: 0,
    total: 0,
  };

  const sections: OperationsCentreSection[] = OPERATIONS_SECTIONS.map((id) => {
    const items = sortItems(bySection.get(id) ?? []);
    summary[id] = items.length;
    summary.total += items.length;
    return {
      id,
      label: OPERATIONS_SECTION_LABELS[id],
      total: items.length,
      preview: items.slice(0, OPERATIONS_PREVIEW_LIMIT),
      viewAllHref: defaultViewAllHref(id),
    };
  });

  return { sections, summary, sourceErrors, previewLimit: OPERATIONS_PREVIEW_LIMIT };
}
