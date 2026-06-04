import { isAgentJobType, PHASE0_ALLOWED_JOB_TYPES } from "@/lib/jobs/types";

/**
 * When false (default), agent.* jobs cannot be enqueued or processed.
 * Does not affect system.noop or future gmail.sync.
 */
export function isAgentAutomationEnabled(): boolean {
  const raw = process.env.AGENT_AUTOMATION_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function assertJobTypeAllowedForPhase(jobType: string): void {
  if (isAgentJobType(jobType) && !isAgentAutomationEnabled()) {
    throw new Error(
      `Job type "${jobType}" is blocked: AGENT_AUTOMATION_ENABLED is not true.`,
    );
  }

  if (!PHASE0_ALLOWED_JOB_TYPES.has(jobType)) {
    throw new Error(
      `Job type "${jobType}" is not enabled in Phase 0. Allowed: ${[...PHASE0_ALLOWED_JOB_TYPES].join(", ")}.`,
    );
  }
}

export function getJobProcessorSecret(): string | null {
  const secret =
    process.env.JOB_PROCESSOR_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function verifyJobProcessorRequest(request: Request): boolean {
  const secret = getJobProcessorSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7) === secret;
  }

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  return false;
}

/**
 * Actor for AuditLog when the job has no triggeredByUserId (e.g. cron drain).
 * Must be a valid User.id in the database.
 */
export function getJobProcessorActorUserId(jobTriggeredByUserId: string | null | undefined): string {
  if (jobTriggeredByUserId) return jobTriggeredByUserId;

  const fromEnv = process.env.JOB_PROCESSOR_ACTOR_USER_ID?.trim();
  if (fromEnv) return fromEnv;

  throw new Error(
    "JOB_PROCESSOR_ACTOR_USER_ID is required to write job audit logs when triggeredByUserId is unset.",
  );
}
