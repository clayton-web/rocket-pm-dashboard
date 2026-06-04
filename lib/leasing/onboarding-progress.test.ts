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
  it("marks tenancy created complete and lease/documents current", () => {
    const steps = getOnboardingSteps();
    assert.equal(steps[0]?.state, "complete");
    assert.equal(steps[0]?.id, "tenancy_created");
    assert.equal(steps[1]?.state, "current");
    assert.equal(steps[1]?.id, "lease_documents");
    assert.ok(steps.slice(2).every((s) => s.state === "upcoming"));
  });
});

describe("getOnboardingNextStep", () => {
  it("warns when move-in is overdue", () => {
    const step = getOnboardingNextStep({
      moveInDate: "2020-01-01",
      portalAccessEnabled: true,
    });
    assert.equal(step.kind, "overdue_move_in");
    assert.equal(step.anchorId, "onboarding-lifecycle");
  });

  it("directs staff to enable portal when access is off", () => {
    const today = new Date().toISOString().slice(0, 10);
    const step = getOnboardingNextStep({
      moveInDate: today,
      portalAccessEnabled: false,
    });
    assert.equal(step.kind, "enable_portal");
    assert.equal(step.anchorId, "onboarding-contacts");
  });

  it("suggests offline prep when portal is ready", () => {
    const today = new Date();
    const far = new Date(today);
    far.setUTCDate(today.getUTCDate() + 30);
    const step = getOnboardingNextStep({
      moveInDate: far.toISOString().slice(0, 10),
      portalAccessEnabled: true,
    });
    assert.equal(step.kind, "prepare_onboarding");
    assert.equal(step.anchorId, "onboarding-lifecycle");
  });
});
