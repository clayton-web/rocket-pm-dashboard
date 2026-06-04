import { PortalBackLink } from "@/components/portal/portal-nav";
import { PortalPageHeader, SURFACE_CARD, SURFACE_PANEL } from "@/components/portal/ui";
import { listTenantDocumentsForSession } from "@/lib/portal/tenant-documents";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function TenantDocumentsPage() {
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect("/portal/login?next=/portal/documents");
  }

  const documents = await listTenantDocumentsForSession(session);

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
      <PortalPageHeader
        eyebrow="Documents"
        title="Lease & agreements"
        description="Signed lease documents for your active tenancy. Draft or unsigned files are not shown here."
      />

      {documents.length === 0 ? (
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4 text-sm text-neutral-700`}>
          <p>No signed lease documents are available yet.</p>
          <p className="mt-3 text-neutral-600">
            If you recently signed your lease, your property manager may still be completing
            execution. Contact them if you need a copy today.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3 p-0">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div className={`${SURFACE_CARD} px-4 py-4`}>
                <p className="text-sm font-semibold text-neutral-900">{doc.title}</p>
                <p className="mt-1 text-sm text-neutral-600">Created {formatDate(doc.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={doc.downloadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    View / download
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
