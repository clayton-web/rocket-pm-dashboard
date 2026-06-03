"use client";

import {
  advanceTenancyStatusAction,
  setTenancyContactPortalAccessAction,
} from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  formatTenancyStatus,
  type TenancyStaffDetail,
} from "@/lib/leasing/tenancy-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatContactType(type: string) {
  if (type === "co_tenant") return "Co-tenant";
  if (type === "emergency_contact") return "Emergency contact";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function TenancyDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: TenancyStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/tenancies" className="text-sm font-medium text-neutral-700 underline">
            ← Back to tenancies
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Tenancy not found."}</InlineNotice>
      </div>
    );
  }

  return <TenancyDetailBody detail={initialDetail} />;
}

function TenancyDetailBody({ detail }: { detail: TenancyStaffDetail }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusPending, startStatusTransition] = useTransition();
  const [contactPendingId, setContactPendingId] = useState<string | null>(null);
  const [contactPending, startContactTransition] = useTransition();

  const primaryContact =
    detail.contacts.find((c) => c.contactType === "tenant") ?? detail.contacts[0];
  const tenantName = primaryContact
    ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ").trim() ||
      primaryContact.email
    : "Tenancy";

  function onAdvanceStatus() {
    setActionError(null);
    startStatusTransition(async () => {
      const result = await advanceTenancyStatusAction(detail.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onTogglePortal(contactId: string, enabled: boolean) {
    setActionError(null);
    setContactPendingId(contactId);
    startContactTransition(async () => {
      const result = await setTenancyContactPortalAccessAction(contactId, enabled);
      setContactPendingId(null);
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
        <Link href="/leasing/tenancies" className="text-sm font-medium text-neutral-700 underline">
          ← Back to tenancies
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{tenantName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {detail.propertyName} · {detail.unitLabel}
        </p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className={`${SURFACE_CARD} mb-6 px-4 py-4`}>
        <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
          {formatTenancyStatus(detail.status)}
        </span>
        {detail.archivedAt ? (
          <p className="mt-3 text-sm text-neutral-600">
            Archived {formatDateTime(detail.archivedAt)}
          </p>
        ) : null}
      </div>

      {detail.status === "notice_received" && detail.acceptedNoticeId ? (
        <div className={`${SURFACE_CARD} mb-6 px-4 py-4 text-sm text-neutral-700`}>
          <p>
            Schedule move-out from the{" "}
            <Link
              href={`/leasing/notices/${detail.acceptedNoticeId}`}
              className="font-medium text-neutral-900 underline"
            >
              accepted tenant notice
            </Link>{" "}
            before advancing lifecycle status.
          </p>
        </div>
      ) : null}

      {detail.advanceStatusLabel && detail.nextStatus ? (
        <div className="mb-8">
          <FormSection legend="Lifecycle">
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={statusPending}
              onClick={onAdvanceStatus}
            >
              {statusPending ? "Updating…" : detail.advanceStatusLabel}
            </PrimaryButton>
            {detail.nextStatus === "active" ? (
              <p className="mt-3 text-sm text-neutral-600">
                Marking active allows tenant portal sign-in when portal access is enabled on a
                contact (see below).
              </p>
            ) : null}
          </FormSection>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Lease">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Application">
              <Link
                href={`/leasing/applications/${detail.applicationId}`}
                className="font-medium underline"
              >
                {detail.applicationId}
              </Link>
            </DetailRow>
            <DetailRow label="Lease start">{formatDate(detail.leaseStartDate)}</DetailRow>
            <DetailRow label="Lease end">{formatDate(detail.leaseEndDate)}</DetailRow>
            <DetailRow label="Move-in">{formatDate(detail.moveInDate)}</DetailRow>
            <DetailRow label="Scheduled move-out">{formatDate(detail.moveOutDate)}</DetailRow>
            {detail.requestedMoveOutDate ? (
              <DetailRow label="Requested move-out (notice)">
                {formatDate(detail.requestedMoveOutDate)}
                {detail.acceptedNoticeId ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/leasing/notices/${detail.acceptedNoticeId}`}
                      className="font-medium underline"
                    >
                      View notice
                    </Link>
                  </>
                ) : null}
              </DetailRow>
            ) : null}
            <DetailRow label="Monthly rent">${detail.monthlyRent}</DetailRow>
            <DetailRow label="Security deposit">${detail.securityDeposit}</DetailRow>
            <DetailRow label="Pet deposit">
              {detail.petDeposit != null ? `$${detail.petDeposit}` : "—"}
            </DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Contacts & portal access">
          <p className="text-sm text-neutral-600">
            Tenant portal sign-in requires portal access to be enabled on the contact, the tenancy
            status to be <span className="font-medium">Active</span>, and the tenant to use the same
            email address stored on this contact.
          </p>
          {detail.contacts.length === 0 ? (
            <InlineNotice className="mt-3">No contacts on this tenancy.</InlineNotice>
          ) : (
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
              {detail.contacts.map((contact) => {
                const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
                const toggling = contactPending && contactPendingId === contact.id;
                return (
                  <li key={contact.id} className={`${SURFACE_CARD} px-4 py-4`}>
                    <p className="text-sm font-semibold text-neutral-900">{name || contact.email}</p>
                    <p className="mt-1 text-sm text-neutral-600">{contact.email}</p>
                    {contact.phone ? (
                      <p className="mt-1 text-sm text-neutral-600">{contact.phone}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-neutral-600">
                      <span className="text-neutral-500">Role · </span>
                      {formatContactType(contact.contactType)}
                    </p>
                    <p className="mt-2 text-sm text-neutral-700">
                      <span className="text-neutral-500">Portal access · </span>
                      {contact.portalAccessEnabled ? "Enabled" : "Disabled"}
                    </p>
                    {contact.portalAccessEnabled && detail.status !== "active" ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        Login will not work until this tenancy is Active.
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {contact.portalAccessEnabled ? (
                        <PrimaryButton
                          type="button"
                          className="!w-auto px-4 text-sm"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, false)}
                        >
                          {toggling ? "Updating…" : "Disable portal access"}
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          type="button"
                          className="!w-auto px-4 text-sm"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, true)}
                        >
                          {toggling ? "Updating…" : "Enable portal access"}
                        </PrimaryButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FormSection>

        <FormField label="Reference" htmlFor="tenancy-ref">
          <p id="tenancy-ref" className="font-mono text-xs text-neutral-600">
            Tenancy · {detail.id}
          </p>
        </FormField>
      </div>
    </div>
  );
}
