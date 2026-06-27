import type { BriefingSlot } from "@prisma/client";
import { buildBriefingScheduleIdempotencyKey } from "@/lib/briefing/briefing-idempotency";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { JOB_TYPES } from "@/lib/jobs/types";

export type EnqueueBriefingScheduleResult = {
  jobId: string;
  created: boolean;
};

export async function enqueueBriefingScheduleJob(args: {
  organizationId: string;
  slot: BriefingSlot;
  triggeredByUserId: string;
  triggerSource?: "USER" | "CRON" | "SYSTEM";
  now?: Date;
  dryRun?: boolean;
}): Promise<EnqueueBriefingScheduleResult> {
  const triggerSource = args.triggerSource ?? "CRON";
  const scheduleDate = args.now ?? new Date();

  const { jobId, created } = await enqueueJob({
    organizationId: args.organizationId,
    jobType: JOB_TYPES.BRIEFING_SCHEDULE,
    idempotencyKey: buildBriefingScheduleIdempotencyKey({
      organizationId: args.organizationId,
      slot: args.slot,
      scheduleDate,
    }),
    payload: {
      organizationId: args.organizationId,
      slot: args.slot,
      nowIso: scheduleDate.toISOString(),
      dryRun: args.dryRun ?? false,
    },
    triggerSource,
    triggeredByUserId: args.triggeredByUserId,
    priority: 7,
  });

  return { jobId, created };
}
