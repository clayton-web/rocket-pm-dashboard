"use client";

import { runBriefingNowAction } from "@/app/(dashboard)/briefing/actions";
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
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Queueing…" : "Run briefing now"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
