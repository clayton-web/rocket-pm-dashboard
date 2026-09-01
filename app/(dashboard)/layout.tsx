import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
import { DashboardHeaderTitle } from "@/components/dashboard/dashboard-header-title";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { signOutAction } from "@/app/(dashboard)/actions";
import type { EffectivePermissions } from "@/lib/permissions/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const active = await getActiveOrganizationContext();

  const permissions: EffectivePermissions = {
    role: active?.role ?? null,
    isPlatformOperator: user?.platformAccessLevel === "OPERATOR",
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <DashboardSidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
          <DashboardHeaderTitle />
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-end gap-1">
              <OrgSwitcher />
              <div className="text-xs text-foreground-subtle">{session.user.email}</div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">
          {!active ? (
            <div className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
              Select an active organization to continue. Use the organization picker in the header when you belong
              to more than one workspace.
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
