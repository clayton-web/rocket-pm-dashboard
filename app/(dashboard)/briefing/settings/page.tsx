import Link from "next/link";
import { redirect } from "next/navigation";
import { FOCUS_RING } from "@/components/portal/focus";
import { InlineNotice } from "@/components/portal/ui";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";

export default async function BriefingSettingsPage() {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    redirect("/login");
  }

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
          Daily Briefing configuration is retired.
        </p>
      </div>

      <InlineNotice>
        Daily Briefing is decommissioned. Settings can no longer be enabled or changed. Historical
        stored configuration is unchanged.
      </InlineNotice>
    </div>
  );
}
