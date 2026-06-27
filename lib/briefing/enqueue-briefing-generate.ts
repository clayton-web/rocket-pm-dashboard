import type { BriefingSlot } from "@prisma/client";
import { buildBriefingGenerateIdempotencyKey } from "@/lib/briefing/briefing-idempotency";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { JOB_TYPES } from "@/lib/jobs/types";

export type EnqueueBriefingGenerateResult = {
  jobId: string;
  created: boolean;
};

export async function enqueueBriefingGenerateJob(args: {
  organizationId: string;
  slot: BriefingSlot;
  windowEnd: Date;
  triggeredByUserId: string;
  triggerSource?: "USER" | "CRON" | "SYSTEM";
  windowStartIso?: string;
  windowEndIso?: string;
  force?: boolean;
  dryRun?: boolean;
  scheduledAt?: Date;
}): Promise<EnqueueBriefingGenerateResult> {
  const triggerSource = args.triggerSource ?? "SYSTEM";

  const { jobId, created } = await enqueueJob({
    organizationId: args.organizationId,
    jobType: JOB_TYPES.BRIEFING_GENERATE,
    idempotencyKey: buildBriefingGenerateIdempotencyKey({
      organizationId: args.organizationId,
      slot: args.slot,
      windowEnd: args.windowEnd,
    }),
    payload: {
      organizationId: args.organizationId,
      slot: args.slot,
      windowStartIso: args.windowStartIso,
      windowEndIso: args.windowEndIso ?? args.windowEnd.toISOString(),
      force: args.force ?? false,
      dryRun: args.dryRun ?? false,
    },
    triggerSource,
    triggeredByUserId: args.triggeredByUserId,
    priority: 8,
    scheduledAt: args.scheduledAt,
  });

  return { jobId, created };
}
