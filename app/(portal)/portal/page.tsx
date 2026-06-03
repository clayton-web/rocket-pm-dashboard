import { PortalPageHeader, SURFACE_CARD } from "@/components/portal/ui";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import Link from "next/link";

const publicLinks = [
  {
    href: "/portal/viewing",
    title: "Request a viewing",
    description: "Ask to tour a rental home. No account required.",
  },
  {
    href: "/portal/application",
    title: "Apply for a rental",
    description: "Submit a rental application. No account required.",
  },
  {
    href: "/portal/maintenance/new",
    title: "Submit a maintenance request",
    description: "Report an issue at your home. No account required.",
  },
  {
    href: "/portal/maintenance/status",
    title: "Check maintenance status",
    description: "Use your reference number and email from when you submitted.",
  },
  {
    href: "/portal/documents",
    title: "Lease & documents",
    description: "View signed leases and shared files (coming soon).",
  },
  {
    href: "/portal/login",
    title: "Sign in to your portal",
    description: "For tenants with portal access enabled on their contact record.",
  },
] as const;

const signedInLinks = [
  {
    href: "/portal/dashboard",
    title: "Go to dashboard",
    description: "Your signed-in home — maintenance history and account links.",
  },
  {
    href: "/portal/maintenance",
    title: "My maintenance requests",
    description: "View requests for your tenancy without a reference number.",
  },
] as const;

export default async function TenantPortalHomePage() {
  const session = await getVerifiedTenantSession();
  const links = session
    ? [...signedInLinks, ...publicLinks]
    : publicLinks;

  return (
    <div className="pb-14 pt-1">
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Welcome"
        description="Self-service for maintenance and documents. You do not need a staff login to use these pages."
      />

      {session ? (
        <p className={`${SURFACE_CARD} mb-6 px-4 py-3 text-sm text-neutral-700`}>
          Signed in as <span className="font-medium text-neutral-900">{session.email}</span>.{" "}
          <Link href="/portal/dashboard" className="font-medium underline">
            Go to dashboard
          </Link>{" "}
          ·{" "}
          <Link href="/portal/logout" className="font-medium underline">
            Sign out
          </Link>
        </p>
      ) : null}

      <ul className="mt-8 flex list-none flex-col gap-3 p-0">
        {links
          .filter((item) => !(session && item.href === "/portal/login"))
          .map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
            >
              <span className="text-sm font-semibold text-neutral-900">{item.title}</span>
              <span className="mt-1 block text-sm text-neutral-600">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
