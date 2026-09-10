import { BRIEFING_DECOMMISSIONED_REASON } from "@/lib/jobs/policy";
import type { JobHandler } from "@/lib/jobs/handlers/types";

/**
 * briefing.generate is decommissioned (P0-C).
 * Stale queued jobs complete without Gemini, persistence, or email.
 */
export const handleBriefingGenerate: JobHandler = async () => {
  return {
    metadata: {
      skippedReason: BRIEFING_DECOMMISSIONED_REASON,
      decommissioned: true,
    },
  };
};
