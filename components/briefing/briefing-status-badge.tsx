import type { BriefingRunStatus } from "@prisma/client";
import { BRIEFING_STATUS_LABELS } from "@/lib/briefing/briefing-queries";

const STATUS_STYLES: Record<BriefingRunStatus, string> = {
  PENDING: "border-neutral-200 bg-neutral-100 text-neutral-700",
  RUNNING: "border-blue-200 bg-blue-50 text-blue-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-900",
};

export function BriefingStatusBadge({ status }: { status: BriefingRunStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {BRIEFING_STATUS_LABELS[status]}
    </span>
  );
}
