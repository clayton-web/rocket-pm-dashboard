"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { runManualGmailSync } from "@/lib/gmail/manual-sync";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { requireActiveOrganization } from "@/lib/org/active-organization";

export async function syncGmailMailboxAction(formData: FormData) {
  const mailboxId = formData.get("connectedAccountId");
  if (typeof mailboxId !== "string" || mailboxId.length === 0) {
    throw new Error("connectedAccountId is required");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const active = await requireActiveOrganization();
  const account = await prisma.connectedEmailAccount.findFirst({
    where: { id: mailboxId, organizationId: active.id },
  });

  if (!account) {
    redirect(`/inbox?sync_error=${encodeURIComponent("Mailbox not found.")}`);
  }

  await assertCanUseMailbox({
    userId: session.user.id,
    organizationId: active.id,
    activeRole: active.role,
    account,
  });

  try {
    await runManualGmailSync({ account, actorUserId: session.user.id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync_failed";
    redirect(
      `/inbox?mailbox=${encodeURIComponent(account.id)}&sync_error=${encodeURIComponent(msg.slice(0, 240))}`,
    );
  }

  revalidatePath("/inbox");
  redirect(`/inbox?mailbox=${encodeURIComponent(account.id)}&sync=ok`);
}
