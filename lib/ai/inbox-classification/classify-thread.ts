import type { EmailThreadCategory } from "@prisma/client";
import { buildInboxClassificationContext } from "@/lib/ai/inbox-classification/build-context";
import { buildInboxClassificationPrompt } from "@/lib/ai/inbox-classification/build-prompt";
import { parseInboxClassificationOutput } from "@/lib/ai/inbox-classification/parse-output";
import { recordInboxClassificationAttempt } from "@/lib/ai/inbox-classification/record-attempt";
import {
  shouldAttemptInboxClassification,
  shouldPersistInboxClassification,
} from "@/lib/ai/inbox-classification/should-classify";
import { evaluateDeterministicInboxFilters } from "@/lib/ai/inbox-classification/deterministic-filters";
import { uncategorizedNonManualThreadWhere } from "@/lib/ai/inbox-classification/thread-filter";
import { isGeminiRateLimitError } from "@/lib/ai/gemini-errors";
import { createChatJsonCompletion } from "@/lib/ai/gemini-client";
import prisma from "@/lib/db/prisma";

export type ClassifyInboxThreadResult =
  | { status: "skipped"; reason: string }
  | { status: "low_confidence"; category: EmailThreadCategory; confidence: number; reason: string }
  | { status: "classified"; category: EmailThreadCategory; confidence: number; reason: string }
  | { status: "rate_limited"; error: string }
  | { status: "failed"; error: string };

type CreateCompletion = (args: {
  messages: Array<{ role: "system" | "user"; content: string }>;
}) => Promise<unknown>;

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

  if (!shouldAttemptInboxClassification(thread)) {
    return { status: "skipped", reason: "not_eligible" };
  }

  const deterministic = evaluateDeterministicInboxFilters(thread);
  if (deterministic.action === "classify") {
    const updated = await prisma.emailThread.updateMany({
      where: uncategorizedNonManualThreadWhere({
        threadId: thread.id,
        organizationId: args.organizationId,
      }),
      data: {
        category: deterministic.category,
        categorySource: "rule",
        categoryConfidence: deterministic.confidence,
        categoryAiReason: deterministic.reason,
        categoryUpdatedAt: new Date(),
        lastClassificationAttemptAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { status: "skipped", reason: "manual_or_already_classified" };
    }

    return {
      status: "classified",
      category: deterministic.category,
      confidence: deterministic.confidence,
      reason: deterministic.reason,
    };
  }

  if (deterministic.action === "skip_uncategorized") {
    await recordInboxClassificationAttempt({
      threadId: thread.id,
      organizationId: args.organizationId,
      confidence: deterministic.confidence,
      reason: deterministic.reason,
    });
    return { status: "skipped", reason: "deterministic_uncategorized" };
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
        category: parsed.category,
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    }

    const updated = await prisma.emailThread.updateMany({
      where: uncategorizedNonManualThreadWhere({
        threadId: thread.id,
        organizationId: args.organizationId,
      }),
      data: {
        category: parsed.category,
        categorySource: "ai",
        categoryConfidence: parsed.confidence,
        categoryAiReason: parsed.reason,
        categoryUpdatedAt: new Date(),
        lastClassificationAttemptAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { status: "skipped", reason: "manual_or_already_classified" };
    }

    return {
      status: "classified",
      category: parsed.category,
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
