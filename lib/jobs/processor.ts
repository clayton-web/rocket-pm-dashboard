import { hostname } from "node:os";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { auditJobCompleted, auditJobFailed } from "@/lib/jobs/audit";
import { claimPendingJobs } from "@/lib/jobs/claim";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import { assertJobTypeAllowedForPhase } from "@/lib/jobs/policy";
import type { ProcessJobsResult } from "@/lib/jobs/types";

const RETRY_DELAY_MS = 60_000;

function buildWorkerId(): string {
  const host = hostname();
  return `${host}-${process.pid}`;
}

export async function processClaimedJobs(args?: { limit?: number }): Promise<ProcessJobsResult> {
  const workerId = buildWorkerId();
  const jobs = await claimPendingJobs({ limit: args?.limit, workerId });

  const result: ProcessJobsResult = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    retried: 0,
    errors: [],
  };

  for (const job of jobs) {
    try {
      assertJobTypeAllowedForPhase(job.jobType);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job type not allowed.";
      await markJobFailed(job, message, result, false);
      continue;
    }

    const handler = getJobHandler(job.jobType);
    if (!handler) {
      await markJobFailed(job, `No handler registered for job type: ${job.jobType}`, result, false);
      continue;
    }

    try {
      const handlerResult = await handler({ job, workerId });
      await prismaBackgroundJobCompleted(job);
      await auditJobCompleted({
        organizationId: job.organizationId,
        triggeredByUserId: job.triggeredByUserId,
        jobId: job.id,
        jobType: job.jobType,
        metadata: handlerResult.metadata as Prisma.InputJsonValue | undefined,
      });
      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job handler failed.";
      const willRetry = job.attempts + 1 < job.maxAttempts;
      await markJobFailed(job, message, result, willRetry);
    }
  }

  return result;
}

async function prismaBackgroundJobCompleted(job: { id: string }): Promise<void> {
  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

async function markJobFailed(
  job: {
    id: string;
    organizationId: string;
    jobType: string;
    triggeredByUserId: string | null;
    attempts: number;
    maxAttempts: number;
  },
  message: string,
  result: ProcessJobsResult,
  willRetry: boolean,
): Promise<void> {
  const nextAttempts = job.attempts + 1;

  if (willRetry) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        attempts: nextAttempts,
        lastError: message.slice(0, 2000),
        lockedAt: null,
        lockedBy: null,
        scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
      },
    });
    result.retried += 1;
  } else {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attempts: nextAttempts,
        lastError: message.slice(0, 2000),
        lockedAt: null,
        lockedBy: null,
        completedAt: new Date(),
      },
    });
    result.failed += 1;
  }

  result.errors.push({ jobId: job.id, message });

  await auditJobFailed({
    organizationId: job.organizationId,
    triggeredByUserId: job.triggeredByUserId,
    jobId: job.id,
    jobType: job.jobType,
    errorMessage: message,
    willRetry,
  });
}
