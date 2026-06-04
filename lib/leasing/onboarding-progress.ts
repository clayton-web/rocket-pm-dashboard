import type { LeaseSetupReadinessStatus } from "./lease-setup-readiness";

export const UPCOMING_MOVE_IN_DAYS = 7;

export type OnboardingStepId =
  | "tenancy_created"
  | "lease_setup"
  | "rtb1_draft"
  | "signature_sent"
  | "tenant_signed"
  | "lease_executed"
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

export type OnboardingLeaseExecutionSnapshot = {
  hasRtb1Draft: boolean;
  signatureSent: boolean;
  tenantSigned: boolean;
  executed: boolean;
};

export type OnboardingNextStepKind =
  | "complete_lease_setup"
  | "complete_org_landlord"
  | "ready_for_rtb1"
  | "generate_rtb1_draft"
  | "send_for_signature"
  | "await_tenant_signature"
  | "pm_counter_sign"
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

const EMPTY_EXECUTION: OnboardingLeaseExecutionSnapshot = {
  hasRtb1Draft: false,
  signatureSent: false,
  tenantSigned: false,
  executed: false,
};

export function getOnboardingSteps(opts: {
  leaseSetupStatus: LeaseSetupReadinessStatus;
  leaseExecution?: OnboardingLeaseExecutionSnapshot;
  portalAccessEnabled?: boolean | null;
  activationReady?: boolean;
}): OnboardingStep[] {
  const execution = opts.leaseExecution ?? EMPTY_EXECUTION;
  const portalReady = opts.portalAccessEnabled === true;
  const activationReady = opts.activationReady === true;
  const leaseComplete =
    opts.leaseSetupStatus === "lease_setup_complete" ||
    opts.leaseSetupStatus === "ready_for_rtb1";
  const rtbReady = opts.leaseSetupStatus === "ready_for_rtb1";
  const postExecution = execution.executed;
  const moveInPrepComplete = postExecution && portalReady && activationReady;

  const stepDefs: { id: OnboardingStepId; label: string; complete: boolean; current: boolean }[] = [
    { id: "tenancy_created", label: "Tenancy created", complete: true, current: false },
    {
      id: "lease_setup",
      label: "Lease setup complete",
      complete: leaseComplete,
      current: opts.leaseSetupStatus === "lease_setup_incomplete",
    },
    {
      id: "rtb1_draft",
      label: "RTB-1 draft generated",
      complete: execution.hasRtb1Draft,
      current: rtbReady && !execution.hasRtb1Draft,
    },
    {
      id: "signature_sent",
      label: "Sent for signature",
      complete: execution.signatureSent || execution.tenantSigned || execution.executed,
      current: execution.hasRtb1Draft && !execution.signatureSent && !execution.tenantSigned && !execution.executed,
    },
    {
      id: "tenant_signed",
      label: "Tenant signed",
      complete: execution.tenantSigned || execution.executed,
      current:
        execution.signatureSent && !execution.tenantSigned && !execution.executed,
    },
    {
      id: "lease_executed",
      label: "Executed lease complete",
      complete: execution.executed,
      current: execution.tenantSigned && !execution.executed,
    },
    {
      id: "move_in_prep",
      label: "Move-in prep",
      complete: moveInPrepComplete,
      current: postExecution && !moveInPrepComplete,
    },
    {
      id: "portal_ready",
      label: "Portal available",
      complete: portalReady,
      current: postExecution && !portalReady,
    },
    {
      id: "ready_to_activate",
      label: "Ready to activate",
      complete: activationReady,
      current: postExecution && portalReady && !activationReady,
    },
    {
      id: "active",
      label: "Active tenant",
      complete: false,
      current: postExecution && portalReady && activationReady,
    },
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
  leaseExecution?: OnboardingLeaseExecutionSnapshot;
  activationReady?: boolean;
}): OnboardingNextStep {
  const execution = opts.leaseExecution ?? EMPTY_EXECUTION;
  const activationReady = opts.activationReady === true;

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

  if (opts.leaseSetupStatus === "ready_for_rtb1" && !execution.hasRtb1Draft) {
    return {
      kind: "generate_rtb1_draft",
      title: "Generate RTB-1 draft",
      description:
        "Lease setup and landlord profile are complete. Generate an RTB-1 draft on this tenancy when ready.",
      anchorId: "lease-setup",
    };
  }

  if (execution.hasRtb1Draft && !execution.signatureSent && !execution.executed) {
    return {
      kind: "send_for_signature",
      title: "Send for signature",
      description: "Send the RTB-1 draft to the tenant for in-app signature.",
      anchorId: "lease-setup",
    };
  }

  if (execution.signatureSent && !execution.tenantSigned) {
    return {
      kind: "await_tenant_signature",
      title: "Awaiting tenant signature",
      description: "Share the signing link with the tenant and wait for their signature on the RTB-1.",
      anchorId: "lease-setup",
    };
  }

  if (execution.tenantSigned && !execution.executed) {
    return {
      kind: "pm_counter_sign",
      title: "Property manager counter-sign",
      description: "Review the tenant signature and counter-sign to generate the executed RTB-1.",
      anchorId: "lease-setup",
    };
  }

  if (execution.executed && !activationReady) {
    return {
      kind: "pm_counter_sign",
      title: "Complete lease execution",
      description:
        "An executed, locked RTB-1 is required before tenant activation. Finish PM counter-sign or retry execution if needed.",
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
        "Turn on portal access for the primary tenant contact. Signing still uses the email link until you mark this tenancy active; portal login and documents work after activation.",
      anchorId: "onboarding-contacts",
    };
  }

  if (activationReady) {
    return {
      kind: "mark_active",
      title: "Mark tenancy active",
      description:
        "The executed RTB-1 is on file and portal access is enabled. Mark active when the tenant has moved in so they can sign in and view their lease.",
      anchorId: "onboarding-lifecycle",
    };
  }

  return {
    kind: "prepare_onboarding",
    title: "Complete move-in prep",
    description:
      "Confirm lease paperwork and move-in prep offline, then mark active when ready.",
    anchorId: "onboarding-lifecycle",
  };
}

export function onboardingSnapshotFromLeaseSigningProgress(steps: {
  id: string;
  complete: boolean;
}[]): OnboardingLeaseExecutionSnapshot {
  const findComplete = (id: string) => steps.find((s) => s.id === id)?.complete === true;
  return {
    hasRtb1Draft: findComplete("draft_generated"),
    signatureSent: findComplete("signature_sent"),
    tenantSigned: findComplete("tenant_signed"),
    executed: findComplete("executed"),
  };
}
