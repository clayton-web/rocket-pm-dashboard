import prisma from "@/lib/db/prisma";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "@/lib/ai/inbox-classification/constants";

export async function listUncategorizedThreadIdsForMailbox(args: {
  organizationId: string;
  connectedAccountId: string;
  limit?: number;
}): Promise<string[]> {
  const rows = await prisma.emailThread.findMany({
    where: {
      organizationId: args.organizationId,
      connectedAccountId: args.connectedAccountId,
      category: "UNCATEGORIZED",
      lastClassificationAttemptAt: null,
      OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
    },
    orderBy: { lastMessageAt: "desc" },
    take: args.limit ?? INBOX_CLASSIFICATION_BATCH_SIZE,
    select: { id: true },
  });

  return rows.map((row) => row.id);
}
