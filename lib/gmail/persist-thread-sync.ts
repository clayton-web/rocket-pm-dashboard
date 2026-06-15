import prisma from "@/lib/db/prisma";
import type { ParsedGmailMessage } from "@/lib/gmail/gmail-message-parser";
import { applyDeterministicClassificationToThread } from "@/lib/ai/inbox-classification/apply-deterministic-classification";
import { isManualClassificationLocked } from "@/lib/inbox/thread-category-assignments";

type UpsertThreadArgs = {
  organizationId: string;
  connectedAccountId: string;
  providerThreadId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: Date | null;
  labelIds: string[];
  isUnread: boolean;
  participantEmails: string[];
  messages: ParsedGmailMessage[];
};

export async function upsertSyncedThread(args: UpsertThreadArgs) {
  const thread = await prisma.$transaction(async (tx) => {
    const existing = await tx.emailThread.findUnique({
      where: {
        connectedAccountId_providerThreadId: {
          connectedAccountId: args.connectedAccountId,
          providerThreadId: args.providerThreadId,
        },
      },
      select: {
        id: true,
        lastMessageAt: true,
        category: true,
        categorySource: true,
        categoryAssignments: {
          select: { source: true },
        },
      },
    });

    const newInboundActivity =
      existing != null &&
      args.lastMessageAt != null &&
      (existing.lastMessageAt == null || args.lastMessageAt > existing.lastMessageAt);

    const manualLocked =
      existing != null && isManualClassificationLocked(existing.categoryAssignments);

    const clearClassificationAttempt =
      newInboundActivity &&
      existing.category === "UNCATEGORIZED" &&
      existing.categorySource !== "manual" &&
      !manualLocked;

    const upserted = await tx.emailThread.upsert({
      where: {
        connectedAccountId_providerThreadId: {
          connectedAccountId: args.connectedAccountId,
          providerThreadId: args.providerThreadId,
        },
      },
      create: {
        organizationId: args.organizationId,
        connectedAccountId: args.connectedAccountId,
        providerThreadId: args.providerThreadId,
        subject: args.subject,
        snippet: args.snippet,
        lastMessageAt: args.lastMessageAt,
        labelIds: args.labelIds,
        isUnread: args.isUnread,
        participantEmails: args.participantEmails,
      },
      update: {
        subject: args.subject,
        snippet: args.snippet,
        lastMessageAt: args.lastMessageAt,
        labelIds: args.labelIds,
        isUnread: args.isUnread,
        participantEmails: args.participantEmails,
        ...(clearClassificationAttempt
          ? {
              lastClassificationAttemptAt: null,
              categoryConfidence: null,
              categoryAiReason: null,
            }
          : {}),
      },
    });

    for (const message of args.messages) {
      await tx.emailMessage.upsert({
        where: {
          threadId_providerMessageId: {
            threadId: upserted.id,
            providerMessageId: message.providerMessageId,
          },
        },
        create: {
          organizationId: args.organizationId,
          threadId: upserted.id,
          providerMessageId: message.providerMessageId,
          fromAddr: message.fromAddr,
          toAddrs: message.toAddrs,
          ccAddrs: message.ccAddrs,
          sentAt: message.sentAt,
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
          isOutbound: message.isOutbound,
          labelIds: message.labelIds,
          isUnread: message.isUnread,
        },
        update: {
          fromAddr: message.fromAddr,
          toAddrs: message.toAddrs,
          ccAddrs: message.ccAddrs,
          sentAt: message.sentAt,
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
          isOutbound: message.isOutbound,
          labelIds: message.labelIds,
          isUnread: message.isUnread,
        },
      });
    }

    return upserted;
  });

  await applyDeterministicClassificationToThread({
    threadId: thread.id,
    organizationId: args.organizationId,
    thread: {
      organizationId: args.organizationId,
      subject: args.subject,
      snippet: args.snippet,
      participantEmails: args.participantEmails,
      messages: args.messages,
    },
  });

  return thread;
}
