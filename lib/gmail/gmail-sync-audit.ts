import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getSyncLabelIds, getSyncMaxThreads } from "@/lib/gmail/gmail-sync-core";

type AuditMetadata = Prisma.InputJsonValue;

export async function auditGmailSyncEnqueued(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  jobId: string;
  created: boolean;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "gmail.sync.enqueued",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        jobId: args.jobId,
        created: args.created,
      } satisfies AuditMetadata,
    },
  });
}

export async function auditGmailSyncStarted(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  jobId?: string;
  maxThreads?: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "gmail.sync.started",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        labelIds: getSyncLabelIds(),
        maxThreads: args.maxThreads ?? getSyncMaxThreads(),
        ...(args.jobId ? { jobId: args.jobId } : {}),
      } satisfies AuditMetadata,
    },
  });
}

export async function auditGmailSyncCompleted(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  threadCount: number;
  messageCount: number;
  jobId?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "gmail.sync.completed",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        threadCount: args.threadCount,
        messageCount: args.messageCount,
        ...(args.jobId ? { jobId: args.jobId } : {}),
      } satisfies AuditMetadata,
    },
  });
}

export async function auditGmailSyncFailed(args: {
  organizationId: string;
  actorUserId: string;
  connectedAccountId: string;
  message: string;
  jobId?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "gmail.sync.failed",
      resourceType: "ConnectedEmailAccount",
      resourceId: args.connectedAccountId,
      metadata: {
        message: args.message.slice(0, 500),
        ...(args.jobId ? { jobId: args.jobId } : {}),
      } satisfies AuditMetadata,
    },
  });
}
