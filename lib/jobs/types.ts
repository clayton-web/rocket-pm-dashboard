/**
 * Registered background job types.
 * Phase 1: system.noop + gmail.sync (production Gmail sync workload).
 * Future: agent.triage, agent.draft.generate (blocked until automation enabled).
 */
export const JOB_TYPES = {
  SYSTEM_NOOP: "system.noop",
  GMAIL_SYNC: "gmail.sync",
  AGENT_TRIAGE: "agent.triage",
  AGENT_DRAFT_GENERATE: "agent.draft.generate",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** @deprecated Use PHASE1_ALLOWED_JOB_TYPES */
export const PHASE0_ALLOWED_JOB_TYPES: ReadonlySet<string> = new Set([
  JOB_TYPES.SYSTEM_NOOP,
  JOB_TYPES.GMAIL_SYNC,
]);

export const PHASE1_ALLOWED_JOB_TYPES: ReadonlySet<string> = PHASE0_ALLOWED_JOB_TYPES;

export function isAgentJobType(jobType: string): boolean {
  return jobType.startsWith("agent.");
}

export type EnqueueJobInput = {
  organizationId: string;
  jobType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown> | null;
  triggerSource: "USER" | "CRON" | "SYSTEM";
  triggeredByUserId?: string | null;
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
};

export type ProcessJobsResult = {
  claimed: number;
  completed: number;
  failed: number;
  retried: number;
  errors: Array<{ jobId: string; message: string }>;
};
