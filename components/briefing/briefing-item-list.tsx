import Link from "next/link";
import type { BriefingItemView } from "@/lib/briefing/briefing-queries";
import { groupBriefingItemsByCategory } from "@/lib/briefing/briefing-queries";
import { BriefingCategoryBadge } from "@/components/briefing/briefing-category-badge";

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
    <article className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{item.summaryTitle}</h3>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {item.urgency}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <BriefingCategoryBadge category={item.category} />
        <span className="text-xs text-neutral-500">Source: {item.sourceType}</span>
        {item.summary.dataProvenance ? (
          <span className="text-xs text-neutral-500">Provenance: {item.summary.dataProvenance}</span>
        ) : null}
      </div>

      {item.showEmailMentionLabel ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Email mention only — verify in Buildium once integrated.
        </p>
      ) : null}

      {item.subject ? (
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">Subject:</span> {item.subject}
        </p>
      ) : null}

      {item.summary.keyFacts && item.summary.keyFacts.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {item.summary.keyFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}

      {item.summary.requiredAction ? (
        <p className="mt-3 text-sm text-neutral-800">
          <span className="font-medium">Required action:</span> {item.summary.requiredAction}
        </p>
      ) : null}

      {item.summary.suggestedReplyNotes ? (
        <p className="mt-2 text-sm text-neutral-600">
          <span className="font-medium text-neutral-800">Suggested reply notes:</span>{" "}
          {item.summary.suggestedReplyNotes}
        </p>
      ) : null}

      {dueLabel ? (
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-medium">Due:</span> {dueLabel}
        </p>
      ) : null}

      {item.emailThreadId ? (
        <div className="mt-3">
          <Link
            href={`/inbox/${item.emailThreadId}`}
            prefetch={false}
            className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
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
      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
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
          <h3 className="text-sm font-semibold text-neutral-900">
            {group.category === "RENT_DEPOSIT" ? (
              <>
                Rent / deposit{" "}
                <span className="font-normal text-neutral-500">(email mentions)</span>
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
