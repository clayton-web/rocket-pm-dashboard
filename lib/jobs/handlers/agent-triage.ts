import prisma from "@/lib/db/prisma";
import {
  auditInboxClassificationCompleted,
  auditInboxThreadClassified,
} from "@/lib/ai/inbox-classification/audit";
import { classifyInboxThread } from "@/lib/ai/inbox-classification/classify-thread";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "@/lib/ai/inbox-classification/constants";
import { listUncategorizedThreadIdsForMailbox } from "@/lib/ai/inbox-classification/list-threads";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

function parsePayload(payload: unknown): { connectedAccountId: string; threadIds: string[] } {
  if (!payload || typeof payload !== "object") {
    throw new Error("agent.triage payload must include connectedAccountId.");
  }

  const connectedAccountId = (payload as { connectedAccountId?: unknown }).connectedAccountId;
  if (typeof connectedAccountId !== "string" || connectedAccountId.length === 0) {
    throw new Error("agent.triage payload must include connectedAccountId.");
  }

  const rawThreadIds = (payload as { threadIds?: unknown }).threadIds;
  const threadIds = Array.isArray(rawThreadIds)
    ? rawThreadIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  return { connectedAccountId, threadIds };
}

export const handleAgentTriage: JobHandler = async (ctx) => {
  const { connectedAccountId, threadIds: payloadThreadIds } = parsePayload(ctx.job.payload);
  const actorUserId = getJobProcessorActorUserId(ctx.job.triggeredByUserId);

  const account = await prisma.connectedEmailAccount.findFirst({
    where: {
      id: connectedAccountId,
      organizationId: ctx.job.organizationId,
    },
    select: { id: true },
  });

  if (!account) {
    throw new Error(`ConnectedEmailAccount not found: ${connectedAccountId}`);
  }

  const threadIds =
    payloadThreadIds.length > 0
      ? payloadThreadIds.slice(0, INBOX_CLASSIFICATION_BATCH_SIZE)
      : await listUncategorizedThreadIdsForMailbox({
          organizationId: ctx.job.organizationId,
          connectedAccountId: account.id,
          limit: INBOX_CLASSIFICATION_BATCH_SIZE,
        });

  let classified = 0;
  let lowConfidence = 0;
  let skipped = 0;
  let failed = 0;
  let rateLimited = 0;
  let processed = 0;

  for (const threadId of threadIds) {
    const result = await classifyInboxThread({
      threadId,
      organizationId: ctx.job.organizationId,
    });
    processed += 1;

    if (result.status === "classified") {
      classified += 1;
      await auditInboxThreadClassified({
        organizationId: ctx.job.organizationId,
        actorUserId,
        threadId,
        categories: result.categories,
        confidence: result.confidence,
        reason: result.reason,
        jobId: ctx.job.id,
      });
      continue;
    }

    if (result.status === "low_confidence") {
      lowConfidence += 1;
      continue;
    }

    if (result.status === "skipped") {
      skipped += 1;
      continue;
    }

    if (result.status === "rate_limited") {
      rateLimited += 1;
      break;
    }

    failed += 1;
  }

  await auditInboxClassificationCompleted({
    organizationId: ctx.job.organizationId,
    actorUserId,
    connectedAccountId: account.id,
    jobId: ctx.job.id,
    classified,
    lowConfidence,
    skipped,
    failed,
    rateLimited,
    deferred: Math.max(0, threadIds.length - processed),
  });

  return {
    metadata: {
      connectedAccountId: account.id,
      threadCount: threadIds.length,
      classified,
      lowConfidence,
      skipped,
      failed,
      rateLimited,
      deferred: Math.max(0, threadIds.length - processed),
    },
  };
};
