import prisma from "@/lib/db/prisma";
import type { BriefingEmailThreadCandidate } from "@/lib/briefing/briefing-types";

const MAX_CANDIDATE_THREADS = 100;
const MAX_MESSAGES_PER_THREAD = 6;

export async function collectEmailBriefingCandidates(args: {
  organizationId: string;
  windowStart: Date;
  windowEnd: Date;
}): Promise<BriefingEmailThreadCandidate[]> {
  const threads = await prisma.emailThread.findMany({
    where: {
      organizationId: args.organizationId,
      OR: [
        {
          lastMessageAt: {
            gte: args.windowStart,
            lte: args.windowEnd,
          },
        },
        {
          updatedAt: {
            gte: args.windowStart,
            lte: args.windowEnd,
          },
        },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      providerThreadId: true,
      subject: true,
      snippet: true,
      category: true,
      categoryConfidence: true,
      participantEmails: true,
      lastMessageAt: true,
      isUnread: true,
      messages: {
        orderBy: { sentAt: "desc" },
        take: MAX_MESSAGES_PER_THREAD,
        select: {
          id: true,
          providerMessageId: true,
          fromAddr: true,
          isOutbound: true,
          sentAt: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: MAX_CANDIDATE_THREADS,
  });

  return threads.map((thread) => ({
    id: thread.id,
    organizationId: thread.organizationId,
    providerThreadId: thread.providerThreadId,
    subject: thread.subject,
    snippet: thread.snippet,
    category: thread.category,
    categoryConfidence: thread.categoryConfidence,
    participantEmails: thread.participantEmails,
    lastMessageAt: thread.lastMessageAt,
    isUnread: thread.isUnread,
    messages: thread.messages.map((message) => ({
      id: message.id,
      providerMessageId: message.providerMessageId,
      fromAddr: message.fromAddr,
      isOutbound: message.isOutbound,
      sentAt: message.sentAt,
      bodyText: null,
    })),
  }));
}
