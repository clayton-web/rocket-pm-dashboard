import type { BackgroundJob, BackgroundJobStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { enqueueGmailSyncJob } from "@/lib/gmail/enqueue-gmail-sync";
import { reclaimStaleGmailSyncJobs } from "@/lib/jobs/reclaim-stale-jobs";
import { JOB_TYPES } from "@/lib/jobs/types";

export const USER_RESTART_MS = 5 * 60 * 1000;
export const USER_RESTART_REASON = "user_restart";

export type ActiveGmailSyncJob = {
  jobId: string;
  connectedAccountId: string;
  status: Extract<BackgroundJobStatus, "PENDING" | "RUNNING">;
  startedAt: Date;
};

export type RestartGmailSyncResult =
  | {
      restarted: true;
      jobId: string;
      created: boolean;
      cancelledJobIds: string[];
    }
  | {
      restarted: false;
      reason: "still_running";
      jobId: string;
    };

type RestartDbClient = Pick<typeof prisma, "backgroundJob" | "$transaction">;

type RestartGmailSyncDeps = {
  db?: RestartDbClient;
  enqueue?: typeof enqueueGmailSyncJob;
};

function getRestartDb(deps?: RestartGmailSyncDeps): RestartDbClient {
  return deps?.db ?? prisma;
}

function getConnectedAccountIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { connectedAccountId?: unknown }).connectedAccountId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function getGmailSyncJobStartedAt(
  job: Pick<BackgroundJob, "status" | "lockedAt" | "createdAt">,
): Date {
  if (job.status === "RUNNING" && job.lockedAt != null) {
    return job.lockedAt;
  }
  return job.createdAt;
}

export function isGmailSyncJobRestartEligible(
  job: Pick<BackgroundJob, "status" | "lockedAt" | "createdAt">,
  now: Date = new Date(),
): boolean {
  const startedAt = getGmailSyncJobStartedAt(job);
  return now.getTime() - startedAt.getTime() >= USER_RESTART_MS;
}

export async function getActiveGmailSyncJobsByMailbox(
  args: {
    organizationId: string;
    connectedAccountIds: string[];
  },
  deps?: RestartGmailSyncDeps,
): Promise<Map<string, ActiveGmailSyncJob>> {
  if (args.connectedAccountIds.length === 0) return new Map();

  const db = getRestartDb(deps);

  await reclaimStaleGmailSyncJobs(
    {
      organizationId: args.organizationId,
    },
    db,
  );

  const jobs = await db.backgroundJob.findMany({
    where: {
      organizationId: args.organizationId,
      jobType: JOB_TYPES.GMAIL_SYNC,
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: {
      id: true,
      status: true,
      payload: true,
      lockedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const allowed = new Set(args.connectedAccountIds);
  const byMailbox = new Map<string, ActiveGmailSyncJob>();

  for (const job of jobs) {
    const connectedAccountId = getConnectedAccountIdFromPayload(job.payload);
    if (!connectedAccountId || !allowed.has(connectedAccountId)) continue;
    if (byMailbox.has(connectedAccountId)) continue;
    if (job.status !== "PENDING" && job.status !== "RUNNING") continue;

    byMailbox.set(connectedAccountId, {
      jobId: job.id,
      connectedAccountId,
      status: job.status,
      startedAt: getGmailSyncJobStartedAt(job),
    });
  }

  return byMailbox;
}

async function cancelRestartEligibleGmailSyncJobs(
  args: {
    organizationId: string;
    connectedAccountId: string;
    now?: Date;
  },
  deps?: RestartGmailSyncDeps,
): Promise<string[]> {
  const now = args.now ?? new Date();
  const db = getRestartDb(deps);

  const activeJobs = await db.backgroundJob.findMany({
    where: {
      organizationId: args.organizationId,
      jobType: JOB_TYPES.GMAIL_SYNC,
      status: { in: ["PENDING", "RUNNING"] },
      payload: {
        path: ["connectedAccountId"],
        equals: args.connectedAccountId,
      },
    },
  });

  const toCancel = activeJobs.filter((job) => isGmailSyncJobRestartEligible(job, now));
  if (toCancel.length === 0) return [];

  const cancelledJobIds: string[] = [];

  await db.$transaction(async (tx) => {
    for (const job of toCancel) {
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
          lastError: USER_RESTART_REASON,
        },
      });

      if (result.count > 0) {
        cancelledJobIds.push(job.id);
      }
    }
  });

  return cancelledJobIds;
}

export async function restartGmailSyncJob(
  args: {
    organizationId: string;
    connectedAccountId: string;
    triggeredByUserId: string;
  },
  deps?: RestartGmailSyncDeps,
): Promise<RestartGmailSyncResult> {
  const db = getRestartDb(deps);
  const enqueue = deps?.enqueue ?? enqueueGmailSyncJob;

  await reclaimStaleGmailSyncJobs(
    {
      organizationId: args.organizationId,
      connectedAccountId: args.connectedAccountId,
    },
    db,
  );

  const cancelledJobIds = await cancelRestartEligibleGmailSyncJobs(
    {
      organizationId: args.organizationId,
      connectedAccountId: args.connectedAccountId,
    },
    deps,
  );

  const remainingActive = await db.backgroundJob.findFirst({
    where: {
      organizationId: args.organizationId,
      jobType: JOB_TYPES.GMAIL_SYNC,
      status: { in: ["PENDING", "RUNNING"] },
      payload: {
        path: ["connectedAccountId"],
        equals: args.connectedAccountId,
      },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (remainingActive) {
    return {
      restarted: false,
      reason: "still_running",
      jobId: remainingActive.id,
    };
  }

  const enqueueResult = await enqueue({
    organizationId: args.organizationId,
    connectedAccountId: args.connectedAccountId,
    triggeredByUserId: args.triggeredByUserId,
  });

  return {
    restarted: true,
    jobId: enqueueResult.jobId,
    created: enqueueResult.created,
    cancelledJobIds,
  };
}
