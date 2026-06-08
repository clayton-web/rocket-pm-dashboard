import { updateThreadCategoryAction } from "@/app/(dashboard)/inbox/[threadId]/actions";
import { isClassificationReviewThread } from "@/lib/inbox/classification-review";
import {
  EMAIL_THREAD_CATEGORY_DESCRIPTIONS,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
} from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

function formatCategorySource(source: string | null) {
  if (!source) return "—";
  if (source === "manual") return "Manual";
  if (source === "ai") return "AI";
  if (source === "rule") return "Rule";
  return source;
}

function formatConfidence(confidence: number | null) {
  if (confidence == null) return "—";
  return `${Math.round(confidence * 100)}%`;
}

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export function ThreadCategoryPanel(props: {
  threadId: string;
  category: EmailThreadCategory;
  categorySource: string | null;
  categoryUpdatedAt: Date | null;
  categoryConfidence: number | null;
  categoryAiReason: string | null;
  lastClassificationAttemptAt: Date | null;
}) {
  const description = EMAIL_THREAD_CATEGORY_DESCRIPTIONS[props.category];
  const needsClassificationReview = isClassificationReviewThread({
    category: props.category,
    categorySource: props.categorySource,
    lastClassificationAttemptAt: props.lastClassificationAttemptAt,
  });
  const showClassificationMetadata =
    props.lastClassificationAttemptAt != null ||
    props.categorySource != null ||
    props.categoryConfidence != null ||
    props.categoryAiReason != null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Inbox crate</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Move this thread between dashboard crates. This does not change Gmail labels or folders.
      </p>

      <p className="mt-3 text-xs text-neutral-500">{description}</p>

      {props.categorySource === "manual" && props.categoryUpdatedAt ? (
        <p className="mt-2 text-[11px] text-neutral-400">
          Last updated manually {formatDateTime(props.categoryUpdatedAt)}
        </p>
      ) : null}

      {showClassificationMetadata ? (
        <div className="mt-4 space-y-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5">
          <h3 className="text-xs font-semibold text-neutral-800">Classification</h3>
          {needsClassificationReview ? (
            <p className="text-xs text-violet-900">
              The classifier attempted this thread but left it uncategorized. Choose a crate below.
            </p>
          ) : null}
          <dl className="space-y-1.5 text-xs">
            <div>
              <dt className="text-neutral-500">Source</dt>
              <dd className="text-neutral-800">{formatCategorySource(props.categorySource)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Confidence</dt>
              <dd className="text-neutral-800">{formatConfidence(props.categoryConfidence)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Last attempt</dt>
              <dd className="text-neutral-800">{formatDateTime(props.lastClassificationAttemptAt)}</dd>
            </div>
            {props.categoryAiReason ? (
              <div>
                <dt className="text-neutral-500">Reason</dt>
                <dd className="whitespace-pre-wrap text-neutral-800">{props.categoryAiReason}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <form action={updateThreadCategoryAction} className="mt-4 space-y-1">
        <input type="hidden" name="threadId" value={props.threadId} />
        <label htmlFor="thread-category" className="block text-xs font-medium text-neutral-700">
          Category
        </label>
        <div className="flex gap-2">
          <select
            id="thread-category"
            name="category"
            required
            defaultValue={props.category}
            className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-xs"
          >
            {INBOX_CRATE_ORDER.map((category) => (
              <option key={category} value={category}>
                {EMAIL_THREAD_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="shrink-0 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium hover:bg-neutral-50"
          >
            Move
          </button>
        </div>
      </form>
    </section>
  );
}
