import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSlot } from "@prisma/client";
import {
  buildManualBriefingGenerateEnqueueInput,
  MANUAL_BRIEFING_GENERATE_JOB_TYPE,
} from "@/lib/briefing/briefing-run-now";
import { JOB_TYPES } from "@/lib/jobs/types";

describe("manual briefing run enqueue", () => {
  it("uses briefing.generate job type", () => {
    assert.equal(MANUAL_BRIEFING_GENERATE_JOB_TYPE, JOB_TYPES.BRIEFING_GENERATE);
    assert.equal(JOB_TYPES.BRIEFING_GENERATE, "briefing.generate");
  });

  it("builds a forced USER-triggered enqueue payload", () => {
    const now = new Date("2026-06-26T14:00:00.000Z");
    const input = buildManualBriefingGenerateEnqueueInput({
      organizationId: "org_1",
      slot: BriefingSlot.AFTERNOON,
      lookbackHours: 12,
      lastCompletedRunWindowEnd: null,
      triggeredByUserId: "user_1",
      now,
    });

    assert.equal(input.organizationId, "org_1");
    assert.equal(input.slot, BriefingSlot.AFTERNOON);
    assert.equal(input.triggerSource, "USER");
    assert.equal(input.force, true);
    assert.equal(input.triggeredByUserId, "user_1");
    assert.equal(input.windowEndIso, now.toISOString());
  });
});
