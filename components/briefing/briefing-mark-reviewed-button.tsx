"use client";

import { markBriefingReviewedAction } from "@/app/(dashboard)/briefing/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BriefingMarkReviewedButton({
  runId,
  reviewedAt,
}: {
  runId: string;
  reviewedAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (reviewedAt) {
    return (
      <p className="text-sm text-neutral-600">
        Reviewed {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(reviewedAt))}
      </p>
    );
  }

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await markBriefingReviewedAction({ runId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Mark reviewed"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
