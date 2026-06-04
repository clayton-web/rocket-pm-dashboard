import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyOnboardingAttentionKind } from "./onboarding-attention";
import {
  getOnboardingNextStep,
  getOnboardingSteps,
  isOverdueMoveIn,
  isUpcomingMoveIn,
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

  it("marks RTB-1 generation current when lease setup is complete but not ready", () => {
    const steps = getOnboardingSteps({ leaseSetupStatus: "lease_setup_complete" });
    const leaseSetup = steps.find((s) => s.id === "lease_setup");
    const rtb = steps.find((s) => s.id === "lease_documents");
    assert.equal(leaseSetup?.state, "complete");
    assert.equal(rtb?.state, "current");
  });

  it("marks move-in prep current when ready for RTB-1", () => {
    const steps = getOnboardingSteps({ leaseSetupStatus: "ready_for_rtb1" });
    const moveInPrep = steps.find((s) => s.id === "move_in_prep");
    assert.equal(moveInPrep?.state, "current");
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
    assert.equal(step.kind, "ready_for_rtb1");
  });

  it("suggests offline prep when portal is ready and lease setup is ready", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + 30);
    const step = getOnboardingNextStep({
      moveInDate: far.toISOString().slice(0, 10),
      portalAccessEnabled: true,
      leaseSetupStatus: "ready_for_rtb1",
    });
    assert.equal(step.kind, "ready_for_rtb1");
  });
});
