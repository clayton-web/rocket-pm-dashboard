import type { EmailMessage, EmailThread } from "@prisma/client";
import type { RemoteEntityRef } from "@/lib/integrations/types";
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
  let contextLinks: RemoteEntityRef[] | null = null;
  if (thread.contextLinks != null && Array.isArray(thread.contextLinks)) {
    contextLinks = thread.contextLinks as RemoteEntityRef[];
  }

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
    contextLinks,
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
