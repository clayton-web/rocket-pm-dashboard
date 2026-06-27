import type { BriefingSlot } from "@prisma/client";
import {
  isBriefingSlotEnabled,
  listEligibleBriefingOrganizations,
  type EligibleBriefingOrganization,
} from "@/lib/briefing/briefing-gates";
import { enqueueBriefingScheduleJob } from "@/lib/briefing/enqueue-briefing-schedule";
import { isBriefingAutomationEnabled } from "@/lib/jobs/policy";

export type BriefingScheduleCronOrgResult = {
  organizationId: string;
  jobId?: string;
  created?: boolean;
  reason?: string;
};

export type EnqueueBriefingScheduleCronSuccess = {
  ok: true;
  slot: BriefingSlot;
  organizationsConsidered: number;
  enqueued: number;
  alreadyQueued: number;
  skipped: number;
  results: BriefingScheduleCronOrgResult[];
};

export type EnqueueBriefingScheduleCronResult =
  | EnqueueBriefingScheduleCronSuccess
  | { ok: false; reason: string };

export type EnqueueBriefingScheduleCronDeps = {
  listEligibleOrganizations?: typeof listEligibleBriefingOrganizations;
  enqueueScheduleJob?: typeof enqueueBriefingScheduleJob;
};

export async function enqueueBriefingScheduleForCron(
  args: {
    slot: BriefingSlot;
    triggeredByUserId: string;
    now?: Date;
    dryRun?: boolean;
    organizationId?: string;
  },
  deps: EnqueueBriefingScheduleCronDeps = {},
): Promise<EnqueueBriefingScheduleCronResult> {
  if (!isBriefingAutomationEnabled()) {
    return { ok: false, reason: "briefing_automation_disabled" };
  }

  const listEligibleOrganizations =
    deps.listEligibleOrganizations ?? listEligibleBriefingOrganizations;
  const enqueueScheduleJob = deps.enqueueScheduleJob ?? enqueueBriefingScheduleJob;

  const eligibleOrgs = await listEligibleOrganizations(
    args.organizationId ? { organizationId: args.organizationId } : undefined,
  );

  return enqueueBriefingScheduleForEligibleOrgs({
    slot: args.slot,
    triggeredByUserId: args.triggeredByUserId,
    now: args.now,
    dryRun: args.dryRun,
    eligibleOrgs,
    enqueueScheduleJob,
  });
}

export async function enqueueBriefingScheduleForEligibleOrgs(args: {
  slot: BriefingSlot;
  triggeredByUserId: string;
  now?: Date;
  dryRun?: boolean;
  eligibleOrgs: EligibleBriefingOrganization[];
  enqueueScheduleJob: typeof enqueueBriefingScheduleJob;
}): Promise<EnqueueBriefingScheduleCronSuccess> {
  let enqueued = 0;
  let alreadyQueued = 0;
  let skipped = 0;
  const results: BriefingScheduleCronOrgResult[] = [];

  for (const org of args.eligibleOrgs) {
    if (!isBriefingSlotEnabled(org.settings, args.slot)) {
      skipped += 1;
      results.push({ organizationId: org.organizationId, reason: "slot_disabled" });
      continue;
    }

    if (args.dryRun) {
      results.push({ organizationId: org.organizationId, reason: "dry_run" });
      continue;
    }

    const enqueueResult = await args.enqueueScheduleJob({
      organizationId: org.organizationId,
      slot: args.slot,
      triggeredByUserId: args.triggeredByUserId,
      triggerSource: "CRON",
      now: args.now,
    });

    if (enqueueResult.created) {
      enqueued += 1;
    } else {
      alreadyQueued += 1;
    }

    results.push({
      organizationId: org.organizationId,
      jobId: enqueueResult.jobId,
      created: enqueueResult.created,
    });
  }

  return {
    ok: true,
    slot: args.slot,
    organizationsConsidered: args.eligibleOrgs.length,
    enqueued,
    alreadyQueued,
    skipped,
    results,
  };
}
