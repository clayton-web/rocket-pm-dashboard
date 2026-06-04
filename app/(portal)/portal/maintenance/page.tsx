import Link from "next/link";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { TenantMaintenanceCard } from "@/components/portal/tenant-maintenance-card";
import { PortalPageHeader, SURFACE_CARD } from "@/components/portal/ui";
import { listTenantMaintenanceForSession } from "@/lib/portal/tenant-maintenance";
import { tenantPortalLoginHref } from "@/lib/portal/portal-login-redirect";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { redirect } from "next/navigation";

export default async function TenantMaintenanceListPage() {
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect(tenantPortalLoginHref("/portal/maintenance"));
  }

  const requests = await listTenantMaintenanceForSession(session);

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
      <PortalPageHeader
        eyebrow="Maintenance"
        title="My maintenance requests"
        description="Requests for your home or submitted under your contact. Staff-only notes and assignment details are not shown."
      />

      {requests.length === 0 ? (
        <p className={`${SURFACE_CARD} mt-6 px-4 py-5 text-sm text-neutral-600`}>
          No requests yet.{" "}
          <Link href="/portal/maintenance/new" className="font-medium text-neutral-900 underline">
            Submit maintenance
          </Link>
        </p>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3 p-0">
          {requests.map((request) => (
            <li key={request.id}>
              <TenantMaintenanceCard
                request={request}
                detailHref={`/portal/maintenance/${request.id}`}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-neutral-600">
        Prefer reference lookup?{" "}
        <Link href="/portal/maintenance/status" className="font-medium underline">
          Check status by reference
        </Link>
      </p>
    </div>
  );
}
