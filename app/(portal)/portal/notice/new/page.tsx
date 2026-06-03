import { TenantNoticeForm, TenantNoticePendingView } from "@/components/portal/tenant-notice-form";
import { PortalPageHeader, SURFACE_PANEL } from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import {
  getPendingTenantNoticeForSession,
  getTenantNoticeFormContext,
} from "@/lib/portal/tenant-notice";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TenantNoticeNewPage() {
  const session = await getVerifiedTenantSession();
  if (!session) {
    redirect("/portal/login");
  }

  const pending = await getPendingTenantNoticeForSession(session);
  if (pending) {
    return <TenantNoticePendingView pending={pending} />;
  }

  const context = await getTenantNoticeFormContext(session);
  if (!context) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink label="Back to dashboard" href="/portal/dashboard" />
        <PortalPageHeader
          eyebrow="Notice"
          title="Notice not available"
          description="Notice to end tenancy can only be submitted while your tenancy is active."
        />
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4 text-sm text-neutral-700`}>
          <p>
            If you need help, contact your property manager. You can still use maintenance and
            other portal features when your tenancy is active.
          </p>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/portal/dashboard" className="font-medium underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  return <TenantNoticeForm context={context} />;
}
