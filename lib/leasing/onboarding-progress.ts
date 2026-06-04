import type { TenancyStatus } from "@prisma/client";

export const UPCOMING_MOVE_IN_DAYS = 7;

export type OnboardingStepId =
  | "tenancy_created"
  | "lease_documents"
  | "move_in_prep"
  | "portal_ready"
  | "ready_to_activate"
  | "active";

export type OnboardingStepState = "complete" | "current" | "upcoming";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  state: OnboardingStepState;
};

export type OnboardingNextStepKind =
  | "overdue_move_in"
  | "enable_portal"
  | "prepare_onboarding"
  | "mark_active"
  | "none";

export type OnboardingNextStep = {
  kind: OnboardingNextStepKind;
  title: string;
  description: string;
  href?: string;
  anchorId?: string;
};

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdueMoveIn(moveInDate: string | null): boolean {
  if (!moveInDate) return false;
  return moveInDate < todayDateString();
}

export function isUpcomingMoveIn(moveInDate: string | null): boolean {
  if (!moveInDate) return false;
  if (isOverdueMoveIn(moveInDate)) return false;
  const moveIn = new Date(`${moveInDate}T12:00:00.000Z`);
  const today = new Date(`${todayDateString()}T12:00:00.000Z`);
  const diffDays = Math.floor((moveIn.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= UPCOMING_MOVE_IN_DAYS;
}

export function showsOnboardingSummary(status: TenancyStatus): boolean {
  return status === "pending_move_in";
}

export function getOnboardingSteps(): OnboardingStep[] {
  const stepDefs: { id: OnboardingStepId; label: string }[] = [
    { id: "tenancy_created", label: "Tenancy created" },
    { id: "lease_documents", label: "Lease / documents" },
    { id: "move_in_prep", label: "Move-in prep" },
    { id: "portal_ready", label: "Portal ready" },
    { id: "ready_to_activate", label: "Ready to activate" },
    { id: "active", label: "Active" },
  ];

  return stepDefs.map((step, index) => {
    let state: OnboardingStepState = "upcoming";
    if (index === 0) state = "complete";
    else if (index === 1) state = "current";
    return { id: step.id, label: step.label, state };
  });
}

export function getOnboardingNextStep(opts: {
  portalAccessEnabled: boolean | null;
  moveInDate: string;
}): OnboardingNextStep {
  if (isOverdueMoveIn(opts.moveInDate)) {
    return {
      kind: "overdue_move_in",
      title: "Move-in date passed",
      description:
        "This tenancy is past its scheduled move-in date. Review lease paperwork, move-in prep, and portal access below. Mark active when the tenant has moved in.",
      anchorId: "onboarding-lifecycle",
    };
  }

  if (opts.portalAccessEnabled !== true) {
    return {
      kind: "enable_portal",
      title: "Enable portal access",
      description:
        "Turn on portal access for the primary tenant contact so they can sign in after you mark this tenancy active. Share login instructions manually for now.",
      anchorId: "onboarding-contacts",
    };
  }

  return {
    kind: "prepare_onboarding",
    title: "Complete move-in prep",
    description:
      "Document tracking and checklists are not automated yet. Confirm lease paperwork and move-in prep offline, then mark active when ready.",
    anchorId: "onboarding-lifecycle",
  };
}
