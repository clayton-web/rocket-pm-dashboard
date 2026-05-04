import type {
  GmailMessageResource,
  GmailPayloadPart,
  GmailThreadResource,
} from "@/lib/gmail/gmail-api";

const MAX_HTML_CHARS = 150_000;

export type ParsedGmailMessage = {
  providerMessageId: string;
  fromAddr: string;
  toAddrs: string[];
  ccAddrs: string[];
  sentAt: Date;
  bodyText: string | null;
  bodyHtml: string | null;
  labelIds: string[];
  isOutbound: boolean;
  isUnread: boolean;
};

function decodeBase64Url(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

function getHeader(headers: { name: string; value: string }[] | undefined, needle: string): string | null {
  if (!headers) return null;
  const found = headers.find((h) => h.name.toLowerCase() === needle.toLowerCase());
  return found?.value ?? null;
}

function extractEmails(headerValue: string | null): string[] {
  if (!headerValue) return [];
  const parts = headerValue.split(",");
  const emails: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const angle = trimmed.match(/<([^>]+)>/);
    const addr = angle ? angle[1] : trimmed;
    const normalized = addr.replace(/[<>]/g, "").trim().toLowerCase();
    if (normalized.includes("@")) {
      emails.push(normalized);
    }
  }
  return emails;
}

type CollectedBodies = { text: string | null; html: string | null };

function collectBodies(part: GmailPayloadPart | undefined, out: CollectedBodies) {
  if (!part) return;

  const mime = part.mimeType ?? "";
  const data = part.body?.data;
  if (mime === "text/plain" && data) {
    try {
      out.text = decodeBase64Url(data);
    } catch {
      /* ignore */
    }
  }
  if (mime === "text/html" && data) {
    try {
      let html = decodeBase64Url(data);
      if (html.length > MAX_HTML_CHARS) {
        html = `${html.slice(0, MAX_HTML_CHARS)}\n<!-- trimmed -->`;
      }
      out.html = html;
    } catch {
      /* ignore */
    }
  }

  if (part.parts) {
    for (const child of part.parts) {
      collectBodies(child, out);
    }
  }
}

function parseMessage(message: GmailMessageResource): ParsedGmailMessage {
  const labelIds = message.labelIds ?? [];
  const isOutbound = labelIds.includes("SENT");
  const isUnread = labelIds.includes("UNREAD");

  const headers = message.payload?.headers;
  const fromHeader = getHeader(headers, "From");
  const fromList = extractEmails(fromHeader);
  const fromAddr = fromList[0] ?? (fromHeader?.toLowerCase() ?? "unknown");

  const toAddrs = extractEmails(getHeader(headers, "To"));
  const ccAddrs = extractEmails(getHeader(headers, "Cc"));

  const bodies: CollectedBodies = { text: null, html: null };
  collectBodies(message.payload, bodies);

  const internalDateMs = message.internalDate ? Number(message.internalDate) : NaN;
  const sentAt = Number.isFinite(internalDateMs) ? new Date(internalDateMs) : new Date();

  return {
    providerMessageId: message.id,
    fromAddr,
    toAddrs,
    ccAddrs,
    sentAt,
    bodyText: bodies.text,
    bodyHtml: bodies.html,
    labelIds,
    isOutbound,
    isUnread,
  };
}

function messageSubject(message: GmailMessageResource): string | null {
  const headers = message.payload?.headers;
  const subject = getHeader(headers, "Subject");
  return subject?.trim() || null;
}

function uniqueSorted(emails: string[]) {
  return Array.from(new Set(emails.map((e) => e.toLowerCase()))).sort();
}

export function parseGmailThread(thread: GmailThreadResource): {
  providerThreadId: string;
  snippet: string | null;
  subject: string | null;
  lastMessageAt: Date | null;
  labelIds: string[];
  isUnread: boolean;
  participantEmails: string[];
  messages: ParsedGmailMessage[];
} {
  const gmailMessages = [...(thread.messages ?? [])].sort((a, b) => {
    const am = a.internalDate ? Number(a.internalDate) : 0;
    const bm = b.internalDate ? Number(b.internalDate) : 0;
    return am - bm;
  });

  const parsedMessages = gmailMessages.map(parseMessage);

  const subject =
    gmailMessages.map(messageSubject).find((s) => Boolean(s)) ??
    (thread.snippet?.trim() || null);

  const lastInternal = gmailMessages[gmailMessages.length - 1]?.internalDate;
  const lastMessageAt = lastInternal ? new Date(Number(lastInternal)) : null;

  const labelSet = new Set<string>();
  let threadUnread = false;
  const participants: string[] = [];

  for (const pm of parsedMessages) {
    for (const id of pm.labelIds) labelSet.add(id);
    if (pm.isUnread) threadUnread = true;
    participants.push(pm.fromAddr, ...pm.toAddrs, ...pm.ccAddrs);
  }

  return {
    providerThreadId: thread.id,
    snippet: thread.snippet?.trim() ?? null,
    subject,
    lastMessageAt,
    labelIds: Array.from(labelSet).sort(),
    isUnread: threadUnread,
    participantEmails: uniqueSorted(participants),
    messages: parsedMessages,
  };
}
