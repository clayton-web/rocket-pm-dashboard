import { randomUUID } from "node:crypto";
import prisma from "@/lib/db/prisma";
import { auditGmailSyncEnqueued } from "@/lib/gmail/gmail-sync-audit";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { reclaimStaleGmailSyncJobs } from "@/lib/jobs/reclaim-stale-jobs";
import { JOB_TYPES } from "@/lib/jobs/types";

export type EnqueueGmailSyncResult = {
  jobId: string;
  created: boolean;
  alreadyQueued: boolean;
};

export async function enqueueGmailSyncJob(args: {
  organizationId: string;
  connectedAccountId: string;
  triggeredByUserId: string;
  triggerSource?: "USER" | "CRON" | "SYSTEM";
}): Promise<EnqueueGmailSyncResult> {
  const triggerSource = args.triggerSource ?? "USER";

  await reclaimStaleGmailSyncJobs({
    organizationId: args.organizationId,
    connectedAccountId: args.connectedAccountId,
  });

  const activeJob = await prisma.backgroundJob.findFirst({
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

  if (activeJob) {
    return { jobId: activeJob.id, created: false, alreadyQueued: true };
  }

  const { jobId, created } = await enqueueJob({
    organizationId: args.organizationId,
    jobType: JOB_TYPES.GMAIL_SYNC,
    idempotencyKey: `gmail-sync:${args.connectedAccountId}:${randomUUID()}`,
    payload: { connectedAccountId: args.connectedAccountId },
    triggerSource,
    triggeredByUserId: args.triggeredByUserId,
    priority: 10,
  });

  await auditGmailSyncEnqueued({
    organizationId: args.organizationId,
    actorUserId: args.triggeredByUserId,
    connectedAccountId: args.connectedAccountId,
    jobId,
    created,
  });

  return { jobId, created, alreadyQueued: false };
}

export async function getActiveGmailSyncAccountIds(args: {
  organizationId: string;
  connectedAccountIds: string[];
}): Promise<Set<string>> {
  if (args.connectedAccountIds.length === 0) return new Set();

  await reclaimStaleGmailSyncJobs({
    organizationId: args.organizationId,
  });

  const jobs = await prisma.backgroundJob.findMany({
    where: {
      organizationId: args.organizationId,
      jobType: JOB_TYPES.GMAIL_SYNC,
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { payload: true },
  });

  const active = new Set<string>();
  const allowed = new Set(args.connectedAccountIds);

  for (const job of jobs) {
    const payload = job.payload;
    if (!payload || typeof payload !== "object") continue;
    const accountId = (payload as { connectedAccountId?: unknown }).connectedAccountId;
    if (typeof accountId === "string" && allowed.has(accountId)) {
      active.add(accountId);
    }
  }

  return active;
}
