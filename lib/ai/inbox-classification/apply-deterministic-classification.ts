import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  evaluateDeterministicInboxFilters,
  type DeterministicCategoryMatch,
  type ThreadForDeterministicFilter,
} from "@/lib/ai/inbox-classification/deterministic-filters";
import {
  isManualClassificationLocked,
  replaceAutomaticCategoryAssignments,
  type ThreadCategoryAssignment,
} from "@/lib/inbox/thread-category-assignments";

export async function applyDeterministicClassificationToThread(args: {
  threadId: string;
  organizationId: string;
  thread: ThreadForDeterministicFilter;
  tx?: Prisma.TransactionClient;
}): Promise<{ applied: boolean; matches: DeterministicCategoryMatch[]; assignments: ThreadCategoryAssignment[] }> {
  const matches = await evaluateDeterministicInboxFilters(args.thread);
  if (matches.length === 0) {
    return { applied: false, matches, assignments: [] };
  }

  const run = async (tx: Prisma.TransactionClient) => {
    const existing = await tx.emailThreadCategoryAssignment.findMany({
      where: { threadId: args.threadId },
      select: { category: true, source: true, reason: true, assignedAt: true },
    });

    if (isManualClassificationLocked(existing)) {
      return existing;
    }

    return replaceAutomaticCategoryAssignments(tx, {
      threadId: args.threadId,
      assignments: matches.map((match) => ({
        category: match.category,
        source: "RULE",
        reason: match.reason,
      })),
      categoryConfidence: matches[0]?.confidence ?? null,
      categoryAiReason: matches.map((match) => match.reason).join(" "),
      lastClassificationAttemptAt: new Date(),
    });
  };

  const assignments = args.tx
    ? await run(args.tx)
    : await prisma.$transaction(run);

  return {
    applied: assignments.length > 0,
    matches,
    assignments,
  };
}
