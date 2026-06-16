import { normalizeSenderEmail } from "@/lib/inbox/normalize-sender-email";

export type ThreadMessageSenderSnapshot = {
  fromAddr: string;
  isOutbound: boolean;
  sentAt: Date;
};

export type InboxSenderDisplay = {
  senderLabel: string;
  senderEmail: string | null;
};

function parseSenderName(fromAddr: string): string | null {
  const trimmed = fromAddr.trim();
  const named = trimmed.match(/^("([^"]+)"|([^<"']+?))\s*<[^>]+>/);
  if (!named) return null;

  const name = (named[2] ?? named[3] ?? "").trim();
  return name.length > 0 ? name : null;
}

function pickParticipantSender(
  participantEmails: string[],
  mailboxEmail?: string | null,
): string | null {
  const mailbox = mailboxEmail?.trim().toLowerCase() ?? null;
  for (const participant of participantEmails) {
    const email = normalizeSenderEmail(participant);
    if (!email) continue;
    if (mailbox && email === mailbox) continue;
    return email;
  }

  const first = participantEmails[0];
  return first ? normalizeSenderEmail(first) : null;
}

export function deriveInboxSenderDisplay(args: {
  latestInboundFromAddr: string | null;
  participantEmails: string[];
  mailboxEmail?: string | null;
}): InboxSenderDisplay {
  const rawFromAddr = args.latestInboundFromAddr?.trim() ?? "";
  const senderEmail =
    (rawFromAddr ? normalizeSenderEmail(rawFromAddr) : null) ??
    pickParticipantSender(args.participantEmails, args.mailboxEmail);

  if (rawFromAddr) {
    const senderName = parseSenderName(rawFromAddr);
    if (senderName) {
      return { senderLabel: senderName, senderEmail };
    }
    if (senderEmail) {
      return { senderLabel: senderEmail, senderEmail };
    }
    return { senderLabel: rawFromAddr, senderEmail: null };
  }

  if (senderEmail) {
    return { senderLabel: senderEmail, senderEmail };
  }

  return { senderLabel: "Unknown sender", senderEmail: null };
}

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

  return { senderEmail, senderName: parseSenderName(latest.fromAddr) };
}
