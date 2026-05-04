import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
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
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <DashboardSidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <div className="text-sm font-medium text-neutral-800">Operations</div>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-end gap-1">
              <OrgSwitcher />
              <div className="text-xs text-neutral-500">{session.user.email}</div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">
          {!active ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
