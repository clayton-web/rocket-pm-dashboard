"use client";

import { markBriefingReviewedAction } from "@/app/(dashboard)/briefing/actions";
import { Button } from "@/components/portal/button";
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
      <p className="text-sm text-foreground-muted">
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
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Saving…" : "Mark reviewed"}
      </Button>
      {error ? (
        <p className="text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
