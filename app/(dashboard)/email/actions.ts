"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { requireActiveOrganization } from "@/lib/org/active-organization";
import { isOrgAdmin } from "@/lib/permissions/require-org-access";

export async function disconnectGmailAccountFormAction(formData: FormData) {
  const connectionId = formData.get("connectionId");
  if (typeof connectionId !== "string" || connectionId.length === 0) {
    throw new Error("connectionId required");
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const active = await requireActiveOrganization();
  const connection = await prisma.connectedEmailAccount.findFirst({
    where: { id: connectionId, organizationId: active.id },
  });

  if (!connection) {
    throw new Error("Not found");
  }

  const allowed = connection.userId === session.user.id || isOrgAdmin(active.role);
  if (!allowed) {
    throw new Error("Forbidden");
  }

  await prisma.connectedEmailAccount.delete({ where: { id: connectionId } });
  await prisma.auditLog.create({
    data: {
      organizationId: active.id,
      actorUserId: session.user.id,
      action: "gmail.disconnected",
      resourceType: "ConnectedEmailAccount",
      resourceId: connectionId,
      metadata: { email: connection.email },
    },
  });

  revalidatePath("/email");
}
