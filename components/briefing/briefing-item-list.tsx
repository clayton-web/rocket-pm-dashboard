import Link from "next/link";
import type { BriefingItemView } from "@/lib/briefing/briefing-queries";
import { groupBriefingItemsByCategory } from "@/lib/briefing/briefing-queries";
import { BriefingCategoryBadge } from "@/components/briefing/briefing-category-badge";
import { FOCUS_RING } from "@/components/portal/focus";
import { InlineNotice, SURFACE_DASHED, SURFACE_PANEL } from "@/components/portal/ui";

function formatDueDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function BriefingItemCard({ item }: { item: BriefingItemView }) {
  const dueLabel = formatDueDate(item.dueDate);

  return (
    <article className={`${SURFACE_PANEL} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{item.summaryTitle}</h3>
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          {item.urgency}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <BriefingCategoryBadge category={item.category} />
        <span className="text-xs text-foreground-subtle">Source: {item.sourceType}</span>
        {item.summary.dataProvenance ? (
          <span className="text-xs text-foreground-subtle">Provenance: {item.summary.dataProvenance}</span>
        ) : null}
      </div>

      {item.showEmailMentionLabel ? (
        <InlineNotice tone="warning" size="compact" className="mt-2">
          Email mention only — verify in Buildium once integrated.
        </InlineNotice>
      ) : null}

      {item.subject ? (
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium text-foreground">Subject:</span> {item.subject}
        </p>
      ) : null}

      {item.summary.keyFacts && item.summary.keyFacts.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground-muted">
          {item.summary.keyFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}

      {item.summary.requiredAction ? (
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">Required action:</span> {item.summary.requiredAction}
        </p>
      ) : null}

      {item.summary.suggestedReplyNotes ? (
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium text-foreground">Suggested reply notes:</span>{" "}
          {item.summary.suggestedReplyNotes}
        </p>
      ) : null}

      {dueLabel ? (
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium">Due:</span> {dueLabel}
        </p>
      ) : null}

      {item.emailThreadId ? (
        <div className="mt-3">
          <Link
            href={`/inbox/${item.emailThreadId}`}
            prefetch={false}
            className={`rounded-sm text-sm font-medium text-foreground underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            Open inbox thread
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function BriefingItemList({
  items,
  grouped = true,
}: {
  items: BriefingItemView[];
  grouped?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className={`${SURFACE_DASHED} px-4 py-6 text-sm text-foreground-muted`}>
        No briefing items in this run.
      </p>
    );
  }

  if (!grouped) {
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <BriefingItemCard key={item.id} item={item} />
        ))}
      </div>
    );
  }

  const groups = groupBriefingItemsByCategory(items);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {group.category === "RENT_DEPOSIT" ? (
              <>
                Rent / deposit{" "}
                <span className="font-normal text-foreground-subtle">(email mentions)</span>
              </>
            ) : (
              group.category.replaceAll("_", " ")
            )}
          </h3>
          {group.items.map((item) => (
            <BriefingItemCard key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
