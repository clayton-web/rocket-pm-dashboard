import {
  updateThreadCategoryAction,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import {
  EMAIL_THREAD_CATEGORY_DESCRIPTIONS,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
} from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

export function ThreadCategoryPanel(props: {
  threadId: string;
  category: EmailThreadCategory;
  categorySource: string | null;
  categoryUpdatedAt: Date | null;
}) {
  const description = EMAIL_THREAD_CATEGORY_DESCRIPTIONS[props.category];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Inbox crate</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Move this thread between dashboard crates. This does not change Gmail labels or folders.
      </p>

      <p className="mt-3 text-xs text-neutral-500">{description}</p>

      {props.categorySource === "manual" && props.categoryUpdatedAt ? (
        <p className="mt-2 text-[11px] text-neutral-400">
          Last updated manually{" "}
          {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
            props.categoryUpdatedAt,
          )}
        </p>
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
