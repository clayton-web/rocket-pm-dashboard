import { SURFACE_CARD } from "@/components/portal/ui";
import type { TenantPhotoPlaceholder } from "./types";

export type TenantReportSectionProps = {
  description: string;
  photos: TenantPhotoPlaceholder[];
  accessInstructions: string;
};

export function TenantReportSection({ description, photos, accessInstructions }: TenantReportSectionProps) {
  return (
    <section className={`${SURFACE_CARD} p-4`} aria-labelledby="tenant-report-heading">
      <h2 id="tenant-report-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Tenant report
      </h2>
      <p className="mt-4 text-sm font-semibold text-neutral-900">Description</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{description}</p>
      <p className="mt-5 text-sm font-semibold text-neutral-900">Photos</p>
      {photos.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-600">No photos were submitted.</p>
      ) : (
        <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
          {photos.map((p) => (
            <li key={p.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
              {p.label}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-sm font-semibold text-neutral-900">Access instructions</p>
      <p className="mt-1 text-sm text-neutral-600">
        {accessInstructions.trim() ? accessInstructions : "No access instructions provided."}
      </p>
    </section>
  );
}
