import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getActiveOrganizationContext, getMembershipsForUser } from "@/lib/org/active-organization";
import { switchOrganizationAction } from "@/app/(dashboard)/actions";

export async function OrgSwitcher() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const memberships = await getMembershipsForUser(session.user.id);
  const active = await getActiveOrganizationContext();

  const operator = user?.platformAccessLevel === "OPERATOR";
  const allOrgs = operator
    ? await prisma.organization.findMany({ orderBy: { name: "asc" } })
    : null;

  if (!operator && memberships.length <= 1) {
    return (
      <div className="truncate text-xs text-foreground-muted">
        {active ? (
          <>
            <span className="font-medium text-foreground">{active.name}</span>
            <span className="text-foreground-subtle"> · </span>
            <span>{active.role.replace("_", " ")}</span>
          </>
        ) : (
          "No organization"
        )}
      </div>
    );
  }

  return (
    <form action={switchOrganizationAction} className="flex items-center gap-2">
      <select
        name="organizationId"
        defaultValue={active?.id ?? ""}
        className="max-w-[14rem] rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Active organization"
      >
        <option value="" disabled>
          Select organization
        </option>
        {operator && allOrgs
          ? allOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))
          : memberships.map((m) => (
              <option key={m.id} value={m.organizationId}>
                {m.organization.name}
              </option>
            ))}
      </select>
    </form>
  );
}
