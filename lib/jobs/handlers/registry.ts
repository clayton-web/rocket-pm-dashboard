import { handleGmailSync } from "@/lib/jobs/handlers/gmail-sync";
import { handleSystemNoop } from "@/lib/jobs/handlers/noop";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { JOB_TYPES } from "@/lib/jobs/types";

const HANDLERS: Record<string, JobHandler> = {
  [JOB_TYPES.SYSTEM_NOOP]: handleSystemNoop,
  [JOB_TYPES.GMAIL_SYNC]: handleGmailSync,
};

export function getJobHandler(jobType: string): JobHandler | null {
  return HANDLERS[jobType] ?? null;
}

export function listRegisteredJobTypes(): string[] {
  return Object.keys(HANDLERS);
}
