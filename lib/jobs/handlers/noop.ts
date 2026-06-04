import type { JobHandler } from "@/lib/jobs/handlers/types";

/** Phase 0 health/framework handler — no side effects. */
export const handleSystemNoop: JobHandler = async (ctx) => {
  const payload = ctx.job.payload;
  return {
    metadata: {
      noop: true,
      payload: payload && typeof payload === "object" ? payload : null,
    },
  };
};
