import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { GMAIL_OAUTH_SCOPES } from "@/lib/gmail/oauth-config";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
import { isOrgAdmin } from "@/lib/permissions/require-org-access";
import { disconnectGmailAccountFormAction } from "@/app/(dashboard)/email/actions";

function statusStyles(status: string) {
  switch (status) {
    case "CONNECTED":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "NEEDS_REAUTH":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "REVOKED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function formatOptionalDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export async function GmailConnectionsPanel() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return (
      <p className="text-sm text-neutral-600">
        Choose an active organization in the header before connecting Gmail.
      </p>
    );
  }

  const where = isOrgAdmin(active.role)
    ? { organizationId: active.id }
    : { organizationId: active.id, userId: session.user.id };

  const connections = await prisma.connectedEmailAccount.findMany({
    where,
    include: {
      connector: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const canDisconnect = (userId: string) =>
    userId === session.user.id || isOrgAdmin(active.role);

  if (!connections.length) {
    return <p className="text-sm text-neutral-600">No Gmail accounts connected yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Mailbox</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last sync</th>
            <th className="px-4 py-3">Connected by</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((row) => (
            <tr key={row.id} className="border-b border-neutral-100 last:border-b-0">
              <td className="px-4 py-3">
                <div className="font-medium text-neutral-900">{row.email}</div>
                <div className="text-xs text-neutral-500">{row.scopes.length} granted scopes</div>
                {row.lastError ? (
                  <div className="mt-2 text-xs text-amber-800">{row.lastError}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusStyles(row.status)}`}
                >
                  {row.status.replaceAll("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-neutral-600">{formatOptionalDate(row.lastSyncedAt)}</td>
              <td className="px-4 py-3 text-neutral-700">
                {row.connector.email ?? "Unknown"}
                {row.connector.name ? (
                  <span className="block text-xs text-neutral-500">{row.connector.name}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right">
                {canDisconnect(row.userId) ? (
                  <form action={disconnectGmailAccountFormAction}>
                    <input type="hidden" name="connectionId" value={row.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-red-700 hover:text-red-900"
                    >
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-neutral-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        Requested scopes for new connections:{" "}
        {GMAIL_OAUTH_SCOPES.map((scope) => (
          <code key={scope} className="mr-2 rounded bg-white px-1 py-0.5 text-[10px] text-neutral-600">
            {scope}
          </code>
        ))}
      </div>
    </div>
  );
}
