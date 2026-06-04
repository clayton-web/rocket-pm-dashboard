import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyOnboardingAttentionKind } from "./onboarding-attention";
import {
  getOnboardingNextStep,
  getOnboardingSteps,
  isOverdueMoveIn,
  isUpcomingMoveIn,
  onboardingSnapshotFromLeaseSigningProgress,
  showsOnboardingSummary,
  UPCOMING_MOVE_IN_DAYS,
} from "./onboarding-progress";

describe("showsOnboardingSummary", () => {
  it("is true only for pending_move_in", () => {
    assert.equal(showsOnboardingSummary("pending_move_in"), true);
    assert.equal(showsOnboardingSummary("active"), false);
    assert.equal(showsOnboardingSummary("notice_received"), false);
  });
});

describe("isOverdueMoveIn", () => {
  it("is true when move-in date is before today", () => {
    assert.equal(isOverdueMoveIn("2020-01-01"), true);
  });

  it("is false when move-in date is today or later", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(isOverdueMoveIn(today), false);
    assert.equal(isOverdueMoveIn(null), false);
  });
});

describe("isUpcomingMoveIn", () => {
  it("is true within the upcoming window", () => {
    const today = new Date();
    const inThreeDays = new Date(today);
    inThreeDays.setUTCDate(today.getUTCDate() + 3);
    const iso = inThreeDays.toISOString().slice(0, 10);
    assert.equal(isUpcomingMoveIn(iso), true);
  });

  it("is false beyond the upcoming window", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + UPCOMING_MOVE_IN_DAYS + 2);
    assert.equal(isUpcomingMoveIn(far.toISOString().slice(0, 10)), false);
  });

  it("is false for overdue dates", () => {
    assert.equal(isUpcomingMoveIn("2020-01-01"), false);
  });
});

describe("classifyOnboardingAttentionKind", () => {
  it("prioritizes overdue over portal status", () => {
    assert.equal(
      classifyOnboardingAttentionKind({
        moveInDate: "2020-01-01",
        portalAccessEnabled: false,
      }),
      "overdue",
    );
  });

  it("classifies portal not ready when move-in is not urgent", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + 30);
    assert.equal(
      classifyOnboardingAttentionKind({
        moveInDate: far.toISOString().slice(0, 10),
        portalAccessEnabled: false,
      }),
      "portal_not_ready",
    );
  });

  it("classifies pending when portal is ready and move-in is not urgent", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + 30);
    assert.equal(
      classifyOnboardingAttentionKind({
        moveInDate: far.toISOString().slice(0, 10),
        portalAccessEnabled: true,
      }),
      "pending",
    );
  });
});

describe("getOnboardingSteps", () => {
  it("marks lease setup current when incomplete", () => {
    const steps = getOnboardingSteps({ leaseSetupStatus: "lease_setup_incomplete" });
    const leaseSetup = steps.find((s) => s.id === "lease_setup");
    assert.equal(leaseSetup?.state, "current");
    assert.equal(steps[0]?.state, "complete");
    assert.equal(steps[0]?.id, "tenancy_created");
  });

  it("marks RTB-1 draft current when ready but no draft exists", () => {
    const steps = getOnboardingSteps({ leaseSetupStatus: "ready_for_rtb1" });
    const leaseSetup = steps.find((s) => s.id === "lease_setup");
    const rtbDraft = steps.find((s) => s.id === "rtb1_draft");
    assert.equal(leaseSetup?.state, "complete");
    assert.equal(rtbDraft?.state, "current");
  });

  it("marks RTB-1 draft complete when a draft document exists", () => {
    const steps = getOnboardingSteps({
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: false,
        tenantSigned: false,
        executed: false,
      },
    });
    const rtbDraft = steps.find((s) => s.id === "rtb1_draft");
    const signatureSent = steps.find((s) => s.id === "signature_sent");
    assert.equal(rtbDraft?.state, "complete");
    assert.equal(signatureSent?.state, "current");
  });

  it("marks tenant signed and lease executed steps through signing flow", () => {
    const steps = getOnboardingSteps({
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      portalAccessEnabled: true,
      activationReady: true,
    });
    assert.equal(steps.find((s) => s.id === "tenant_signed")?.state, "complete");
    assert.equal(steps.find((s) => s.id === "lease_executed")?.state, "complete");
    assert.equal(steps.find((s) => s.id === "portal_ready")?.state, "complete");
    assert.equal(steps.find((s) => s.id === "ready_to_activate")?.state, "complete");
    assert.equal(steps.find((s) => s.id === "active")?.state, "current");
  });

  it("marks portal and activation steps when lease is executed", () => {
    const steps = getOnboardingSteps({
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      portalAccessEnabled: false,
      activationReady: true,
    });
    assert.equal(steps.find((s) => s.id === "portal_ready")?.state, "current");
    assert.equal(steps.find((s) => s.id === "ready_to_activate")?.state, "complete");
  });
});

describe("getOnboardingNextStep", () => {
  it("prioritizes lease setup completion", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2020-01-01",
      portalAccessEnabled: false,
      leaseSetupStatus: "lease_setup_incomplete",
    });
    assert.equal(step.kind, "complete_lease_setup");
    assert.equal(step.anchorId, "lease-setup");
  });

  it("directs staff to organization settings when landlord profile is incomplete", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2030-01-01",
      portalAccessEnabled: true,
      leaseSetupStatus: "lease_setup_complete",
    });
    assert.equal(step.kind, "complete_org_landlord");
    assert.equal(step.href, "/organization");
  });

  it("shows RTB-1 readiness when fully validated", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2020-01-01",
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
    });
    assert.equal(step.kind, "generate_rtb1_draft");
  });

  it("prompts to send for signature after draft generation", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2030-06-01",
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: false,
        tenantSigned: false,
        executed: false,
      },
    });
    assert.equal(step.kind, "send_for_signature");
  });

  it("prompts PM counter-sign after tenant signature", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2030-06-01",
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: false,
      },
    });
    assert.equal(step.kind, "pm_counter_sign");
  });

  it("prompts to mark active when lease is executed and portal is ready", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + 30);
    const step = getOnboardingNextStep({
      moveInDate: far.toISOString().slice(0, 10),
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      activationReady: true,
    });
    assert.equal(step.kind, "mark_active");
    assert.equal(step.anchorId, "onboarding-lifecycle");
  });

  it("blocks activation next step when executed lease is missing", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2030-06-01",
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      activationReady: false,
    });
    assert.match(step.description, /executed/i);
  });
});

describe("onboardingSnapshotFromLeaseSigningProgress", () => {
  it("maps lease signing steps to onboarding execution snapshot", () => {
    const snapshot = onboardingSnapshotFromLeaseSigningProgress([
      { id: "draft_generated", complete: true },
      { id: "signature_sent", complete: true },
      { id: "tenant_signed", complete: false },
      { id: "executed", complete: false },
    ]);
    assert.equal(snapshot.hasRtb1Draft, true);
    assert.equal(snapshot.signatureSent, true);
    assert.equal(snapshot.tenantSigned, false);
    assert.equal(snapshot.executed, false);
  });
});
