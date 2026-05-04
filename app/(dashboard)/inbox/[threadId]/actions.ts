"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { generateAndPersistResponderDraft } from "@/lib/ai/generate-responder-draft";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";

export type GenerateState = {
  error: string | null;
  completedAt: number;
};

export async function generateAiDraftAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const threadId = formData.get("threadId");
  if (typeof threadId !== "string" || threadId.length === 0) {
    return { error: "Missing thread.", completedAt: 0 };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in.", completedAt: 0 };
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return { error: "Choose an active organization.", completedAt: 0 };
  }

  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, organizationId: active.id },
    include: {
      connectedAccount: {
        select: {
          id: true,
          email: true,
          userId: true,
          organizationId: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          fromAddr: true,
          sentAt: true,
          bodyText: true,
          isOutbound: true,
        },
      },
    },
  });

  if (!thread) {
    return { error: "Thread not found.", completedAt: 0 };
  }

  try {
    await assertCanUseMailbox({
      userId: session.user.id,
      organizationId: active.id,
      activeRole: active.role,
      account: thread.connectedAccount,
    });
  } catch {
    return { error: "You cannot generate drafts for this mailbox.", completedAt: 0 };
  }

  try {
    await generateAndPersistResponderDraft({
      thread,
      userId: session.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return { error: message.slice(0, 500), completedAt: 0 };
  }

  revalidatePath(`/inbox/${threadId}`);
  return { error: null, completedAt: Date.now() };
}
