import React from "react";
import type { BriefingRunStatus } from "@prisma/client";
import { StatusBadge, type StatusTone } from "@/components/portal/status-badge";
import { BRIEFING_STATUS_LABELS } from "@/lib/briefing/briefing-queries";

/**
 * Briefing owns `run status -> tone`; `StatusBadge` owns `tone -> visual treatment`.
 *
 * The five run states are semantically equivalent to the shared tones — a queued run is neutral, an
 * in-flight run is informational, and the three outcomes are success/warning/danger — so briefing
 * keeps its vocabulary here rather than teaching the primitive about briefing runs.
 */
export const BRIEFING_STATUS_TONES: Record<BriefingRunStatus, StatusTone> = {
  PENDING: "neutral",
  RUNNING: "info",
  COMPLETED: "success",
  FAILED: "danger",
  PARTIAL: "warning",
};

export function BriefingStatusBadge({ status }: { status: BriefingRunStatus }) {
  return (
    <StatusBadge tone={BRIEFING_STATUS_TONES[status]}>
      {BRIEFING_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
