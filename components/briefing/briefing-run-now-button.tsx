"use client";

import { runBriefingNowAction } from "@/app/(dashboard)/briefing/actions";
import { Button } from "@/components/portal/button";
import type { BriefingSlot } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BriefingRunNowButton({
  slot,
  disabled,
}: {
  slot: BriefingSlot;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await runBriefingNowAction({ slot });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" onClick={onClick} disabled={disabled || pending}>
        {pending ? "Queueing…" : "Run briefing now"}
      </Button>
      {error ? (
        <p className="text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
