import Link from "next/link";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { TenantMaintenanceDetailPanel } from "@/components/portal/tenant-maintenance-card";
import { PortalPageHeader } from "@/components/portal/ui";
import { getTenantMaintenanceForSession } from "@/lib/portal/tenant-maintenance";
import { tenantPortalLoginHref } from "@/lib/portal/portal-login-redirect";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function TenantMaintenanceDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect(tenantPortalLoginHref(`/portal/maintenance/${requestId}`));
  }
  const request = await getTenantMaintenanceForSession(session, requestId);
  if (!request) {
    notFound();
  }

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to my requests" href="/portal/maintenance" />
      <PortalPageHeader
        eyebrow="Maintenance"
        title="Request details"
        description="Tenant-safe summary only. For urgent updates, contact your property manager."
      />

      <div className="mt-6">
        <TenantMaintenanceDetailPanel request={request} />
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        <Link href="/portal/maintenance/new" className="font-medium underline">
          Report another issue
        </Link>
      </p>
    </div>
  );
}
