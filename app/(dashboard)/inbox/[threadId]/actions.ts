"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { generateAndPersistResponderDraft } from "@/lib/ai/generate-responder-draft";
import { createThreadReplyGmailDraft } from "@/lib/gmail/create-thread-reply-gmail-draft";
import { isGmailAuthError } from "@/lib/gmail/gmail-errors";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";

export type GenerateState = {
  error: string | null;
  completedAt: number;
};

export type LoadGmailDraftState = {
  error: string | null;
  successMessage: string | null;
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

export async function loadAiDraftToGmailAction(
  _prev: LoadGmailDraftState,
  formData: FormData,
): Promise<LoadGmailDraftState> {
  const completedAt = Date.now();
  const threadId = formData.get("threadId");
  const draftId = formData.get("draftId");

  if (typeof threadId !== "string" || threadId.length === 0) {
    return { error: "Missing thread.", successMessage: null, completedAt: 0 };
  }
  if (typeof draftId !== "string" || draftId.length === 0) {
    return { error: "Missing draft.", successMessage: null, completedAt: 0 };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in.", successMessage: null, completedAt: 0 };
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return { error: "Choose an active organization.", successMessage: null, completedAt: 0 };
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
          scopes: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          providerMessageId: true,
          fromAddr: true,
          sentAt: true,
          isOutbound: true,
        },
      },
    },
  });

  if (!thread) {
    return { error: "Thread not found.", successMessage: null, completedAt: 0 };
  }

  try {
    await assertCanUseMailbox({
      userId: session.user.id,
      organizationId: active.id,
      activeRole: active.role,
      account: thread.connectedAccount,
    });
  } catch {
    return { error: "You cannot use drafts for this mailbox.", successMessage: null, completedAt: 0 };
  }

  const draft = await prisma.aiDraftResponse.findFirst({
    where: {
      id: draftId,
      organizationId: active.id,
      threadId: thread.id,
      status: "DRAFT",
    },
    select: { id: true, draftText: true },
  });

  if (!draft) {
    return { error: "Draft not found or no longer active.", successMessage: null, completedAt: 0 };
  }

  try {
    await createThreadReplyGmailDraft({
      draftText: draft.draftText ?? "",
      aiDraftResponseId: draft.id,
      thread: {
        id: thread.id,
        organizationId: thread.organizationId,
        providerThreadId: thread.providerThreadId,
        subject: thread.subject,
        connectedAccountId: thread.connectedAccountId,
        messages: thread.messages,
      },
      connectedAccountScopes: thread.connectedAccount.scopes,
      mailboxEmail: thread.connectedAccount.email,
      userId: session.user.id,
    });
  } catch (error) {
    if (isGmailAuthError(error) && (error.code === "needs_reauth" || error.code === "forbidden")) {
      return {
        error:
          error.code === "forbidden"
            ? `${error.message} If you recently tightened Gmail scopes, disconnect and reconnect Gmail under Email.`
            : `${error.message} Disconnect and reconnect Gmail under Email if this keeps happening.`,
        successMessage: null,
        completedAt: 0,
      };
    }
    const message = error instanceof Error ? error.message : "Could not save Gmail draft.";
    return { error: message.slice(0, 500), successMessage: null, completedAt: 0 };
  }

  revalidatePath(`/inbox/${threadId}`);
  return {
    error: null,
    successMessage: "Draft loaded to Gmail. Review and send from Gmail.",
    completedAt,
  };
}
