import type { BriefingSlot } from "@prisma/client";
import { auditBriefingScheduleEnqueued } from "@/lib/briefing/briefing-audit";
import {
  isBriefingSlotEnabled,
  listEligibleBriefingOrganizations,
} from "@/lib/briefing/briefing-gates";
import { calculateBriefingWindow } from "@/lib/briefing/briefing-window";
import { enqueueBriefingGenerateJob } from "@/lib/briefing/enqueue-briefing-generate";
import {
  enqueueScheduledGmailSyncForBriefing,
  getBriefingGenerateDelayAfterSync,
} from "@/lib/briefing/enqueue-scheduled-gmail-sync";
import {
  parseBriefingSchedulePayload,
  parseOptionalIsoDateFromPayload,
} from "@/lib/jobs/handlers/briefing-payloads";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

function resolveTargetOrganizationId(args: {
  jobOrganizationId: string;
  payloadOrganizationId?: string;
}): string {
  return args.payloadOrganizationId ?? args.jobOrganizationId;
}

export const handleBriefingSchedule: JobHandler = async (ctx) => {
  const payload = parseBriefingSchedulePayload(ctx.job.payload);
  const actorUserId = getJobProcessorActorUserId(ctx.job.triggeredByUserId);

  if (!payload.slot) {
    throw new Error('briefing.schedule requires payload.slot "MORNING" or "AFTERNOON".');
  }

  const now = parseOptionalIsoDateFromPayload(payload.nowIso) ?? new Date();
  const targetOrganizationId = resolveTargetOrganizationId({
    jobOrganizationId: ctx.job.organizationId,
    payloadOrganizationId: payload.organizationId,
  });

  const eligibleOrgs = await listEligibleBriefingOrganizations({
    organizationId: targetOrganizationId,
  });

  const scheduled: Array<{
    organizationId: string;
    slot: BriefingSlot;
    generateJobId?: string;
    syncJobsEnqueued: number;
    skippedReason?: string;
  }> = [];

  for (const org of eligibleOrgs) {
    if (!isBriefingSlotEnabled(org.settings, payload.slot)) {
      scheduled.push({
        organizationId: org.organizationId,
        slot: payload.slot,
        syncJobsEnqueued: 0,
        skippedReason: "slot_disabled",
      });
      continue;
    }

    const window = calculateBriefingWindow({
      now,
      lookbackHours: org.settings.lookbackHours,
    });

    if (payload.dryRun) {
      scheduled.push({
        organizationId: org.organizationId,
        slot: payload.slot,
        syncJobsEnqueued: 0,
      });
      continue;
    }

    let syncJobsEnqueued = 0;
    let scheduledAt: Date | undefined;

    if (org.settings.autoSyncBeforeBriefing) {
      const syncResult = await enqueueScheduledGmailSyncForBriefing({
        organizationId: org.organizationId,
        actorUserId,
      });
      syncJobsEnqueued = syncResult.enqueued;
      scheduledAt = new Date(Date.now() + getBriefingGenerateDelayAfterSync());
    }

    const generateEnqueue = await enqueueBriefingGenerateJob({
      organizationId: org.organizationId,
      slot: payload.slot,
      windowEnd: window.windowEnd,
      windowStartIso: window.windowStart.toISOString(),
      windowEndIso: window.windowEnd.toISOString(),
      triggeredByUserId: actorUserId,
      triggerSource: "SYSTEM",
      scheduledAt,
    });

    await auditBriefingScheduleEnqueued({
      organizationId: org.organizationId,
      actorUserId,
      slot: payload.slot,
      generateJobId: generateEnqueue.jobId,
      syncJobsEnqueued,
    });

    scheduled.push({
      organizationId: org.organizationId,
      slot: payload.slot,
      generateJobId: generateEnqueue.jobId,
      syncJobsEnqueued,
    });
  }

  return {
    metadata: {
      slot: payload.slot,
      dryRun: payload.dryRun ?? false,
      organizationsConsidered: eligibleOrgs.length,
      scheduled,
    },
  };
};
