import {
  InlineAlert,
  InlineNotice,
  PortalPageHeader,
} from "@/components/portal/ui";
import {
  AttentionSection,
  SummaryPill,
} from "@/components/operations/attention-section";
import type { OperationsCentreData } from "@/lib/operations/operations-centre.service";

export function OperationsCentre({
  data,
  loadError,
}: {
  data: OperationsCentreData | null;
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PortalPageHeader
          eyebrow="Command"
          title="Operations"
          description="What needs your attention across leasing workflows right now."
        />
        <InlineAlert>{loadError}</InlineAlert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PortalPageHeader
          eyebrow="Command"
          title="Operations"
          description="What needs your attention across leasing workflows right now."
        />
        <InlineNotice>Select an active organization to view operations.</InlineNotice>
      </div>
    );
  }

  const { summary, sections, sourceErrors, previewLimit } = data;
  const visibleSections = sections.filter((section) => section.total > 0);
  const hasWork = summary.total > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PortalPageHeader
        eyebrow="Command"
        title="Operations"
        description="What needs your attention across leasing workflows right now."
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-900">Open items</p>
        <div className="flex flex-wrap gap-2" aria-label="Operations summary">
          {!hasWork ? (
            <InlineNotice>No leasing items need attention right now.</InlineNotice>
          ) : (
            <>
              <SummaryPill
                href="#ops-section-needs_attention"
                label="Needs attention"
                count={summary.needs_attention}
              />
              <SummaryPill
                href="#ops-section-overdue"
                label="Overdue"
                count={summary.overdue}
              />
              <SummaryPill href="#ops-section-waiting" label="Waiting" count={summary.waiting} />
              <SummaryPill
                href="#ops-section-coming_up"
                label="Coming up"
                count={summary.coming_up}
              />
            </>
          )}
        </div>
      </div>

      {sourceErrors.length > 0 ? (
        <div className="space-y-2" role="status" aria-live="polite">
          {sourceErrors.map((err) => (
            <InlineAlert key={err.sourceId}>
              Could not load {err.sourceId.replaceAll("_", " ")}: {err.message}
            </InlineAlert>
          ))}
        </div>
      ) : null}

      {hasWork ? (
        <div className="space-y-8">
          {visibleSections.map((section) => (
            <AttentionSection
              key={section.id}
              section={section}
              previewLimit={previewLimit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
