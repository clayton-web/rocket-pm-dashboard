import { handleSystemNoop } from "@/lib/jobs/handlers/noop";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { JOB_TYPES } from "@/lib/jobs/types";

const HANDLERS: Record<string, JobHandler> = {
  [JOB_TYPES.SYSTEM_NOOP]: handleSystemNoop,
};

export function getJobHandler(jobType: string): JobHandler | null {
  return HANDLERS[jobType] ?? null;
}

export function listRegisteredJobTypes(): string[] {
  return Object.keys(HANDLERS);
}
