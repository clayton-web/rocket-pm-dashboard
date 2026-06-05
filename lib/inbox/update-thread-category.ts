import type { EmailThreadCategory } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import type { EmailThreadCategorySource } from "@/lib/inbox/email-thread-category";

export async function updateEmailThreadCategory(args: {
  threadId: string;
  organizationId: string;
  category: EmailThreadCategory;
  categorySource: EmailThreadCategorySource;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const thread = await prisma.emailThread.findFirst({
    where: { id: args.threadId, organizationId: args.organizationId },
    select: { id: true },
  });

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: {
      category: args.category,
      categorySource: args.categorySource,
      categoryUpdatedAt: new Date(),
      ...(args.categorySource === "manual"
        ? {
            categoryConfidence: null,
            categoryAiReason: null,
            lastClassificationAttemptAt: null,
          }
        : {}),
    },
  });

  return { ok: true };
}
