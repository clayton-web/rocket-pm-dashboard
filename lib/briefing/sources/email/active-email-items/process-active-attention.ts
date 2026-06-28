import type { EmailThreadBriefingAttention } from "@prisma/client";
import { BriefingAttentionStatus } from "@prisma/client";
import { evaluateAttentionStatus } from "@/lib/briefing/sources/email/active-email-items/evaluate-attention-status";
import { loadActiveAttentionRows } from "@/lib/briefing/sources/email/active-email-items/load-active-attention";
import {
  loadAttentionThreadSnapshots,
} from "@/lib/briefing/sources/email/active-email-items/load-attention-thread-snapshots";
import {
  applyAttentionEvaluation,
  type UpsertAttentionRegistryDeps,
} from "@/lib/briefing/sources/email/active-email-items/upsert-attention-registry";

export type ProcessActiveEmailAttentionResult = {
  carryForward: EmailThreadBriefingAttention[];
  activeRowsConsidered: number;
  clearedCount: number;
};

export type ProcessActiveEmailAttentionDeps = {
  loadActiveAttentionRows?: typeof loadActiveAttentionRows;
  loadAttentionThreadSnapshots?: typeof loadAttentionThreadSnapshots;
  applyAttentionEvaluation?: typeof applyAttentionEvaluation;
};

export async function processActiveEmailAttention(
  args: {
    organizationId: string;
    persistClears?: boolean;
  },
  deps: ProcessActiveEmailAttentionDeps = {},
): Promise<ProcessActiveEmailAttentionResult> {
  const loadActive = deps.loadActiveAttentionRows ?? loadActiveAttentionRows;
  const loadSnapshots = deps.loadAttentionThreadSnapshots ?? loadAttentionThreadSnapshots;
  const applyEvaluation = deps.applyAttentionEvaluation ?? applyAttentionEvaluation;
  const persistClears = args.persistClears ?? true;

  const activeRows = await loadActive({ organizationId: args.organizationId });
  if (activeRows.length === 0) {
    return { carryForward: [], activeRowsConsidered: 0, clearedCount: 0 };
  }

  const snapshots = await loadSnapshots({
    organizationId: args.organizationId,
    emailThreadIds: activeRows.map((row) => row.emailThreadId),
  });

  const carryForward: EmailThreadBriefingAttention[] = [];
  let clearedCount = 0;

  for (const row of activeRows) {
    const snapshot = snapshots.get(row.emailThreadId);
    const evaluation = evaluateAttentionStatus({
      registry: {
        status: row.status,
        firstSurfacedAt: row.firstSurfacedAt,
        surfacedAtOutboundCount: row.surfacedAtOutboundCount,
      },
      messages: snapshot?.messages ?? [],
      hasInboundMessage: snapshot?.hasInboundMessage ?? false,
    });

    if (!evaluation.shouldCarryForward) {
      clearedCount += 1;
      if (persistClears) {
        await applyEvaluation(
          {
            organizationId: args.organizationId,
            emailThreadId: row.emailThreadId,
            status:
              evaluation.status === BriefingAttentionStatus.REPLIED
                ? BriefingAttentionStatus.RESOLVED
                : evaluation.status,
            resolutionReason: evaluation.resolutionReason,
            lastOutboundAt: evaluation.lastOutboundAt,
          },
          deps as UpsertAttentionRegistryDeps,
        );
      }
      continue;
    }

    carryForward.push(row);
  }

  return {
    carryForward,
    activeRowsConsidered: activeRows.length,
    clearedCount,
  };
}
