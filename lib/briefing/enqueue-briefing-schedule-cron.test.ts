import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { BriefingSlot, BriefingSourceType } from "@prisma/client";
import {
  enqueueBriefingScheduleForCron,
  enqueueBriefingScheduleForEligibleOrgs,
} from "@/lib/briefing/enqueue-briefing-schedule-cron";
import { enqueueBriefingScheduleJob } from "@/lib/briefing/enqueue-briefing-schedule";
import { BRIEFING_SCHEDULE_DECOMMISSIONED_REASON } from "@/lib/jobs/policy";

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

  it("does not enqueue when the env gate is off", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "false";
    let called = 0;

    const result = await enqueueBriefingScheduleForCron(
      {
        slot: BriefingSlot.MORNING,
        triggeredByUserId: "user_1",
      },
      {
        listEligibleOrganizations: async () => {
          called += 1;
          return [eligibleOrg];
        },
        enqueueScheduleJob: async () => {
          throw new Error("must not enqueue briefing.schedule");
        },
      },
    );

    assert.deepEqual(result, { ok: false, reason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON });
    assert.equal(called, 0);
  });

  it("does not enqueue even when BRIEFING_AUTOMATION_ENABLED is true", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    let called = 0;

    const result = await enqueueBriefingScheduleForCron(
      {
        slot: BriefingSlot.MORNING,
        triggeredByUserId: "user_1",
        dryRun: true,
      },
      {
        listEligibleOrganizations: async () => {
          called += 1;
          return [eligibleOrg];
        },
        enqueueScheduleJob: async () => {
          throw new Error("must not enqueue briefing.schedule");
        },
      },
    );

    assert.deepEqual(result, { ok: false, reason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON });
    assert.equal(called, 0);
  });
});

describe("enqueueBriefingScheduleJob", () => {
  it("refuses to create briefing.schedule jobs", async () => {
    await assert.rejects(
      () =>
        enqueueBriefingScheduleJob({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          triggeredByUserId: "user_1",
        }),
      /decommissioned/i,
    );
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
