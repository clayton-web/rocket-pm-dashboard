import { normalizeSenderEmail } from "@/lib/inbox/normalize-sender-email";

export type ThreadMessageSenderSnapshot = {
  fromAddr: string;
  isOutbound: boolean;
  sentAt: Date;
};

/**
 * Primary external sender for a thread — latest inbound message by sentAt.
 */
export function extractInboundSenderFromMessages(
  messages: ThreadMessageSenderSnapshot[],
): { senderEmail: string; senderName: string | null } | null {
  const inbound = messages
    .filter((message) => !message.isOutbound)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  const latest = inbound[0];
  if (!latest) return null;

  const senderEmail = normalizeSenderEmail(latest.fromAddr);
  if (!senderEmail) return null;

  return { senderEmail, senderName: null };
}
