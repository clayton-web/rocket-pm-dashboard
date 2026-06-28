import prisma from "@/lib/db/prisma";
import type { AttentionMessageSnapshot } from "@/lib/briefing/sources/email/active-email-items/types";

const MAX_MESSAGES_PER_THREAD = 6;

export type AttentionThreadSnapshot = {
  emailThreadId: string;
  providerThreadId: string;
  subject: string | null;
  messages: AttentionMessageSnapshot[];
  hasInboundMessage: boolean;
};

export type LoadAttentionThreadSnapshotsDeps = {
  findMany?: typeof prisma.emailThread.findMany;
};

export async function loadAttentionThreadSnapshots(
  args: {
    organizationId: string;
    emailThreadIds: string[];
  },
  deps: LoadAttentionThreadSnapshotsDeps = {},
): Promise<Map<string, AttentionThreadSnapshot>> {
  const findMany = deps.findMany ?? prisma.emailThread.findMany;
  const snapshots = new Map<string, AttentionThreadSnapshot>();

  if (args.emailThreadIds.length === 0) {
    return snapshots;
  }

  const threads = await findMany({
    where: {
      organizationId: args.organizationId,
      id: { in: args.emailThreadIds },
    },
    select: {
      id: true,
      providerThreadId: true,
      subject: true,
      messages: {
        orderBy: { sentAt: "desc" },
        take: MAX_MESSAGES_PER_THREAD,
        select: {
          isOutbound: true,
          sentAt: true,
        },
      },
    },
  });

  for (const thread of threads) {
    const messages = thread.messages.map((message) => ({
      isOutbound: message.isOutbound,
      sentAt: message.sentAt,
    }));
    const latest = messages[0];
    snapshots.set(thread.id, {
      emailThreadId: thread.id,
      providerThreadId: thread.providerThreadId,
      subject: thread.subject,
      messages,
      hasInboundMessage: latest != null && !latest.isOutbound,
    });
  }

  return snapshots;
}
