import type { EmailThreadCategory } from "@prisma/client";
import { buildInboxClassificationContext } from "@/lib/ai/inbox-classification/build-context";
import { buildInboxClassificationPrompt } from "@/lib/ai/inbox-classification/build-prompt";
import { evaluateDeterministicInboxFilters } from "@/lib/ai/inbox-classification/deterministic-filters";
import { parseInboxClassificationOutput } from "@/lib/ai/inbox-classification/parse-output";
import { recordInboxClassificationAttempt } from "@/lib/ai/inbox-classification/record-attempt";
import {
  shouldAttemptInboxClassification,
  shouldPersistInboxClassification,
} from "@/lib/ai/inbox-classification/should-classify";
import { isGeminiRateLimitError } from "@/lib/ai/gemini-errors";
import { createChatJsonCompletion } from "@/lib/ai/gemini-client";
import prisma from "@/lib/db/prisma";
import {
  getEffectiveCategories,
  isManualClassificationLocked,
  replaceAutomaticCategoryAssignments,
  type ThreadCategoryAssignment,
} from "@/lib/inbox/thread-category-assignments";

export type ClassifyInboxThreadResult =
  | { status: "skipped"; reason: string }
  | {
      status: "low_confidence";
      categories: EmailThreadCategory[];
      confidence: number;
      reason: string;
    }
  | {
      status: "classified";
      categories: EmailThreadCategory[];
      confidence: number;
      reason: string;
    }
  | { status: "rate_limited"; error: string }
  | { status: "failed"; error: string };

type CreateCompletion = (args: {
  messages: Array<{ role: "system" | "user"; content: string }>;
}) => Promise<unknown>;

function mapAssignments(
  rows: Array<{
    category: EmailThreadCategory;
    source: ThreadCategoryAssignment["source"];
    reason: string | null;
    assignedAt: Date;
  }>,
): ThreadCategoryAssignment[] {
  return rows.map((row) => ({
    category: row.category,
    source: row.source,
    reason: row.reason,
    assignedAt: row.assignedAt,
  }));
}

export async function classifyInboxThread(args: {
  threadId: string;
  organizationId: string;
  createCompletion?: CreateCompletion;
}): Promise<ClassifyInboxThreadResult> {
  const thread = await prisma.emailThread.findFirst({
    where: { id: args.threadId, organizationId: args.organizationId },
    select: {
      id: true,
      organizationId: true,
      connectedAccountId: true,
      subject: true,
      snippet: true,
      participantEmails: true,
      contextLinks: true,
      category: true,
      categorySource: true,
      lastClassificationAttemptAt: true,
      categoryAssignments: {
        select: {
          category: true,
          source: true,
          reason: true,
          assignedAt: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          fromAddr: true,
          isOutbound: true,
          sentAt: true,
          bodyText: true,
        },
      },
    },
  });

  if (!thread) {
    return { status: "failed", error: "Thread not found." };
  }

  const assignments = mapAssignments(thread.categoryAssignments);

  if (
    !shouldAttemptInboxClassification({
      category: thread.category,
      categorySource: thread.categorySource,
      lastClassificationAttemptAt: thread.lastClassificationAttemptAt,
      assignments,
    })
  ) {
    return { status: "skipped", reason: "not_eligible" };
  }

  if (isManualClassificationLocked(assignments)) {
    return { status: "skipped", reason: "manual_locked" };
  }

  const deterministic = await evaluateDeterministicInboxFilters({
    organizationId: thread.organizationId,
    subject: thread.subject,
    snippet: thread.snippet,
    participantEmails: thread.participantEmails,
    messages: thread.messages,
  });

  if (deterministic.length > 0) {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.emailThreadCategoryAssignment.findMany({
        where: { threadId: thread.id },
        select: { category: true, source: true, reason: true, assignedAt: true },
      });

      if (isManualClassificationLocked(existing)) {
        return { count: 0, assignments: existing };
      }

      const nextAssignments = await replaceAutomaticCategoryAssignments(tx, {
        threadId: thread.id,
        assignments: deterministic.map((match) => ({
          category: match.category,
          source: "RULE",
          reason: match.reason,
        })),
        categoryConfidence: deterministic[0]?.confidence ?? null,
        categoryAiReason: deterministic.map((match) => match.reason).join(" "),
        lastClassificationAttemptAt: new Date(),
      });

      return { count: 1, assignments: nextAssignments };
    });

    if (updated.count === 0) {
      return { status: "skipped", reason: "manual_or_already_classified" };
    }

    const categories = getEffectiveCategories(updated.assignments, thread.category);

    return {
      status: "classified",
      categories,
      confidence: deterministic[0]?.confidence ?? 1,
      reason: deterministic.map((match) => match.reason).join(" "),
    };
  }

  try {
    const context = await buildInboxClassificationContext(thread);
    const prompt = buildInboxClassificationPrompt(context);
    const complete = args.createCompletion ?? createChatJsonCompletion;
    const raw = await complete({ messages: prompt.messages });
    const parsed = parseInboxClassificationOutput(raw);

    if (!parsed) {
      await recordInboxClassificationAttempt({
        threadId: thread.id,
        organizationId: args.organizationId,
      });
      return { status: "failed", error: "invalid_model_output" };
    }

    if (!shouldPersistInboxClassification(parsed)) {
      await recordInboxClassificationAttempt({
        threadId: thread.id,
        organizationId: args.organizationId,
        confidence: parsed.confidence,
        reason: parsed.reason,
      });
      return {
        status: "low_confidence",
        categories: [parsed.category],
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.emailThreadCategoryAssignment.findMany({
        where: { threadId: thread.id },
        select: { category: true, source: true, reason: true, assignedAt: true },
      });

      if (isManualClassificationLocked(existing)) {
        return { count: 0, assignments: existing };
      }

      const nextAssignments = await replaceAutomaticCategoryAssignments(tx, {
        threadId: thread.id,
        assignments: [
          {
            category: parsed.category,
            source: "AI",
            reason: parsed.reason,
          },
        ],
        categoryConfidence: parsed.confidence,
        categoryAiReason: parsed.reason,
        lastClassificationAttemptAt: new Date(),
      });

      return { count: 1, assignments: nextAssignments };
    });

    if (updated.count === 0) {
      return { status: "skipped", reason: "manual_or_already_classified" };
    }

    return {
      status: "classified",
      categories: getEffectiveCategories(updated.assignments, thread.category),
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "classification_failed";

    if (isGeminiRateLimitError(error)) {
      return { status: "rate_limited", error: message.slice(0, 500) };
    }

    await recordInboxClassificationAttempt({
      threadId: args.threadId,
      organizationId: args.organizationId,
    }).catch(() => undefined);

    return { status: "failed", error: message.slice(0, 500) };
  }
}
