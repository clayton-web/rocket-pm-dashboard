import prisma from "@/lib/db/prisma";
import type { ConnectedEmailAccount } from "@prisma/client";
import { getValidGmailAccessToken, markAccountNeedsReauth } from "@/lib/gmail/gmail-access";
import { GmailAuthError, isGmailAuthError } from "@/lib/gmail/gmail-errors";
import { getThreadFull, listInboxThreads } from "@/lib/gmail/gmail-api";
import { parseGmailThread } from "@/lib/gmail/gmail-message-parser";
import { upsertSyncedThread } from "@/lib/gmail/persist-thread-sync";

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function getSyncMaxThreads(): number {
  const raw = Number(process.env.GMAIL_SYNC_MAX_THREADS ?? "15");
  return clampInt(raw, 1, 100);
}

export function getSyncUserMaxThreads(): number {
  const raw = Number(process.env.GMAIL_SYNC_USER_MAX_THREADS ?? "5");
  return clampInt(raw, 1, 100);
}

export function getSyncMaxThreadsForTriggerSource(triggerSource: string): number {
  if (triggerSource === "USER") {
    return getSyncUserMaxThreads();
  }
  return getSyncMaxThreads();
}

export function getSyncLabelIds(): string[] {
  const raw = process.env.GMAIL_SYNC_LABEL_IDS?.trim();
  if (!raw) {
    return ["INBOX"];
  }
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : ["INBOX"];
}

async function gmailCallWithRetry<T>(accountId: string, fn: (accessToken: string) => Promise<T>): Promise<T> {
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
}

export type GmailSyncResult = {
  threadCount: number;
  messageCount: number;
};

/**
 * Shared Gmail mailbox sync — idempotent upsert of recent inbox threads.
 * Does not write audit events; callers (job handler, direct sync) own auditing.
 */
export async function runGmailMailboxSync(args: {
  account: ConnectedEmailAccount;
  maxResults?: number;
}): Promise<GmailSyncResult> {
  const { account } = args;

  const labelIds = getSyncLabelIds();
  const maxResults = args.maxResults ?? getSyncMaxThreads();

  const listed = await gmailCallWithRetry(account.id, (token) =>
    listInboxThreads(token, { maxResults, labelIds }),
  );

  const threadIds = listed.threads?.map((t) => t.id) ?? [];

  let messageCount = 0;

  for (const threadId of threadIds) {
    const fullThread = await gmailCallWithRetry(account.id, (token) => getThreadFull(token, threadId));

    const parsed = parseGmailThread(fullThread);
    await upsertSyncedThread({
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      providerThreadId: parsed.providerThreadId,
      subject: parsed.subject,
      snippet: parsed.snippet,
      lastMessageAt: parsed.lastMessageAt,
      labelIds: parsed.labelIds,
      isUnread: parsed.isUnread,
      participantEmails: parsed.participantEmails,
      messages: parsed.messages,
    });

    messageCount += parsed.messages.length;
  }

  await prisma.connectedEmailAccount.update({
    where: { id: account.id },
    data: {
      lastSyncedAt: new Date(),
      lastError: null,
      status: "CONNECTED",
    },
  });

  return { threadCount: threadIds.length, messageCount };
}

export async function recordGmailSyncFailure(args: {
  accountId: string;
  error: unknown;
}): Promise<string> {
  const message = args.error instanceof Error ? args.error.message : "unknown_error";

  if (isGmailAuthError(args.error)) {
    await markAccountNeedsReauth(args.accountId, message);
  } else {
    await prisma.connectedEmailAccount.update({
      where: { id: args.accountId },
      data: {
        lastError: message,
      },
    });
  }

  return message;
}
