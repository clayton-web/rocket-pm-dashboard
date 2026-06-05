import { isPmContextLink, parseEmailThreadContextLinks } from "@/lib/ai/email-context-links";
import type { InboxClassificationContext } from "@/lib/ai/inbox-classification/build-prompt";
import { loadPmContextSnippets } from "@/lib/ai/load-pm-context";
import { extractInboundSenderFromMessages } from "@/lib/inbox/extract-thread-sender";
import { getSenderCategoryMemory } from "@/lib/inbox/sender-category-memory";

export type ThreadForClassification = {
  organizationId: string;
  connectedAccountId: string;
  subject: string | null;
  snippet: string | null;
  participantEmails: string[];
  contextLinks: unknown;
  messages: Array<{
    fromAddr: string;
    isOutbound: boolean;
    sentAt: Date;
    bodyText: string | null;
  }>;
};

export async function buildInboxClassificationContext(
  thread: ThreadForClassification,
): Promise<InboxClassificationContext> {
  const sender = extractInboundSenderFromMessages(thread.messages);

  let senderMemoryCategory: string | null = null;
  let senderMemorySource: string | null = null;

  if (sender) {
    const memory = await getSenderCategoryMemory({
      organizationId: thread.organizationId,
      connectedAccountId: thread.connectedAccountId,
      senderEmail: sender.senderEmail,
    });
    if (memory) {
      senderMemoryCategory = memory.category;
      senderMemorySource = memory.source;
    }
  }

  const pmLinks = parseEmailThreadContextLinks(thread.contextLinks).filter(isPmContextLink);
  const pmSnippets = await loadPmContextSnippets(thread.organizationId, pmLinks);
  const pmContextLines = pmSnippets.map((snippet) => `[${snippet.kind}] ${snippet.label}: ${snippet.text}`);

  return {
    subject: thread.subject,
    snippet: thread.snippet,
    participantEmails: thread.participantEmails,
    senderEmail: sender?.senderEmail ?? null,
    senderName: sender?.senderName ?? null,
    senderMemoryCategory,
    senderMemorySource,
    pmContextLines,
    messages: thread.messages.map((message) => ({
      fromAddr: message.fromAddr,
      isOutbound: message.isOutbound,
      sentAt: message.sentAt.toISOString(),
      bodyText: message.bodyText,
    })),
  };
}
