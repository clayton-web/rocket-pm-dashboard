"use client";

import { generateRtb1DraftAction } from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { RTB1_TEMPLATE_VERSION } from "@/lib/leasing/rtb1/constants";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail-types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Rtb1DraftSection({ detail }: { detail: TenancyStaffDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canGenerate = detail.leaseSetupStatus === "ready_for_rtb1";

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateRtb1DraftAction(detail.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <FormSection legend="RTB-1 draft">
      <p className="text-sm text-neutral-600">
        Generate a filled draft BC Residential Tenancy Agreement (RTB-1 {RTB1_TEMPLATE_VERSION})
        from lease setup data. Draft PDFs are not signed or executed.
      </p>

      {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}

      {!canGenerate ? (
        <InlineNotice className="mt-4">
          RTB-1 draft generation is available when status is Ready For RTB-1 Generation.
        </InlineNotice>
      ) : (
        <PrimaryButton
          type="button"
          className="mt-4 !w-auto px-6"
          disabled={pending}
          onClick={onGenerate}
        >
          {pending ? "Generating…" : "Generate RTB-1 Draft"}
        </PrimaryButton>
      )}

      {detail.rtb1DraftDocuments.length > 0 ? (
        <ul className={`${SURFACE_PANEL} mt-4 divide-y divide-neutral-200`}>
          {detail.rtb1DraftDocuments.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-1 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">{doc.title}</p>
                <p className="text-xs text-neutral-500">
                  {doc.fileName} · {formatDateTime(doc.createdAt)}
                </p>
              </div>
              <a
                href={doc.downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-neutral-900 underline"
              >
                Preview / download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">No RTB-1 drafts generated yet.</p>
      )}
    </FormSection>
  );
}
