import type { EmailThreadCategory, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { extractInboundSenderFromMessages } from "@/lib/inbox/extract-thread-sender";
import type { EmailThreadCategorySource } from "@/lib/inbox/email-thread-category";
import type { ParsedGmailMessage } from "@/lib/gmail/gmail-message-parser";

export type SenderCategoryMemoryRecord = {
  id: string;
  organizationId: string;
  connectedAccountId: string;
  senderEmail: string;
  senderName: string | null;
  category: EmailThreadCategory;
  contextNote: string | null;
  source: string;
  createdByUserId: string | null;
  lastMatchedAt: Date | null;
  matchCount: number;
};

export async function getSenderCategoryMemory(args: {
  organizationId: string;
  connectedAccountId: string;
  senderEmail: string;
}): Promise<SenderCategoryMemoryRecord | null> {
  return prisma.emailSenderCategoryMemory.findUnique({
    where: {
      organizationId_connectedAccountId_senderEmail: {
        organizationId: args.organizationId,
        connectedAccountId: args.connectedAccountId,
        senderEmail: args.senderEmail,
      },
    },
  });
}

export async function upsertSenderCategoryMemory(args: {
  organizationId: string;
  connectedAccountId: string;
  senderEmail: string;
  category: EmailThreadCategory;
  source: EmailThreadCategorySource;
  createdByUserId?: string | null;
  senderName?: string | null;
  contextNote?: string | null;
}): Promise<SenderCategoryMemoryRecord> {
  return prisma.emailSenderCategoryMemory.upsert({
    where: {
      organizationId_connectedAccountId_senderEmail: {
        organizationId: args.organizationId,
        connectedAccountId: args.connectedAccountId,
        senderEmail: args.senderEmail,
      },
    },
    create: {
      organizationId: args.organizationId,
      connectedAccountId: args.connectedAccountId,
      senderEmail: args.senderEmail,
      senderName: args.senderName ?? null,
      category: args.category,
      contextNote: args.contextNote ?? null,
      source: args.source,
      createdByUserId: args.createdByUserId ?? null,
    },
    update: {
      category: args.category,
      source: args.source,
      senderName: args.senderName ?? undefined,
      contextNote: args.contextNote ?? undefined,
      createdByUserId: args.createdByUserId ?? undefined,
    },
  });
}

export async function upsertSenderCategoryMemoryFromThread(args: {
  threadId: string;
  category: EmailThreadCategory;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const thread = await prisma.emailThread.findFirst({
    where: { id: args.threadId },
    select: {
      organizationId: true,
      connectedAccountId: true,
      messages: {
        select: { fromAddr: true, isOutbound: true, sentAt: true },
      },
    },
  });

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }

  const sender = extractInboundSenderFromMessages(thread.messages);
  if (!sender) {
    return { ok: true };
  }

  await upsertSenderCategoryMemory({
    organizationId: thread.organizationId,
    connectedAccountId: thread.connectedAccountId,
    senderEmail: sender.senderEmail,
    senderName: sender.senderName,
    category: args.category,
    source: "manual",
    createdByUserId: args.userId,
  });

  return { ok: true };
}

export type ResolvedSenderCategory = {
  category: EmailThreadCategory;
  categorySource: EmailThreadCategorySource;
  categoryUpdatedAt: Date;
};

export async function resolveCategoryForNewSyncedThread(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: string;
    connectedAccountId: string;
    messages: ParsedGmailMessage[];
  },
): Promise<ResolvedSenderCategory | null> {
  const sender = extractInboundSenderFromMessages(
    args.messages.map((message) => ({
      fromAddr: message.fromAddr,
      isOutbound: message.isOutbound,
      sentAt: message.sentAt,
    })),
  );
  if (!sender) return null;

  const memory = await tx.emailSenderCategoryMemory.findUnique({
    where: {
      organizationId_connectedAccountId_senderEmail: {
        organizationId: args.organizationId,
        connectedAccountId: args.connectedAccountId,
        senderEmail: sender.senderEmail,
      },
    },
  });
  if (!memory) return null;

  await tx.emailSenderCategoryMemory.update({
    where: { id: memory.id },
    data: {
      lastMatchedAt: new Date(),
      matchCount: { increment: 1 },
    },
  });

  return {
    category: memory.category,
    categorySource: "rule",
    categoryUpdatedAt: new Date(),
  };
}
