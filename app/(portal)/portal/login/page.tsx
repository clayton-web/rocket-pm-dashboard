import { PortalBackLink } from "@/components/portal/portal-nav";
import { PortalPageHeader } from "@/components/portal/ui";
import { TenantLoginForm } from "@/components/portal/tenant-login-form";
import { resolveTenantPortalLoginRedirect } from "@/lib/portal/portal-login-redirect";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function TenantPortalLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const redirectTo = resolveTenantPortalLoginRedirect(next);
  const session = await getVerifiedTenantSession();
  if (session) {
    redirect(redirectTo);
  }

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Sign in"
        description="Use the email on your lease with portal access enabled. Sign-in works after your property manager marks the tenancy active. Lease signing before activation uses the secure email link, not this login page."
      />
      <TenantLoginForm next={next} />
    </div>
  );
}
