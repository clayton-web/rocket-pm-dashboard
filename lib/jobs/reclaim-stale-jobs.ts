import type { BackgroundJob, BackgroundJobStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { JOB_TYPES } from "@/lib/jobs/types";

export const STALE_RUNNING_MS = 3 * 60 * 1000;
export const STALE_PENDING_MS = 15 * 60 * 1000;

export const RECLAIM_REASON = {
  STALE_RUNNING: "stale_running_lease",
  STALE_PENDING: "stale_pending_unclaimed",
} as const;

export type ReclaimedJob = {
  jobId: string;
  previousStatus: BackgroundJobStatus;
  reason: string;
};

export type ReclaimStaleGmailSyncJobsArgs = {
  organizationId?: string;
  connectedAccountId?: string;
  now?: Date;
};

type ReclaimDbClient = Pick<typeof prisma, "backgroundJob" | "$transaction">;

function getConnectedAccountIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { connectedAccountId?: unknown }).connectedAccountId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function getStaleGmailSyncReclaimReason(
  job: Pick<BackgroundJob, "status" | "lockedAt" | "createdAt">,
  now: Date,
): string | null {
  if (job.status === "RUNNING") {
    if (job.lockedAt == null) return null;
    const runningCutoff = new Date(now.getTime() - STALE_RUNNING_MS);
    return job.lockedAt < runningCutoff ? RECLAIM_REASON.STALE_RUNNING : null;
  }

  if (job.status === "PENDING") {
    const pendingCutoff = new Date(now.getTime() - STALE_PENDING_MS);
    return job.createdAt < pendingCutoff ? RECLAIM_REASON.STALE_PENDING : null;
  }

  return null;
}

function shouldReclaimGmailSyncJob(
  job: BackgroundJob,
  args: ReclaimStaleGmailSyncJobsArgs,
  now: Date,
): string | null {
  if (job.jobType !== JOB_TYPES.GMAIL_SYNC) return null;
  if (job.status !== "PENDING" && job.status !== "RUNNING") return null;

  if (args.connectedAccountId) {
    const accountId = getConnectedAccountIdFromPayload(job.payload);
    if (accountId !== args.connectedAccountId) return null;
  }

  return getStaleGmailSyncReclaimReason(job, now);
}

export async function reclaimStaleGmailSyncJobs(
  args: ReclaimStaleGmailSyncJobsArgs,
  db: ReclaimDbClient = prisma,
): Promise<{ reclaimed: ReclaimedJob[] }> {
  const now = args.now ?? new Date();

  const candidates = await db.backgroundJob.findMany({
    where: {
      jobType: JOB_TYPES.GMAIL_SYNC,
      status: { in: ["PENDING", "RUNNING"] },
      ...(args.organizationId ? { organizationId: args.organizationId } : {}),
    },
  });

  const toReclaim = candidates
    .map((job) => {
      const reason = shouldReclaimGmailSyncJob(job, args, now);
      return reason ? { job, reason } : null;
    })
    .filter((entry): entry is { job: BackgroundJob; reason: string } => entry != null);

  if (toReclaim.length === 0) {
    return { reclaimed: [] };
  }

  const reclaimed: ReclaimedJob[] = [];

  await db.$transaction(async (tx) => {
    for (const { job, reason } of toReclaim) {
      const previousStatus = job.status;
      const result = await tx.backgroundJob.updateMany({
        where: {
          id: job.id,
          status: { in: ["PENDING", "RUNNING"] },
        },
        data: {
          status: "CANCELLED",
          lockedAt: null,
          lockedBy: null,
          completedAt: now,
          lastError: reason,
        },
      });

      if (result.count > 0) {
        reclaimed.push({
          jobId: job.id,
          previousStatus,
          reason,
        });
      }
    }
  });

  return { reclaimed };
}
