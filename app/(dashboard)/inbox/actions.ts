"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { enqueueGmailSyncJob } from "@/lib/gmail/enqueue-gmail-sync";
import { restartGmailSyncJob } from "@/lib/gmail/restart-gmail-sync";
import {
  applyPromptSyncAfterEnqueue,
  applyPromptSyncAfterRestart,
} from "@/lib/gmail/trigger-sync-processing";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { requireActiveOrganization } from "@/lib/org/active-organization";

async function loadMailboxForSyncAction(mailboxId: string) {
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

  return { session, active, account };
}

export async function syncGmailMailboxAction(formData: FormData) {
  const mailboxId = formData.get("connectedAccountId");
  if (typeof mailboxId !== "string" || mailboxId.length === 0) {
    throw new Error("connectedAccountId is required");
  }

  const { session, active, account } = await loadMailboxForSyncAction(mailboxId);

  try {
    const result = await enqueueGmailSyncJob({
      organizationId: active.id,
      connectedAccountId: account.id,
      triggeredByUserId: session.user.id,
    });

    applyPromptSyncAfterEnqueue(result);

    revalidatePath("/inbox");
    revalidatePath("/operations");
    const query = result.alreadyQueued ? "sync=queued" : "sync=enqueued";
    redirect(`/inbox?mailbox=${encodeURIComponent(account.id)}&${query}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync_enqueue_failed";
    redirect(
      `/inbox?mailbox=${encodeURIComponent(account.id)}&sync_error=${encodeURIComponent(msg.slice(0, 240))}`,
    );
  }
}

export async function restartGmailSyncAction(formData: FormData) {
  const mailboxId = formData.get("connectedAccountId");
  if (typeof mailboxId !== "string" || mailboxId.length === 0) {
    throw new Error("connectedAccountId is required");
  }

  const { session, active, account } = await loadMailboxForSyncAction(mailboxId);

  try {
    const result = await restartGmailSyncJob({
      organizationId: active.id,
      connectedAccountId: account.id,
      triggeredByUserId: session.user.id,
    });

    applyPromptSyncAfterRestart(result);

    revalidatePath("/inbox");
    revalidatePath("/operations");

    if (!result.restarted) {
      redirect(
        `/inbox?mailbox=${encodeURIComponent(account.id)}&sync=still_running`,
      );
    }

    redirect(`/inbox?mailbox=${encodeURIComponent(account.id)}&sync=restarted`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync_restart_failed";
    redirect(
      `/inbox?mailbox=${encodeURIComponent(account.id)}&sync_error=${encodeURIComponent(msg.slice(0, 240))}`,
    );
  }
}
