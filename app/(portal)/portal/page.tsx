import { PortalPageHeader, SURFACE_CARD } from "@/components/portal/ui";
import Link from "next/link";

const links = [
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
] as const;

export default function TenantPortalHomePage() {
  return (
    <div className="pb-14 pt-1">
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Welcome"
        description="Self-service for maintenance and documents. You do not need a staff login to use these pages."
      />

      <ul className="mt-8 flex list-none flex-col gap-3 p-0">
        {links.map((item) => (
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
