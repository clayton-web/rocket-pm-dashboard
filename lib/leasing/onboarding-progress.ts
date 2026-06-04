import type { LeaseSetupReadinessStatus } from "./lease-setup-readiness";

export const UPCOMING_MOVE_IN_DAYS = 7;

export type OnboardingStepId =
  | "tenancy_created"
  | "lease_setup"
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
  | "complete_lease_setup"
  | "complete_org_landlord"
  | "ready_for_rtb1"
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

export function showsOnboardingSummary(status: string): boolean {
  return status === "pending_move_in";
}

export function getOnboardingSteps(opts: {
  leaseSetupStatus: LeaseSetupReadinessStatus;
}): OnboardingStep[] {
  const leaseComplete =
    opts.leaseSetupStatus === "lease_setup_complete" ||
    opts.leaseSetupStatus === "ready_for_rtb1";
  const rtbReady = opts.leaseSetupStatus === "ready_for_rtb1";

  const stepDefs: { id: OnboardingStepId; label: string; complete: boolean; current: boolean }[] =
    [
      { id: "tenancy_created", label: "Tenancy created", complete: true, current: false },
      {
        id: "lease_setup",
        label: "Lease setup",
        complete: leaseComplete,
        current: !leaseComplete,
      },
      {
        id: "lease_documents",
        label: "RTB-1 generation",
        complete: false,
        current: leaseComplete && !rtbReady,
      },
      {
        id: "move_in_prep",
        label: "Move-in prep",
        complete: false,
        current: rtbReady,
      },
      { id: "portal_ready", label: "Portal ready", complete: false, current: false },
      { id: "ready_to_activate", label: "Ready to activate", complete: false, current: false },
      { id: "active", label: "Active", complete: false, current: false },
    ];

  const hasExplicitCurrent = stepDefs.some((s) => s.current);
  if (!hasExplicitCurrent) {
    const firstIncomplete = stepDefs.find((s) => !s.complete);
    if (firstIncomplete) firstIncomplete.current = true;
  }

  return stepDefs.map((step) => ({
    id: step.id,
    label: step.label,
    state: step.complete ? "complete" : step.current ? "current" : "upcoming",
  }));
}

export function getOnboardingNextStep(opts: {
  portalAccessEnabled: boolean | null;
  moveInDate: string;
  leaseSetupStatus: LeaseSetupReadinessStatus;
}): OnboardingNextStep {
  if (opts.leaseSetupStatus === "lease_setup_incomplete") {
    return {
      kind: "complete_lease_setup",
      title: "Complete lease setup",
      description:
        "Enter tenancy type, rent terms, deposits, services, and RTB-specific fields before generating the RTB-1.",
      anchorId: "lease-setup",
    };
  }

  if (opts.leaseSetupStatus === "lease_setup_complete") {
    return {
      kind: "complete_org_landlord",
      title: "Complete organization landlord profile",
      description:
        "Lease setup is complete for this tenancy. Add landlord service information under Organization settings to become ready for RTB-1 generation.",
      href: "/organization",
    };
  }

  if (opts.leaseSetupStatus === "ready_for_rtb1") {
    return {
      kind: "ready_for_rtb1",
      title: "Ready for RTB-1 generation",
      description:
        "Lease setup and landlord profile are complete. RTB-1 PDF generation will be available in a future release.",
      anchorId: "lease-setup",
    };
  }

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
