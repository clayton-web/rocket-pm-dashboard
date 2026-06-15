import prisma from "@/lib/db/prisma";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "@/lib/ai/inbox-classification/constants";
import { listEligibleUncategorizedThreadsWhere } from "@/lib/ai/inbox-classification/thread-filter";

export async function listUncategorizedThreadIdsForMailbox(args: {
  organizationId: string;
  connectedAccountId: string;
  limit?: number;
}): Promise<string[]> {
  const rows = await prisma.emailThread.findMany({
    where: listEligibleUncategorizedThreadsWhere({
      organizationId: args.organizationId,
      connectedAccountId: args.connectedAccountId,
    }),
    orderBy: { lastMessageAt: "desc" },
    take: args.limit ?? INBOX_CLASSIFICATION_BATCH_SIZE,
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

export async function mailboxHasEligibleUncategorizedThreads(args: {
  organizationId: string;
  connectedAccountId: string;
}): Promise<boolean> {
  const row = await prisma.emailThread.findFirst({
    where: listEligibleUncategorizedThreadsWhere(args),
    select: { id: true },
  });

  return row != null;
}
