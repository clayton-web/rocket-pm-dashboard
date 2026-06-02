import type { ConnectedEmailAccount, OrganizationMembershipRole } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { isOrgAdmin } from "@/lib/permissions/require-org-access";

export async function assertCanUseMailbox(args: {
  userId: string;
  organizationId: string;
  activeRole: OrganizationMembershipRole;
  account: Pick<ConnectedEmailAccount, "id" | "organizationId" | "userId">;
}) {
  if (args.account.organizationId !== args.organizationId) {
    throw new Error("Mailbox does not belong to the active organization.");
  }

  if (args.account.userId === args.userId) {
    return;
  }

  if (isOrgAdmin(args.activeRole)) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (user?.platformAccessLevel === "OPERATOR") {
    return;
  }

  throw new Error("You are not allowed to use this mailbox.");
}

export async function listMailboxesForInbox(args: {
  userId: string;
  organizationId: string;
  activeRole: OrganizationMembershipRole;
}) {
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  const operator = user?.platformAccessLevel === "OPERATOR";
  const admin = isOrgAdmin(args.activeRole) || operator;

  return prisma.connectedEmailAccount.findMany({
    where: {
      organizationId: args.organizationId,
      ...(admin ? {} : { userId: args.userId }),
    },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      status: true,
      lastSyncedAt: true,
      lastError: true,
    },
  });
}
