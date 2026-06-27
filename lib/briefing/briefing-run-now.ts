import type { BriefingSlot } from "@prisma/client";
import { calculateBriefingWindow } from "@/lib/briefing/briefing-window";
import { enqueueBriefingGenerateJob } from "@/lib/briefing/enqueue-briefing-generate";
import { JOB_TYPES } from "@/lib/jobs/types";

export type ManualBriefingGenerateEnqueueInput = {
  organizationId: string;
  slot: BriefingSlot;
  windowStartIso: string;
  windowEndIso: string;
  windowEnd: Date;
  triggeredByUserId: string;
  triggerSource: "USER";
  force: true;
};

export function buildManualBriefingGenerateEnqueueInput(args: {
  organizationId: string;
  slot: BriefingSlot;
  lookbackHours: number;
  lastCompletedRunWindowEnd: Date | null;
  triggeredByUserId: string;
  now?: Date;
}): ManualBriefingGenerateEnqueueInput {
  const window = calculateBriefingWindow({
    now: args.now ?? new Date(),
    lookbackHours: args.lookbackHours,
    lastCompletedRun: args.lastCompletedRunWindowEnd
      ? { windowEnd: args.lastCompletedRunWindowEnd }
      : null,
  });

  return {
    organizationId: args.organizationId,
    slot: args.slot,
    windowEnd: window.windowEnd,
    windowStartIso: window.windowStart.toISOString(),
    windowEndIso: window.windowEnd.toISOString(),
    triggeredByUserId: args.triggeredByUserId,
    triggerSource: "USER",
    force: true,
  };
}

export async function enqueueManualBriefingGenerate(args: ManualBriefingGenerateEnqueueInput) {
  return enqueueBriefingGenerateJob(args);
}

export const MANUAL_BRIEFING_GENERATE_JOB_TYPE = JOB_TYPES.BRIEFING_GENERATE;
