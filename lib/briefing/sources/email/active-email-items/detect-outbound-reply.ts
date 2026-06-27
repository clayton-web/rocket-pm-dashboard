import type { AttentionMessageSnapshot } from "@/lib/briefing/sources/email/active-email-items/types";

export function detectOutboundReplyAfter(args: {
  messages: AttentionMessageSnapshot[];
  after: Date;
}): Date | null {
  const outbound = args.messages
    .filter((message) => message.isOutbound && message.sentAt.getTime() > args.after.getTime())
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  return outbound[0]?.sentAt ?? null;
}

export function countOutboundMessages(args: {
  messages: AttentionMessageSnapshot[];
  beforeInclusive?: Date;
}): number {
  return args.messages.filter((message) => {
    if (!message.isOutbound) return false;
    if (args.beforeInclusive == null) return true;
    return message.sentAt.getTime() <= args.beforeInclusive.getTime();
  }).length;
}
