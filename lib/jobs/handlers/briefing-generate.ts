import { runBriefingGenerate } from "@/lib/briefing/run-briefing-generate";
import {
  parseBriefingGeneratePayload,
  parseOptionalIsoDateFromPayload,
} from "@/lib/jobs/handlers/briefing-payloads";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

export const handleBriefingGenerate: JobHandler = async (ctx) => {
  const payload = parseBriefingGeneratePayload(ctx.job.payload);
  const organizationId = payload.organizationId ?? ctx.job.organizationId;
  const actorUserId = getJobProcessorActorUserId(ctx.job.triggeredByUserId);

  const windowStart = parseOptionalIsoDateFromPayload(payload.windowStartIso) ?? undefined;
  const windowEnd = parseOptionalIsoDateFromPayload(payload.windowEndIso) ?? undefined;

  const result = await runBriefingGenerate({
    organizationId,
    slot: payload.slot,
    backgroundJobId: ctx.job.id,
    triggeredByUserId: actorUserId,
    windowStart,
    windowEnd,
    force: payload.force,
    dryRun: payload.dryRun,
  });

  if (result.status === "failed") {
    throw new Error(result.errorMessage);
  }

  return {
    metadata: {
      organizationId,
      slot: payload.slot,
      ...result,
    },
  };
};
