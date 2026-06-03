import Link from "next/link";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { TenantMaintenanceCard } from "@/components/portal/tenant-maintenance-card";
import { PortalPageHeader, SURFACE_CARD } from "@/components/portal/ui";
import { listTenantMaintenanceForSession } from "@/lib/portal/tenant-maintenance";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { redirect } from "next/navigation";

export default async function TenantPortalDashboardPage() {
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect("/portal/login");
  }

  const recentRequests = await listTenantMaintenanceForSession(session, { limit: 3 });

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to portal home" />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title={`Hello, ${session.firstName}`}
        description="You are signed in. Public maintenance intake and reference lookup remain available without signing in."
      />

      <Link
        href="/portal/notice/new"
        className={`${SURFACE_CARD} mt-6 block px-4 py-4 transition-colors hover:border-neutral-400`}
      >
        <span className="text-sm font-semibold text-neutral-900">Notice to end tenancy</span>
        <span className="mt-1 block text-sm text-neutral-600">
          Submit your intended move-out date for property manager review.
        </span>
      </Link>

      <Link
        href="/portal/maintenance"
        className={`${SURFACE_CARD} mt-4 block px-4 py-4 transition-colors hover:border-neutral-400`}
      >
        <span className="text-sm font-semibold text-neutral-900">My maintenance requests</span>
        <span className="mt-1 block text-sm text-neutral-600">
          View status for requests on your tenancy without entering a reference each time.
        </span>
      </Link>

      {recentRequests.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-900">Recent requests</h2>
          <ul className="mt-3 flex list-none flex-col gap-3 p-0">
            {recentRequests.map((request) => (
              <li key={request.id}>
                <TenantMaintenanceCard
                  request={request}
                  detailHref={`/portal/maintenance/${request.id}`}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/portal/maintenance" className="font-medium text-neutral-800 underline">
              View all
            </Link>
          </p>
        </section>
      ) : null}

      <ul className="mt-8 flex flex-col gap-2 text-sm text-neutral-700">
        <li>
          <Link href="/portal/notice/new" className="font-medium underline">
            Notice to end tenancy
          </Link>
        </li>
        <li>
          <Link href="/portal/maintenance/new" className="font-medium underline">
            Submit maintenance
          </Link>
        </li>
        <li>
          <Link href="/portal/maintenance/status" className="font-medium underline">
            Check status by reference (no sign-in)
          </Link>
        </li>
        <li>
          <Link href="/portal/documents" className="font-medium underline">
            Documents (coming soon)
          </Link>
        </li>
        <li>
          <Link href="/portal/logout" className="font-medium text-neutral-600 underline">
            Sign out
          </Link>
        </li>
      </ul>
    </div>
  );
}
