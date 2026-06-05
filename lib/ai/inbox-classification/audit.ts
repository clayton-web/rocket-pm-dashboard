import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

type AuditMetadata = Prisma.InputJsonValue;

export async function auditInboxClassificationEnqueued(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  jobId: string;
  threadCount: number;
  parentJobId?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "inbox.classification.enqueued",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        jobId: args.jobId,
        threadCount: args.threadCount,
        ...(args.parentJobId ? { parentJobId: args.parentJobId } : {}),
      } satisfies AuditMetadata,
    },
  });
}

export async function auditInboxClassificationCompleted(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  jobId: string;
  classified: number;
  lowConfidence: number;
  skipped: number;
  failed: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "inbox.classification.completed",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        jobId: args.jobId,
        classified: args.classified,
        lowConfidence: args.lowConfidence,
        skipped: args.skipped,
        failed: args.failed,
      } satisfies AuditMetadata,
    },
  });
}

export async function auditInboxThreadClassified(args: {
  organizationId: string;
  actorUserId: string;
  threadId: string;
  category: string;
  confidence: number;
  reason: string;
  jobId: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "inbox.thread.classified",
      resourceType: "EmailThread",
      resourceId: args.threadId,
      metadata: {
        category: args.category,
        confidence: args.confidence,
        reason: args.reason.slice(0, 500),
        jobId: args.jobId,
      } satisfies AuditMetadata,
    },
  });
}
