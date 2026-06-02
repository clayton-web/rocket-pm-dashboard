import Link from "next/link";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { PortalPageHeader, SURFACE_CARD } from "@/components/portal/ui";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { redirect } from "next/navigation";

export default async function TenantPortalDashboardPage() {
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect("/portal/login");
  }

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink label="Back to portal home" />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title={`Hello, ${session.firstName}`}
        description="You are signed in. Maintenance intake and reference lookup remain available without signing in."
      />

      <div className={`${SURFACE_CARD} mt-6 space-y-3 p-5 text-sm text-neutral-700`}>
        <p>
          <span className="font-medium text-neutral-900">Email:</span> {session.email}
        </p>
        <p>
          <span className="font-medium text-neutral-900">Tenancy:</span>{" "}
          <span className="font-mono text-xs">{session.tenancyId}</span>
        </p>
        <p className="text-xs text-neutral-500">
          Document access and signed-in maintenance history are not enabled yet.
        </p>
      </div>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        <li>
          <Link href="/portal/maintenance/status" className="font-medium text-neutral-800 underline">
            Check maintenance status
          </Link>
        </li>
        <li>
          <Link href="/portal/maintenance/new" className="font-medium text-neutral-800 underline">
            Submit maintenance
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
