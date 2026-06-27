import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { BriefingSlot, BriefingSourceType } from "@prisma/client";
import {
  enqueueBriefingScheduleForCron,
  enqueueBriefingScheduleForEligibleOrgs,
} from "@/lib/briefing/enqueue-briefing-schedule-cron";

const ORG_ID = "org_cron_test";

const eligibleOrg = {
  organizationId: ORG_ID,
  settings: {
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    activeSourceTypes: [BriefingSourceType.EMAIL],
    autoSyncBeforeBriefing: true,
    lookbackHours: 12,
    timezone: "America/Vancouver",
    morningLocalTime: "07:00",
    afternoonLocalTime: "14:00",
    emailRecipients: ["ops@example.com"],
  },
};

describe("enqueueBriefingScheduleForCron", () => {
  const prevBriefingEnv = process.env.BRIEFING_AUTOMATION_ENABLED;

  afterEach(() => {
    if (prevBriefingEnv === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prevBriefingEnv;
  });

  it("returns briefing_automation_disabled when env gate is off", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "false";

    const result = await enqueueBriefingScheduleForCron({
      slot: BriefingSlot.MORNING,
      triggeredByUserId: "user_1",
    });

    assert.deepEqual(result, { ok: false, reason: "briefing_automation_disabled" });
  });

  it("enqueues briefing.schedule for each eligible org and slot", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";

    const enqueued: Array<{ organizationId: string; slot: BriefingSlot }> = [];

    const result = await enqueueBriefingScheduleForCron(
      {
        slot: BriefingSlot.MORNING,
        triggeredByUserId: "user_1",
      },
      {
        listEligibleOrganizations: async () => [eligibleOrg],
        enqueueScheduleJob: async (args) => {
          enqueued.push({ organizationId: args.organizationId, slot: args.slot });
          return { jobId: "job_schedule_1", created: true };
        },
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.enqueued, 1);
    assert.deepEqual(enqueued, [{ organizationId: ORG_ID, slot: BriefingSlot.MORNING }]);
  });
});

describe("enqueueBriefingScheduleForEligibleOrgs", () => {
  it("skips orgs when the requested slot is disabled", async () => {
    const result = await enqueueBriefingScheduleForEligibleOrgs({
      slot: BriefingSlot.MORNING,
      triggeredByUserId: "user_1",
      dryRun: true,
      eligibleOrgs: [
        {
          ...eligibleOrg,
          settings: { ...eligibleOrg.settings, morningEnabled: false },
        },
      ],
      enqueueScheduleJob: async () => ({ jobId: "unused", created: false }),
    });

    assert.equal(result.skipped, 1);
    assert.equal(result.results[0]?.reason, "slot_disabled");
  });
});
