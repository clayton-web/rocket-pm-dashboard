"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateThreadCategoryAction,
  type UpdateThreadCategoryState,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import { isClassificationReviewThread } from "@/lib/inbox/classification-review";
import {
  EMAIL_THREAD_CATEGORY_DESCRIPTIONS,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
} from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

const initialState: UpdateThreadCategoryState = {
  error: null,
  successMessage: null,
  completedAt: 0,
};

function formatCategorySource(source: string | null) {
  if (!source) return "Not set";
  if (source === "manual") return "Manual";
  if (source === "ai") return "AI";
  if (source === "rule") return "Sender memory";
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
  const router = useRouter();
  const lastCompleted = useRef(0);
  const [state, formAction, isPending] = useActionState(updateThreadCategoryAction, initialState);

  const needsClassificationReview = isClassificationReviewThread({
    category: props.category,
    categorySource: props.categorySource,
    lastClassificationAttemptAt: props.lastClassificationAttemptAt,
  });
  const isManual = props.categorySource === "manual";
  const showClassificationMetadata =
    !isManual &&
    (props.lastClassificationAttemptAt != null ||
      props.categorySource != null ||
      props.categoryConfidence != null ||
      props.categoryAiReason != null);

  useEffect(() => {
    if (state.completedAt === 0 || state.completedAt === lastCompleted.current) return;
    lastCompleted.current = state.completedAt;
    if (state.successMessage) {
      router.refresh();
    }
  }, [state.completedAt, state.successMessage, router]);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Move to crate</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Reclassify this thread in Rocket PM. Gmail labels and folders are not changed.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">Current crate</span>
        <span className="inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-900">
          {EMAIL_THREAD_CATEGORY_LABELS[props.category]}
        </span>
        {isManual ? (
          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900">
            Manually categorized
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-neutral-500">{EMAIL_THREAD_CATEGORY_DESCRIPTIONS[props.category]}</p>

      {isManual && props.categoryUpdatedAt ? (
        <p className="mt-2 text-[11px] text-neutral-400">
          Last updated manually {formatDateTime(props.categoryUpdatedAt)}
        </p>
      ) : null}

      {showClassificationMetadata ? (
        <div className="mt-4 space-y-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5">
          <h3 className="text-xs font-semibold text-neutral-800">Classifier details</h3>
          {needsClassificationReview ? (
            <p className="text-xs text-violet-900">
              The classifier attempted this thread but left it uncategorized. Choose the correct crate
              below.
            </p>
          ) : props.categorySource === "ai" || props.categorySource === "rule" ? (
            <p className="text-xs text-neutral-700">
              This crate was assigned automatically. Choose a different crate below if it looks wrong.
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

      {state.error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.successMessage ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {state.successMessage}
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-1">
        <input type="hidden" name="threadId" value={props.threadId} />
        <label htmlFor="thread-category" className="block text-xs font-medium text-neutral-700">
          Move to crate
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
            disabled={isPending}
            className="shrink-0 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {isPending ? "Moving…" : "Move to crate"}
          </button>
        </div>
      </form>
    </section>
  );
}
