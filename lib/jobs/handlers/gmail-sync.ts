import prisma from "@/lib/db/prisma";
import {
  auditGmailSyncCompleted,
  auditGmailSyncFailed,
  auditGmailSyncStarted,
} from "@/lib/gmail/gmail-sync-audit";
import { recordGmailSyncFailure, runGmailMailboxSync } from "@/lib/gmail/gmail-sync-core";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

function parseConnectedAccountId(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("gmail.sync payload must include connectedAccountId.");
  }
  const id = (payload as { connectedAccountId?: unknown }).connectedAccountId;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("gmail.sync payload must include connectedAccountId.");
  }
  return id;
}

export const handleGmailSync: JobHandler = async (ctx) => {
  const connectedAccountId = parseConnectedAccountId(ctx.job.payload);
  const actorUserId = getJobProcessorActorUserId(ctx.job.triggeredByUserId);

  const account = await prisma.connectedEmailAccount.findFirst({
    where: {
      id: connectedAccountId,
      organizationId: ctx.job.organizationId,
    },
  });

  if (!account) {
    throw new Error(
      `ConnectedEmailAccount not found or not owned by organization: ${connectedAccountId}`,
    );
  }

  await auditGmailSyncStarted({
    organizationId: ctx.job.organizationId,
    actorUserId,
    connectedAccountId: account.id,
    jobId: ctx.job.id,
  });

  try {
    const result = await runGmailMailboxSync({ account });

    await auditGmailSyncCompleted({
      organizationId: ctx.job.organizationId,
      actorUserId,
      connectedAccountId: account.id,
      threadCount: result.threadCount,
      messageCount: result.messageCount,
      jobId: ctx.job.id,
    });

    return {
      metadata: {
        connectedAccountId: account.id,
        threadCount: result.threadCount,
        messageCount: result.messageCount,
      },
    };
  } catch (error) {
    const message = await recordGmailSyncFailure({ accountId: account.id, error });

    await auditGmailSyncFailed({
      organizationId: ctx.job.organizationId,
      actorUserId,
      connectedAccountId: account.id,
      message,
      jobId: ctx.job.id,
    });

    throw error;
  }
};
