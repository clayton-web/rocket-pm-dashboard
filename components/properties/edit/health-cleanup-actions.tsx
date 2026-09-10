"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveNextHealthCleanupPropertyAction } from "@/app/(dashboard)/properties/actions";
import { serializeCleanupFiltersParam } from "@/lib/property/portfolio-health-cleanup-filters";
import { propertyEditSectionAnchor } from "@/lib/property/portfolio-health-edit-targets";
import {
  buildHealthEditPropertyHref,
  buildHealthReturnUrl,
  type HealthViewState,
} from "@/lib/property/portfolio-health-return";

/**
 * Save-and-return / save-and-next controls for a property edited from Property Health.
 *
 * Shared by every extracted edit section so the cleanup loop behaves identically wherever a Fix
 * action lands. `save` is the section's own submit path, so validation, error reporting and the
 * server action stay owned by the section; this component only decides where to go afterwards.
 */
export function HealthCleanupActions({
  propertyId,
  context,
  disabled,
  save,
  onError,
}: {
  propertyId: string;
  context: HealthViewState;
  disabled: boolean;
  /** Resolves true when the save succeeded. Navigation only happens on success. */
  save: () => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = disabled || pending;

  function onSaveAndReturn() {
    startTransition(async () => {
      if (!(await save())) return;
      router.push(buildHealthReturnUrl(context));
    });
  }

  function onSaveAndNext() {
    startTransition(async () => {
      if (!(await save())) return;
      const result = await resolveNextHealthCleanupPropertyAction(propertyId, {
        filters: serializeCleanupFiltersParam(context.filters),
        query: context.query,
        status: context.status,
        sort: context.sort,
      });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      if (result.next) {
        router.push(
          buildHealthEditPropertyHref(result.next.propertyId, context, {
            anchor: propertyEditSectionAnchor(result.next.section),
            field: result.next.field,
          }),
        );
        return;
      }
      // Queue drained for the current worklist state.
      router.push(buildHealthReturnUrl(context, { cleanupDone: "1" }));
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={onSaveAndReturn}
        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save & return to Health"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSaveAndNext}
        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save & next property
      </button>
    </>
  );
}
