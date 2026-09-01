import { buttonClasses } from "@/components/portal/button";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { PortalPageHeader, SURFACE_CARD, SURFACE_PANEL } from "@/components/portal/ui";
import { listTenantDocumentsForSession } from "@/lib/portal/tenant-documents";
import { tenantPortalLoginHref } from "@/lib/portal/portal-login-redirect";
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
    redirect(tenantPortalLoginHref("/portal/documents"));
  }

  const documents = await listTenantDocumentsForSession(session);

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
      <PortalPageHeader
        eyebrow="Documents"
        title="Lease & agreements"
        description="Signed lease documents for your active tenancy. Available after your property manager activates your tenancy."
      />

      {documents.length === 0 ? (
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4 text-sm text-foreground-muted`}>
          <p>No signed lease documents are available yet.</p>
          <p className="mt-3 text-foreground-muted">
            If you have not signed in before, confirm your property manager has marked your tenancy
            active. If you recently signed your lease, they may still be completing execution.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3 p-0">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div className={`${SURFACE_CARD} px-4 py-4`}>
                <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                <p className="mt-1 text-sm text-foreground-muted">Created {formatDate(doc.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={doc.downloadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: "primary" })}
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
