import { BRIEFING_SCHEDULE_DECOMMISSIONED_REASON } from "@/lib/jobs/policy";
import type { JobHandler } from "@/lib/jobs/handlers/types";

/**
 * Automated briefing.schedule is decommissioned (P0-B).
 * Stale queued jobs complete without enqueueing briefing.generate.
 * briefing.generate is separately decommissioned (P0-C).
 */
export const handleBriefingSchedule: JobHandler = async () => {
  return {
    metadata: {
      skippedReason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
      decommissioned: true,
    },
  };
};
