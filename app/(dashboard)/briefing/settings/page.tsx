import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefingSettingsForm } from "@/components/briefing/briefing-settings-form";
import { FOCUS_RING } from "@/components/portal/focus";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getBriefingSettingsView } from "@/lib/briefing/briefing-queries";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";

export default async function BriefingSettingsPage() {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    redirect("/login");
  }

  const settings = await getBriefingSettingsView({
    organizationId: ctx.organizationId,
    canEdit: hasOrgWidePropertyRights(ctx),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/briefing"
          prefetch={false}
          className={`rounded-sm text-sm font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
        >
          ← Daily Briefing
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-foreground">Daily Briefing settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Configure schedule, sources, and automation for {settings.organizationName}.
        </p>
      </div>

      <BriefingSettingsForm initialSettings={settings} />
    </div>
  );
}
