import { isAgentJobType, JOB_TYPES, PHASE1_ALLOWED_JOB_TYPES } from "@/lib/jobs/types";

export const BRIEFING_SCHEDULE_DECOMMISSIONED_REASON = "briefing_schedule_decommissioned";

export const BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE =
  "Automated Daily Briefing scheduling is decommissioned.";

export const BRIEFING_DECOMMISSIONED_REASON = "briefing_decommissioned";

export const BRIEFING_DECOMMISSIONED_MESSAGE = "Daily Briefing is decommissioned.";

export function briefingDecommissionedActionResult(): {
  ok: false;
  error: string;
  reason: string;
} {
  return {
    ok: false,
    error: BRIEFING_DECOMMISSIONED_MESSAGE,
    reason: BRIEFING_DECOMMISSIONED_REASON,
  };
}

/**
 * When false (default), agent.* jobs cannot be enqueued or processed.
 * Does not affect system.noop or gmail.sync.
 */
export function isAgentAutomationEnabled(): boolean {
  const raw = process.env.AGENT_AUTOMATION_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Legacy env reader used by leftover Briefing library gates.
 * Cannot revive briefing.schedule or briefing.generate after P0-C.
 */
export function isBriefingAutomationEnabled(): boolean {
  const raw = process.env.BRIEFING_AUTOMATION_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Automated briefing.schedule is permanently off.
 * BRIEFING_AUTOMATION_ENABLED cannot re-enable it.
 */
export function isAutomatedBriefingScheduleEnabled(): boolean {
  return false;
}

/** Manual and automated Daily Briefing execution is permanently off. */
export function isBriefingExecutionEnabled(): boolean {
  return false;
}

export function assertJobTypeAllowedForPhase(jobType: string): void {
  if (jobType === JOB_TYPES.BRIEFING_SCHEDULE) {
    throw new Error(
      `Job type "${jobType}" is decommissioned: ${BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE}`,
    );
  }

  if (jobType === JOB_TYPES.BRIEFING_GENERATE) {
    throw new Error(
      `Job type "${jobType}" is decommissioned: ${BRIEFING_DECOMMISSIONED_MESSAGE}`,
    );
  }

  if (isAgentJobType(jobType) && !isAgentAutomationEnabled()) {
    throw new Error(
      `Job type "${jobType}" is blocked: AGENT_AUTOMATION_ENABLED is not true.`,
    );
  }

  if (!PHASE1_ALLOWED_JOB_TYPES.has(jobType)) {
    throw new Error(
      `Job type "${jobType}" is not enabled. Allowed: ${[...PHASE1_ALLOWED_JOB_TYPES].join(", ")}.`,
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
