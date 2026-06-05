import prisma from "@/lib/db/prisma";
import { auditInboxClassificationEnqueued } from "@/lib/ai/inbox-classification/audit";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "@/lib/ai/inbox-classification/constants";
import { listUncategorizedThreadIdsForMailbox } from "@/lib/ai/inbox-classification/list-threads";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { isAgentAutomationEnabled } from "@/lib/jobs/policy";
import { JOB_TYPES } from "@/lib/jobs/types";

export type EnqueueInboxClassificationResult = {
  enqueued: boolean;
  reason?: string;
  threadCount?: number;
  jobId?: string;
};

export async function tryEnqueueInboxClassificationAfterSync(args: {
  organizationId: string;
  connectedAccountId: string;
  actorUserId: string;
  parentJobId: string;
}): Promise<EnqueueInboxClassificationResult> {
  if (!isAgentAutomationEnabled()) {
    return { enqueued: false, reason: "automation_disabled" };
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return { enqueued: false, reason: "gemini_not_configured" };
  }

  const policy = await prisma.organizationAiPolicy.findUnique({
    where: { organizationId: args.organizationId },
    select: { autoTriageEnabled: true },
  });

  if (!policy?.autoTriageEnabled) {
    return { enqueued: false, reason: "auto_triage_disabled" };
  }

  const threadIds = await listUncategorizedThreadIdsForMailbox({
    organizationId: args.organizationId,
    connectedAccountId: args.connectedAccountId,
    limit: INBOX_CLASSIFICATION_BATCH_SIZE,
  });

  if (threadIds.length === 0) {
    return { enqueued: false, reason: "no_uncategorized_threads" };
  }

  try {
    const { jobId, created } = await enqueueJob({
      organizationId: args.organizationId,
      jobType: JOB_TYPES.AGENT_TRIAGE,
      idempotencyKey: `inbox-classify:${args.connectedAccountId}:${args.parentJobId}`,
      payload: {
        connectedAccountId: args.connectedAccountId,
        threadIds,
      },
      triggerSource: "SYSTEM",
      triggeredByUserId: args.actorUserId,
      priority: 5,
    });

    if (created) {
      await auditInboxClassificationEnqueued({
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        connectedAccountId: args.connectedAccountId,
        jobId,
        threadCount: threadIds.length,
        parentJobId: args.parentJobId,
      });
    }

    return { enqueued: created, threadCount: threadIds.length, jobId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "enqueue_failed";
    return { enqueued: false, reason: message.slice(0, 200) };
  }
}
