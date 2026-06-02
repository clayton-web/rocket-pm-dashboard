import { getValidGmailAccessToken } from "@/lib/gmail/gmail-access";
import {
  createGmailDraft,
  getHeaderValue,
  getMessageMetadata,
} from "@/lib/gmail/gmail-api";
import { GmailAuthError } from "@/lib/gmail/gmail-errors";
import { GMAIL_COMPOSE_SCOPE } from "@/lib/gmail/oauth-config";
import prisma from "@/lib/db/prisma";

type ThreadForDraft = {
  id: string;
  organizationId: string;
  providerThreadId: string;
  subject: string | null;
  connectedAccountId: string;
  messages: Array<{
    providerMessageId: string;
    fromAddr: string;
    sentAt: Date;
    isOutbound: boolean;
  }>;
};

function compactCrlf(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

function gmailCallWithRetry<T>(accountId: string, fn: (accessToken: string) => Promise<T>): Promise<T> {
  return (async () => {
    try {
      const accessToken = await getValidGmailAccessToken(accountId);
      return await fn(accessToken);
    } catch (error) {
      if (error instanceof GmailAuthError && error.code === "unauthorized") {
        const accessToken = await getValidGmailAccessToken(accountId, { forceRefresh: true });
        return await fn(accessToken);
      }
      throw error;
    }
  })();
}

function bracketMessageId(raw: string): string | null {
  const inner = raw.replace(/^<|>$/g, "").trim();
  if (!inner || inner.includes("\n")) return null;
  return `<${inner}>`;
}

function replySubjectLine(original: string | null): string {
  const base = original?.trim() || "(no subject)";
  const noReChains = base.replace(/^(Re:\s*)+/gi, "").trim() || "(no subject)";
  return `Re: ${noReChains}`;
}

function sanitizeHeaderLine(line: string): string {
  return line.replace(/\r|\n/g, " ").slice(0, 998);
}

function formatBase64Body(utf8: string): string {
  const b64 = Buffer.from(utf8, "utf8").toString("base64");
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n");
}

/** RFC 822 message for drafts.create (`raw`). */
export function buildThreadReplyDraftMime(args: {
  fromMailboxEmail: string;
  toEmail: string;
  subjectLine: string;
  inReplyToBracketedId: string;
  referencesBracketedId: string;
  bodyUtf8: string;
}): string {
  const from = sanitizeHeaderLine(args.fromMailboxEmail.trim());
  const to = sanitizeHeaderLine(args.toEmail.trim());
  const subject = sanitizeHeaderLine(args.subjectLine);
  const inReplyTo = sanitizeHeaderLine(args.inReplyToBracketedId);
  const refs = sanitizeHeaderLine(args.referencesBracketedId);
  const body = compactCrlf(args.bodyUtf8);
  const b64Chunks = formatBase64Body(body);

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${refs}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Chunks,
    "",
  ].join("\r\n");
}

function extractToAddress(fromStored: string): string | null {
  const trimmed = fromStored.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  const angle = trimmed.match(/<([^>]+)>/);
  const cand = angle ? angle[1] : trimmed;
  const email = cand.replace(/[<>]/g, "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function pickReplyTargetMessage(thread: ThreadForDraft): ThreadForDraft["messages"][0] | null {
  const inbound = thread.messages.filter((m) => !m.isOutbound);
  if (!inbound.length) return null;
  inbound.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  return inbound[0] ?? null;
}

export async function createThreadReplyGmailDraft(args: {
  draftText: string;
  aiDraftResponseId: string;
  /** Pass only after caller verified org/thread access. */
  thread: ThreadForDraft;
  connectedAccountScopes: string[];
  mailboxEmail: string;
  userId: string;
}): Promise<void> {
  const text = args.draftText.trim();
  if (!text.length) {
    throw new Error("Draft text is empty; generate a draft first.");
  }

  const gmailThreadId = args.thread.providerThreadId.trim();
  if (!gmailThreadId) {
    throw new Error("Cannot create Gmail draft: this thread has no Gmail thread id. Try syncing mail again.");
  }

  const replyTarget = pickReplyTargetMessage(args.thread);
  if (!replyTarget) {
    throw new Error("Cannot create Gmail draft: no inbound message found to reply to in this thread.");
  }

  const toEmail = extractToAddress(replyTarget.fromAddr);
  if (!toEmail) {
    throw new Error("Cannot create Gmail draft: missing a valid inbound sender email address.");
  }

  const hasCompose = args.connectedAccountScopes.includes(GMAIL_COMPOSE_SCOPE);
  if (!hasCompose) {
    throw new Error(
      "Gmail needs the compose permission to save drafts. Disconnect Gmail under Email, then reconnect to grant the updated scopes.",
    );
  }

  const meta = await gmailCallWithRetry(args.thread.connectedAccountId, (token) =>
    getMessageMetadata(token, replyTarget.providerMessageId),
  );
  const messageIdRaw = getHeaderValue(meta.payload?.headers, "Message-ID");
  const bracketed = messageIdRaw ? bracketMessageId(messageIdRaw) : null;
  if (!bracketed) {
    throw new Error(
      "Cannot create Gmail draft: the inbound message has no usable Message-ID header in Gmail.",
    );
  }

  const raw = buildThreadReplyDraftMime({
    fromMailboxEmail: args.mailboxEmail.trim(),
    toEmail,
    subjectLine: replySubjectLine(args.thread.subject),
    inReplyToBracketedId: bracketed,
    referencesBracketedId: bracketed,
    bodyUtf8: text,
  });

  await gmailCallWithRetry(args.thread.connectedAccountId, (token) =>
    createGmailDraft({ accessToken: token, gmailThreadId, rawRfc822: raw }),
  );

  await prisma.auditLog.create({
    data: {
      organizationId: args.thread.organizationId,
      actorUserId: args.userId,
      action: "gmail.draft.reply_created",
      resourceType: "AiDraftResponse",
      resourceId: args.aiDraftResponseId,
      metadata: { threadId: args.thread.id, gmailThreadId },
    },
  });
}
