import prisma from "@/lib/db/prisma";
import type { ParsedGmailMessage } from "@/lib/gmail/gmail-message-parser";

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
  return prisma.$transaction(async (tx) => {
    const thread = await tx.emailThread.upsert({
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
      },
    });

    for (const message of args.messages) {
      await tx.emailMessage.upsert({
        where: {
          threadId_providerMessageId: {
            threadId: thread.id,
            providerMessageId: message.providerMessageId,
          },
        },
        create: {
          organizationId: args.organizationId,
          threadId: thread.id,
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

    return thread;
  });
}
