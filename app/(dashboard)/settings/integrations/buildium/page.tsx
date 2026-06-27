import { redirect } from "next/navigation";
import { BuildiumSettingsForm } from "@/components/integrations/buildium-settings-form";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getBuildiumSettingsView } from "@/lib/integrations/buildium/buildium-queries";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";

export default async function BuildiumIntegrationSettingsPage() {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    redirect("/login");
  }

  const canEdit = hasOrgWidePropertyRights(ctx);
  const settings = await getBuildiumSettingsView({
    organizationId: ctx.organizationId,
    canEdit,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Buildium integration</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Connect Buildium as the accounting source of truth for {settings.organizationName}. Phase 1
          supports credential storage and connection testing only — no sync or writes to Buildium.
        </p>
      </div>

      <BuildiumSettingsForm initialSettings={settings} />
    </div>
  );
}
