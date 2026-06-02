import { PortalPageHeader, SURFACE_PANEL } from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";

export default function TenantDocumentsPage() {
  return (
    <div className="pb-14 pt-1">
      <PortalBackLink />
      <PortalPageHeader
        eyebrow="Documents"
        title="Lease & shared files"
        description="Secure document access for tenants is coming in a future release."
      />
      <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4 text-sm text-neutral-700`}>
        <p>
          You will be able to view your lease and property-related documents here after tenant sign-in is
          enabled. We do not list documents publicly without authentication.
        </p>
        <p className="mt-3 text-neutral-600">
          If you need a copy of your lease today, contact your property manager using the email on your
          welcome notice.
        </p>
      </div>
    </div>
  );
}
