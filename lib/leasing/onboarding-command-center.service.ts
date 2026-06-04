import {
  listOnboardingAttentionForStaff,
  type OnboardingAttentionRow,
} from "@/lib/leasing/onboarding-attention-queue";
import type { StaffContext } from "@/lib/services/staff-context";

export const ONBOARDING_COMMAND_CENTER_PREVIEW_LIMIT = 5;

export type OnboardingQueueParam = "overdue" | "upcoming" | "portal_not_ready" | "pending";

const QUEUE_PARAMS: ReadonlySet<string> = new Set([
  "overdue",
  "upcoming",
  "portal_not_ready",
  "pending",
]);

export function isOnboardingQueueParam(value: string | undefined | null): value is OnboardingQueueParam {
  return value != null && QUEUE_PARAMS.has(value);
}

export type OnboardingCommandCenterSummary = {
  total: number;
  overdue: number;
  upcoming: number;
  portalNotReady: number;
  pending: number;
};

export type OnboardingCommandCenterSection = {
  total: number;
  preview: OnboardingAttentionRow[];
};

export type OnboardingCommandCenterData = {
  summary: OnboardingCommandCenterSummary;
  overdue: OnboardingCommandCenterSection;
  upcoming: OnboardingCommandCenterSection;
  portalNotReady: OnboardingCommandCenterSection;
  pending: OnboardingCommandCenterSection;
  filteredRows: OnboardingAttentionRow[] | null;
};

function previewSection(rows: OnboardingAttentionRow[]): OnboardingCommandCenterSection {
  return {
    total: rows.length,
    preview: rows.slice(0, ONBOARDING_COMMAND_CENTER_PREVIEW_LIMIT),
  };
}

export function filterOnboardingByQueue(
  rows: OnboardingAttentionRow[],
  queue: OnboardingQueueParam,
): OnboardingAttentionRow[] {
  return rows.filter((row) => row.kind === queue);
}

export async function getOnboardingCommandCenterForStaff(
  ctx: StaffContext,
  queue?: OnboardingQueueParam | null,
): Promise<OnboardingCommandCenterData> {
  const all = await listOnboardingAttentionForStaff(ctx);

  const overdueRows = all.filter((row) => row.kind === "overdue");
  const upcomingRows = all.filter((row) => row.kind === "upcoming");
  const portalNotReadyRows = all.filter((row) => row.kind === "portal_not_ready");
  const pendingRows = all.filter((row) => row.kind === "pending");

  const summary: OnboardingCommandCenterSummary = {
    total: all.length,
    overdue: overdueRows.length,
    upcoming: upcomingRows.length,
    portalNotReady: portalNotReadyRows.length,
    pending: pendingRows.length,
  };

  return {
    summary,
    overdue: previewSection(overdueRows),
    upcoming: previewSection(upcomingRows),
    portalNotReady: previewSection(portalNotReadyRows),
    pending: previewSection(pendingRows),
    filteredRows: queue ? filterOnboardingByQueue(all, queue) : null,
  };
}
