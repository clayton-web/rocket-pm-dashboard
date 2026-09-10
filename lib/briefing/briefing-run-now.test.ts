import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BriefingSlot } from "@prisma/client";
import {
  buildManualBriefingGenerateEnqueueInput,
  enqueueManualBriefingGenerate,
  MANUAL_BRIEFING_GENERATE_JOB_TYPE,
} from "@/lib/briefing/briefing-run-now";
import { enqueueBriefingGenerateJob } from "@/lib/briefing/enqueue-briefing-generate";
import {
  BRIEFING_DECOMMISSIONED_MESSAGE,
  BRIEFING_DECOMMISSIONED_REASON,
  briefingDecommissionedActionResult,
} from "@/lib/jobs/policy";
import { JOB_TYPES } from "@/lib/jobs/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("manual briefing run enqueue", () => {
  it("still names the retired briefing.generate job type", () => {
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

  it("refuses to enqueue briefing.generate from the manual product path", async () => {
    const input = buildManualBriefingGenerateEnqueueInput({
      organizationId: "org_1",
      slot: BriefingSlot.MORNING,
      lookbackHours: 12,
      lastCompletedRunWindowEnd: null,
      triggeredByUserId: "user_1",
    });

    await assert.rejects(() => enqueueManualBriefingGenerate(input), /decommissioned/i);
    await assert.rejects(() => enqueueBriefingGenerateJob(input), /decommissioned/i);
  });
});

describe("Run Now action and UI", () => {
  it("returns the decommissioned contract used by the staff action", () => {
    assert.deepEqual(briefingDecommissionedActionResult(), {
      ok: false,
      error: BRIEFING_DECOMMISSIONED_MESSAGE,
      reason: BRIEFING_DECOMMISSIONED_REASON,
    });
  });

  it("does not render Run Now and server actions cannot enqueue generate", () => {
    const page = readFileSync(join(root, "app/(dashboard)/briefing/page.tsx"), "utf8");
    assert.doesNotMatch(page, /BriefingRunNowButton/);
    assert.doesNotMatch(page, /Run briefing now/);
    assert.match(page, /Daily Briefing is decommissioned/);

    const actions = readFileSync(join(root, "app/(dashboard)/briefing/actions.ts"), "utf8");
    assert.match(actions, /briefingDecommissionedActionResult/);
    assert.doesNotMatch(actions, /enqueueManualBriefingGenerate/);
    assert.doesNotMatch(actions, /enqueueBriefingGenerateJob/);
  });
});
