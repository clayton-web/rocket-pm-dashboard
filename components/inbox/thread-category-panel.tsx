"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateThreadCategoryAction,
  type UpdateThreadCategoryState,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import { buttonClasses } from "@/components/portal/button";
import { formControlClasses } from "@/components/portal/form-control";
import { StatusBadge } from "@/components/portal/status-badge";
import { InlineNotice, SURFACE_PANEL } from "@/components/portal/ui";
import { isClassificationReviewThread } from "@/lib/inbox/classification-review";
import {
  EMAIL_THREAD_CATEGORY_DESCRIPTIONS,
  EMAIL_THREAD_CATEGORY_LABELS,
  INBOX_CRATE_ORDER,
} from "@/lib/inbox/email-thread-category";
import {
  legacyStringToAssignmentSourceLabel,
  type ThreadCategoryAssignment,
} from "@/lib/inbox/thread-category-assignments";
import type { EmailThreadCategory } from "@prisma/client";

const initialState: UpdateThreadCategoryState = {
  error: null,
  successMessage: null,
  completedAt: 0,
};

function formatConfidence(confidence: number | null) {
  if (confidence == null) return "—";
  return `${Math.round(confidence * 100)}%`;
}

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatAssignmentSource(source: ThreadCategoryAssignment["source"]) {
  switch (source) {
    case "MANUAL":
      return "Manual";
    case "AI":
      return "AI";
    case "APPROVED_RULE":
      return "Approved rule";
    case "RULE":
    default:
      return "Deterministic rule";
  }
}

export function ThreadCategoryPanel(props: {
  threadId: string;
  category: EmailThreadCategory;
  categories: EmailThreadCategory[];
  assignments: ThreadCategoryAssignment[];
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
    assignments: props.assignments,
  });
  const isManual = props.assignments.some((assignment) => assignment.source === "MANUAL");
  const showClassificationMetadata =
    !isManual &&
    (props.lastClassificationAttemptAt != null ||
      props.categorySource != null ||
      props.categoryConfidence != null ||
      props.categoryAiReason != null ||
      props.assignments.length > 0);

  useEffect(() => {
    if (state.completedAt === 0 || state.completedAt === lastCompleted.current) return;
    lastCompleted.current = state.completedAt;
    if (state.successMessage) {
      router.refresh();
    }
  }, [state.completedAt, state.successMessage, router]);

  return (
    <section className={`${SURFACE_PANEL} p-4`}>
      <h2 className="text-sm font-semibold text-foreground">Move to crate</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Reclassify this thread in Rocket PM. Gmail labels and folders are not changed.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground-subtle">Current crates</span>
        {props.categories.map((category) => (
          <span
            key={category}
            className="inline-flex items-center rounded-md border border-border-strong bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {EMAIL_THREAD_CATEGORY_LABELS[category]}
          </span>
        ))}
        {isManual ? (
          <StatusBadge tone="success">Manually categorized</StatusBadge>
        ) : null}
      </div>

      {props.categories.length === 1 ? (
        <p className="mt-2 text-xs text-foreground-subtle">{EMAIL_THREAD_CATEGORY_DESCRIPTIONS[props.categories[0]!]}</p>
      ) : null}

      {props.assignments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {props.assignments.map((assignment) => (
            <div
              key={`${assignment.category}-${assignment.source}`}
              className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs"
            >
              <div className="font-medium text-foreground">
                {EMAIL_THREAD_CATEGORY_LABELS[assignment.category]}
              </div>
              <div className="text-foreground-muted">Source: {formatAssignmentSource(assignment.source)}</div>
              {assignment.reason ? (
                <div className="mt-1 whitespace-pre-wrap text-foreground-muted">{assignment.reason}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {isManual && props.categoryUpdatedAt ? (
        <p className="mt-2 text-[11px] text-foreground-subtle">
          Last updated manually {formatDateTime(props.categoryUpdatedAt)}
        </p>
      ) : null}

      {showClassificationMetadata ? (
        <div className="mt-4 space-y-2 rounded-md border border-border bg-surface-muted px-3 py-2.5">
          <h3 className="text-xs font-semibold text-foreground">Classifier details</h3>
          {needsClassificationReview ? (
            <p className="text-xs text-warning-foreground">
              The classifier attempted this thread but left it uncategorized. Choose the correct crate
              below.
            </p>
          ) : props.categorySource === "ai" || props.categorySource === "rule" ? (
            <p className="text-xs text-foreground-muted">
              This crate was assigned automatically. Choose a different crate below if it looks wrong.
            </p>
          ) : null}
          <dl className="space-y-1.5 text-xs">
            <div>
              <dt className="text-foreground-subtle">Primary source</dt>
              <dd className="text-foreground">{legacyStringToAssignmentSourceLabel(props.categorySource)}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">Confidence</dt>
              <dd className="text-foreground">{formatConfidence(props.categoryConfidence)}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">Last attempt</dt>
              <dd className="text-foreground">{formatDateTime(props.lastClassificationAttemptAt)}</dd>
            </div>
            {props.categoryAiReason ? (
              <div>
                <dt className="text-foreground-subtle">Reason</dt>
                <dd className="whitespace-pre-wrap text-foreground">{props.categoryAiReason}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {state.error ? (
        <InlineNotice tone="danger" size="compact" role="alert" className="mt-4">
          {state.error}
        </InlineNotice>
      ) : null}
      {state.successMessage ? (
        <InlineNotice tone="success" size="compact" role="status" className="mt-4">
          {state.successMessage}
        </InlineNotice>
      ) : null}

      <form action={formAction} className="mt-4 space-y-1">
        <input type="hidden" name="threadId" value={props.threadId} />
        <label htmlFor="thread-category" className="block text-xs font-medium text-foreground-muted">
          Move to crate
        </label>
        <div className="flex gap-2">
          <select
            id="thread-category"
            name="category"
            required
            defaultValue={props.category}
            className={formControlClasses({ size: "xs", className: "min-w-0 flex-1" })}
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
            className={buttonClasses({ variant: "primary", size: "xs", className: "shrink-0" })}
          >
            {isPending ? "Moving…" : "Move to crate"}
          </button>
        </div>
      </form>
    </section>
  );
}
