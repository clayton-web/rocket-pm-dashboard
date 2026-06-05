import prisma from "@/lib/db/prisma";

/** Records a Gemini classification attempt for an still-uncategorized thread. */
export async function recordInboxClassificationAttempt(args: {
  threadId: string;
  organizationId: string;
  confidence?: number | null;
  reason?: string | null;
}): Promise<void> {
  await prisma.emailThread.updateMany({
    where: {
      id: args.threadId,
      organizationId: args.organizationId,
      category: "UNCATEGORIZED",
      NOT: { categorySource: "manual" },
    },
    data: {
      lastClassificationAttemptAt: new Date(),
      ...(args.confidence != null ? { categoryConfidence: args.confidence } : {}),
      ...(args.reason != null ? { categoryAiReason: args.reason } : {}),
    },
  });
}
