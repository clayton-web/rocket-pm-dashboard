"use client";

import { submitTenantNoticeAction } from "@/app/(portal)/portal/notice/actions";
import {
  FormField,
  FormSection,
  InlineAlert,
  PortalPageHeader,
  PrimaryButton,
  StickyFormFooter,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import type { TenantNoticeFormContext } from "@/lib/portal/tenant-notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

function formatSubmittedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDisplayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

export function TenantNoticePendingView({
  pending,
}: {
  pending: {
    id: string;
    tenantRequestedMoveOutDate: string;
    createdAt: string;
    body: string;
  };
}) {
  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
      <PortalPageHeader
        eyebrow="Notice"
        title="Notice submitted"
        description="Your property manager will review this notice and follow up with you."
      />
      <div className={`mt-6 ${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-4 text-sm text-neutral-700`}>
        <p>
          <span className="text-neutral-500">Requested tenancy end · </span>
          {formatDisplayDate(pending.tenantRequestedMoveOutDate)}
        </p>
        <p>
          <span className="text-neutral-500">Submitted · </span>
          {formatSubmittedAt(pending.createdAt)}
        </p>
        <p>
          <span className="text-neutral-500">Reference · </span>
          <span className="font-mono text-xs">{pending.id}</span>
        </p>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/portal/dashboard" className="font-medium text-neutral-800 underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

export function TenantNoticeForm({
  context,
}: {
  context: TenantNoticeFormContext;
}) {
  const router = useRouter();
  const moveOutId = useId();
  const messageId = useId();
  const [moveOutDate, setMoveOutDate] = useState(
    context.allowedMoveOutDates[0]?.value ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
        <PortalPageHeader
          eyebrow="Notice"
          title="Thank you"
          description="Your notice to end tenancy has been submitted. Your property manager will review it and follow up with you."
        />
        <p className="mt-6 text-sm">
          <Link href="/portal/dashboard" className="font-medium text-neutral-800 underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!moveOutDate) {
      setError("Please select your requested tenancy end date.");
      return;
    }

    startTransition(async () => {
      const result = await submitTenantNoticeAction(moveOutDate, message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      router.refresh();
    });
  }

  return (
    <div className="pb-24 pt-1">
      <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Notice to end tenancy"
        description={`${context.propertyName} · ${context.unitLabel}. Select the date you intend to end your tenancy.`}
      />

      <form className="flex flex-col gap-8" onSubmit={onSubmit} noValidate>
        <div className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700`}>
          <p>
            Rent is due on day <span className="font-medium">{context.rentDueDay}</span> of each
            month. The earliest date you can select is{" "}
            <span className="font-medium">{formatDisplayDate(context.earliestMoveOutDate)}</span>.
          </p>
        </div>

        <FormField
          htmlFor={moveOutId}
          label="Requested tenancy end date"
          helper="Must be on a rental-period boundary with full notice."
        >
          <select
            id={moveOutId}
            value={moveOutDate}
            onChange={(e) => setMoveOutDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            required
          >
            {context.allowedMoveOutDates.length === 0 ? (
              <option value="">No dates available</option>
            ) : (
              context.allowedMoveOutDates.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            )}
          </select>
        </FormField>

        <FormField
          htmlFor={messageId}
          label="Message to property manager (optional)"
          helper="Share any context your property manager should know."
        >
          <textarea
            id={messageId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="min-h-[6rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <FormSection legend="Before you submit">
          <p className="text-sm text-neutral-600">
            Submitting this form sends your notice to your property manager for review. They will
            confirm next steps with you.
          </p>
        </FormSection>

        <StickyFormFooter>
          <PrimaryButton type="submit" disabled={pending || context.allowedMoveOutDates.length === 0}>
            {pending ? "Submitting…" : "Submit notice"}
          </PrimaryButton>
        </StickyFormFooter>
      </form>
    </div>
  );
}
