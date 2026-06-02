import type { EmailMessage, EmailThread } from "@prisma/client";
import { parseEmailThreadContextLinks } from "@/lib/ai/email-context-links";
import { buildResponderContext, type ResponderThreadSnapshot } from "@/lib/ai/context-builder";
import {
  loadResponderRetrieval,
  toApprovedDraftChunks,
  toKnowledgeChunks,
  toRuleChunks,
  toStyleChunks,
} from "@/lib/ai/load-retrieval";

export type ThreadWithMessages = EmailThread & {
  messages: Pick<EmailMessage, "id" | "fromAddr" | "sentAt" | "bodyText" | "isOutbound">[];
};

export function emailThreadToSnapshot(thread: ThreadWithMessages): ResponderThreadSnapshot {
  const contextLinks = parseEmailThreadContextLinks(thread.contextLinks);

  return {
    organizationId: thread.organizationId,
    threadId: thread.id,
    subject: thread.subject,
    messages: thread.messages.map((m) => ({
      id: m.id,
      fromAddr: m.fromAddr,
      sentAt: m.sentAt,
      bodyText: m.bodyText,
      isOutbound: m.isOutbound,
    })),
    contextLinks: contextLinks.length ? contextLinks : null,
  };
}

export async function assembleResponderContextForThread(args: {
  thread: ThreadWithMessages;
  userId: string;
}) {
  const snapshot = emailThreadToSnapshot(args.thread);
  const retrieval = await loadResponderRetrieval({
    organizationId: args.thread.organizationId,
    userId: args.userId,
  });

  return buildResponderContext({
    thread: snapshot,
    knowledge: toKnowledgeChunks(retrieval.knowledge),
    rules: toRuleChunks(retrieval.rules),
    styleExamples: toStyleChunks(retrieval.styleExamplesOrg, retrieval.styleExamplesUser),
    approvedDrafts: toApprovedDraftChunks(retrieval.approvedDrafts),
  });
}
