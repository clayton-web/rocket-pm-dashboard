import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

type JobAuditMetadata = Prisma.InputJsonValue;

export async function auditJobEnqueued(args: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  jobType: string;
  idempotencyKey: string;
  triggerSource: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "job.enqueued",
      resourceType: "BackgroundJob",
      resourceId: args.jobId,
      metadata: {
        jobType: args.jobType,
        idempotencyKey: args.idempotencyKey,
        triggerSource: args.triggerSource,
      } satisfies JobAuditMetadata,
    },
  });
}

export async function auditJobCompleted(args: {
  organizationId: string;
  triggeredByUserId: string | null | undefined;
  jobId: string;
  jobType: string;
  metadata?: JobAuditMetadata;
}): Promise<void> {
  const actorUserId = getJobProcessorActorUserId(args.triggeredByUserId);
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId,
      action: "job.completed",
      resourceType: "BackgroundJob",
      resourceId: args.jobId,
      metadata: {
        jobType: args.jobType,
        ...(args.metadata && typeof args.metadata === "object" ? args.metadata : {}),
      } satisfies JobAuditMetadata,
    },
  });
}

export async function auditJobFailed(args: {
  organizationId: string;
  triggeredByUserId: string | null | undefined;
  jobId: string;
  jobType: string;
  errorMessage: string;
  willRetry: boolean;
}): Promise<void> {
  const actorUserId = getJobProcessorActorUserId(args.triggeredByUserId);
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId,
      action: "job.failed",
      resourceType: "BackgroundJob",
      resourceId: args.jobId,
      metadata: {
        jobType: args.jobType,
        errorMessage: args.errorMessage.slice(0, 500),
        willRetry: args.willRetry,
      } satisfies JobAuditMetadata,
    },
  });
}
