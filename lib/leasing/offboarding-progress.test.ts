import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOffboardingNextStep,
  getOffboardingSteps,
  showsOffboardingSummary,
} from "./offboarding-progress";

describe("showsOffboardingSummary", () => {
  it("is false before notice_received", () => {
    assert.equal(showsOffboardingSummary("active"), false);
    assert.equal(showsOffboardingSummary("pending_move_in"), false);
  });

  it("is true from notice_received onward", () => {
    assert.equal(showsOffboardingSummary("notice_received"), true);
    assert.equal(showsOffboardingSummary("move_out_scheduled"), true);
    assert.equal(showsOffboardingSummary("archived"), true);
  });
});

describe("getOffboardingSteps", () => {
  it("marks current step for inspection_scheduled", () => {
    const steps = getOffboardingSteps("inspection_scheduled");
    const current = steps.filter((s) => s.state === "current");
    assert.equal(current.length, 1);
    assert.equal(current[0]?.id, "inspection_scheduled");
  });

  it("marks all complete when archived", () => {
    const steps = getOffboardingSteps("archived");
    assert.ok(steps.every((s) => s.state === "complete"));
  });
});

describe("getOffboardingNextStep", () => {
  it("links to notice for schedule move-out", () => {
    const step = getOffboardingNextStep("notice_received", {
      acceptedNoticeId: "n1",
      awaitingScheduleNoticeId: "n1",
    });
    assert.equal(step.kind, "schedule_move_out");
    assert.equal(step.href, "/leasing/notices/n1");
  });

  it("uses anchor for inspection schedule", () => {
    const step = getOffboardingNextStep("move_out_scheduled", {
      acceptedNoticeId: "n1",
      awaitingScheduleNoticeId: null,
    });
    assert.equal(step.anchorId, "offboarding-schedule-inspection");
  });
});
