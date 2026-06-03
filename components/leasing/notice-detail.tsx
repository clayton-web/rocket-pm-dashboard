"use client";

import { acceptTenantNoticeAction } from "@/app/(dashboard)/leasing/notices/actions";
import {
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import type { NoticeStaffDetail } from "@/lib/leasing/notice-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function NoticeDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: NoticeStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/notices" className="text-sm font-medium text-neutral-700 underline">
            ← Back to notices
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Notice not found."}</InlineNotice>
      </div>
    );
  }

  return <NoticeDetailBody detail={initialDetail} />;
}

function NoticeDetailBody({ detail }: { detail: NoticeStaffDetail }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptPending, startAcceptTransition] = useTransition();

  function onAccept() {
    setActionError(null);
    startAcceptTransition(async () => {
      const result = await acceptTenantNoticeAction(detail.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4">
        <Link href="/leasing/notices" className="text-sm font-medium text-neutral-700 underline">
          ← Back to notices
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{detail.tenantLabel}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {detail.propertyName} · {detail.unitLabel}
        </p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className={`${SURFACE_CARD} mb-6 px-4 py-4`}>
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
            detail.canAccept
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-neutral-300 bg-white text-neutral-800"
          }`}
        >
          {detail.canAccept ? "Pending review" : "Reviewed"}
        </span>
        <p className="mt-3 text-sm text-neutral-600">
          Tenancy status · {formatTenancyStatus(detail.tenancyStatus)}
        </p>
      </div>

      {detail.canAccept ? (
        <div className="mb-8">
          <FormSection legend="Review">
            <p className="text-sm text-neutral-600">
              Accepting records the notice and updates the tenancy to notice received. Follow up
              with the tenant on move-out details.
            </p>
            <PrimaryButton
              type="button"
              className="mt-4 !w-auto px-6"
              disabled={acceptPending}
              onClick={onAccept}
            >
              {acceptPending ? "Accepting…" : "Accept notice"}
            </PrimaryButton>
          </FormSection>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Notice">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Submitted">{formatDateTime(detail.submittedAt)}</DetailRow>
            <DetailRow label="Requested tenancy end">
              {formatDate(detail.tenantRequestedMoveOutDate)}
            </DetailRow>
            <DetailRow label="Title">{detail.title}</DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Tenant message">
          <div className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700 whitespace-pre-wrap`}>
            {detail.body}
          </div>
        </FormSection>

        <FormSection legend="Links">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            {detail.tenantEmail ? (
              <DetailRow label="Email">{detail.tenantEmail}</DetailRow>
            ) : null}
            <DetailRow label="Tenancy">
              <Link
                href={`/leasing/tenancies/${detail.tenancyId}`}
                className="font-medium underline"
              >
                View tenancy
              </Link>
            </DetailRow>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
