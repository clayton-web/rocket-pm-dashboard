import { FOCUS_RING } from "@/components/portal/focus";
import { SURFACE_PANEL } from "@/components/portal/ui";
import { formatGuidedMetaForDisplay } from "@/lib/maintenance/split-triage";
import type { MaintenanceTriageSummary } from "./types";

const urgencyLabel = {
  emergency: "Emergency",
  urgent: "Urgent",
  routine: "Routine",
} as const;

export function TriageSummaryCard({ triage }: { triage: MaintenanceTriageSummary }) {
  const summaryMain =
    triage.summary.trim() || (triage.technicalAppendix ? "See guided flow details below." : "—");
  const formattedAppendix = triage.technicalAppendix
    ? formatGuidedMetaForDisplay(triage.technicalAppendix)
    : "";

  return (
    <section className={`${SURFACE_PANEL} p-4`} aria-labelledby="triage-heading">
      <h2 id="triage-heading" className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
        Triage summary
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-foreground">Urgency</dt>
          <dd className="mt-1 text-sm text-foreground-muted">{urgencyLabel[triage.urgency]}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-foreground">Suggested trade</dt>
          <dd className="mt-1 text-sm text-foreground-muted">{triage.suggestedTrade}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-semibold text-foreground">Summary</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{summaryMain}</dd>
          {formattedAppendix ? (
            <details className="mt-3 rounded-lg border border-border bg-surface-muted/90">
              <summary
                className={`cursor-pointer rounded-lg px-3 py-2 text-xs text-foreground-subtle ${FOCUS_RING}`}
              >
                Guided flow details
              </summary>
              <pre className="max-h-52 overflow-auto border-t border-border px-3 py-2 font-mono text-xs text-foreground-muted">
                {formattedAppendix}
              </pre>
            </details>
          ) : null}
        </div>
      </dl>
    </section>
  );
}
