import type { BriefingOutputItem } from "@/lib/ai/briefing/briefing-output.schema";
import type { BriefingContext } from "@/lib/briefing/briefing-types";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import type { BriefingEmailThreadCandidate } from "@/lib/briefing/briefing-types";
import { buildNewWindowPersistMeta } from "@/lib/briefing/sources/email/merge-email-briefing-output";
import { touchAttentionRegistrySurfacing } from "@/lib/briefing/sources/email/active-email-items/touch-attention-registry-surfacing";
import {
  upsertAttentionRegistry,
  type UpsertAttentionRegistryDeps,
} from "@/lib/briefing/sources/email/active-email-items/upsert-attention-registry";
import type { BriefingEmailItemPersistMeta } from "@/lib/briefing/sources/types";

export async function syncEmailAttentionRegistry(args: {
  organizationId: string;
  briefingRunId: string;
  geminiItems: BriefingOutputItem[];
  context: BriefingContext;
  candidates: BriefingEmailThreadCandidate[];
  carryForwardRows: Array<{ id: string; emailThreadId: string }>;
}): Promise<Record<string, BriefingEmailItemPersistMeta>> {
  const persistMeta: Record<string, BriefingEmailItemPersistMeta> = {};
  const candidateById = new Map(args.candidates.map((candidate) => [candidate.id, candidate]));
  const now = new Date();

  for (const item of args.geminiItems) {
    if (!item.sourceThreadId) continue;

    const thread = args.context.threads.find((entry) => entry.threadId === item.sourceThreadId);
    const candidate = candidateById.get(item.sourceThreadId);

    const registry = await upsertAttentionRegistry({
      organizationId: args.organizationId,
      emailThreadId: item.sourceThreadId,
      summaryTitle: item.summaryTitle,
      category: item.category,
      urgency: item.urgency,
      subject: thread?.subject ?? candidate?.subject ?? null,
      summaryJson: {
        keyFacts: item.keyFacts,
        requiredAction: item.requiredAction ?? null,
        suggestedReplyNotes: item.suggestedReplyNotes ?? null,
        dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
        isPropertyManagementRelated: item.isPropertyManagementRelated,
        sender: thread?.sender ?? null,
        senderEmail: thread?.senderEmail ?? null,
      },
      lastSurfacedRunId: args.briefingRunId,
      lastSurfacedAt: now,
      messages: candidate?.messages.map((message) => ({
        isOutbound: message.isOutbound,
        sentAt: message.sentAt,
      })),
    });

    persistMeta[item.sourceThreadId] = buildNewWindowPersistMeta({
      subject: thread?.subject ?? candidate?.subject ?? null,
      emailThreadBriefingAttentionId: registry.id,
      summaryJson: {
        keyFacts: item.keyFacts,
        requiredAction: item.requiredAction ?? null,
        suggestedReplyNotes: item.suggestedReplyNotes ?? null,
        dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
        isPropertyManagementRelated: item.isPropertyManagementRelated,
        sender: thread?.sender ?? null,
        senderEmail: thread?.senderEmail ?? null,
      },
    });
  }

  for (const row of args.carryForwardRows) {
    await touchAttentionRegistrySurfacing({
      organizationId: args.organizationId,
      emailThreadId: row.emailThreadId,
      lastSurfacedRunId: args.briefingRunId,
      lastSurfacedAt: now,
    });
  }

  return persistMeta;
}

export type SyncEmailAttentionRegistryDeps = UpsertAttentionRegistryDeps & {
  upsertAttentionRegistry?: typeof upsertAttentionRegistry;
  touchAttentionRegistrySurfacing?: typeof touchAttentionRegistrySurfacing;
};
