import { PortalBackLink } from "@/components/portal/portal-nav";
import { PortalPageHeader } from "@/components/portal/ui";
import { TenantLoginForm } from "@/components/portal/tenant-login-form";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { redirect } from "next/navigation";

export default async function TenantPortalLoginPage() {
  const session = await getVerifiedTenantSession();
  if (session) {
    redirect("/portal/dashboard");
  }

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Sign in"
        description="Use the email on your lease with portal access enabled. We will send a one-time code (shown in dev until email delivery is wired)."
      />
      <TenantLoginForm />
    </div>
  );
}
