import { handleAgentTriage } from "@/lib/jobs/handlers/agent-triage";
import { handleBriefingGenerate } from "@/lib/jobs/handlers/briefing-generate";
import { handleBriefingSchedule } from "@/lib/jobs/handlers/briefing-schedule";
import { handleGmailSync } from "@/lib/jobs/handlers/gmail-sync";
import { handleSystemNoop } from "@/lib/jobs/handlers/noop";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { JOB_TYPES } from "@/lib/jobs/types";

const HANDLERS: Record<string, JobHandler> = {
  [JOB_TYPES.SYSTEM_NOOP]: handleSystemNoop,
  [JOB_TYPES.GMAIL_SYNC]: handleGmailSync,
  [JOB_TYPES.AGENT_TRIAGE]: handleAgentTriage,
  [JOB_TYPES.BRIEFING_SCHEDULE]: handleBriefingSchedule,
  [JOB_TYPES.BRIEFING_GENERATE]: handleBriefingGenerate,
};

export function getJobHandler(jobType: string): JobHandler | null {
  return HANDLERS[jobType] ?? null;
}

export function listRegisteredJobTypes(): string[] {
  return Object.keys(HANDLERS);
}
