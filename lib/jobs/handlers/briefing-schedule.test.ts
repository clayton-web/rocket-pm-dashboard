import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleBriefingSchedule } from "@/lib/jobs/handlers/briefing-schedule";
import { BRIEFING_SCHEDULE_DECOMMISSIONED_REASON } from "@/lib/jobs/policy";
import type { BackgroundJob } from "@prisma/client";

describe("handleBriefingSchedule", () => {
  it("completes stale briefing.schedule jobs without enqueueing briefing.generate", async () => {
    const job = {
      id: "job_stale_schedule",
      organizationId: "org_1",
      jobType: "briefing.schedule",
      payload: { slot: "MORNING", organizationId: "org_1" },
      triggeredByUserId: "user_1",
    } as unknown as BackgroundJob;

    const result = await handleBriefingSchedule({ job, workerId: "test-worker" });

    assert.deepEqual(result.metadata, {
      skippedReason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
      decommissioned: true,
    });
  });
});
