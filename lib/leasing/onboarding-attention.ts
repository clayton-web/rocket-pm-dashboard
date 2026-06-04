import { isOverdueMoveIn, isUpcomingMoveIn } from "@/lib/leasing/onboarding-progress";

export type OnboardingAttentionKind = "overdue" | "upcoming" | "portal_not_ready" | "pending";

export function classifyOnboardingAttentionKind(row: {
  moveInDate: string | null;
  portalAccessEnabled: boolean | null;
}): OnboardingAttentionKind {
  if (isOverdueMoveIn(row.moveInDate)) return "overdue";
  if (isUpcomingMoveIn(row.moveInDate)) return "upcoming";
  if (row.portalAccessEnabled !== true) return "portal_not_ready";
  return "pending";
}
