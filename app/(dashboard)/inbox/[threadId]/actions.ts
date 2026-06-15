"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { generateAndPersistResponderDraft } from "@/lib/ai/generate-responder-draft";
import {
  parseEmailThreadContextLinks,
  PM_CONTEXT_SOURCE,
  serializeEmailThreadContextLinks,
  type PmContextKind,
} from "@/lib/ai/email-context-links";
import { loadPmContextSnippets } from "@/lib/ai/load-pm-context";
import { createThreadReplyGmailDraft } from "@/lib/gmail/create-thread-reply-gmail-draft";
import { isGmailAuthError } from "@/lib/gmail/gmail-errors";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { isEmailThreadCategory } from "@/lib/inbox/email-thread-category";
import { buildThreadReclassifySuccessMessage } from "@/lib/inbox/thread-reclassify-feedback";
import { updateEmailThreadCategory } from "@/lib/inbox/update-thread-category";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";

const PM_KINDS = new Set<PmContextKind>([
  "property",
  "unit",
  "tenancy",
  "tenancy_contact",
  "maintenance_request",
  "application",
  "notice",
  "document",
]);

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
    successMessage:
      "Reply draft created in the original Gmail thread. Open Gmail to review, edit, and send.",
    completedAt,
  };
}

async function getThreadForContextLinks(threadId: string, userId: string) {
  const active = await getActiveOrganizationContext();
  if (!active) return { error: "Choose an active organization." as const, thread: null };

  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, organizationId: active.id },
    include: {
      connectedAccount: {
        select: { id: true, email: true, userId: true, organizationId: true },
      },
    },
  });
  if (!thread) return { error: "Thread not found." as const, thread: null };

  try {
    await assertCanUseMailbox({
      userId,
      organizationId: active.id,
      activeRole: active.role,
      account: thread.connectedAccount,
    });
  } catch {
    return { error: "You cannot edit links for this mailbox." as const, thread: null };
  }

  return { error: null, thread, organizationId: active.id };
}

export async function addThreadPmContextLinkAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const threadId = formData.get("threadId");
  const kind = formData.get("kind");
  const entityId = formData.get("entityId");
  if (typeof threadId !== "string" || typeof kind !== "string" || typeof entityId !== "string") {
    return;
  }
  if (!PM_KINDS.has(kind as PmContextKind) || entityId.trim() === "") return;

  const pmKind = kind as PmContextKind;
  const { error, thread, organizationId } = await getThreadForContextLinks(threadId, session.user.id);
  if (error || !thread || !organizationId) return;

  const link = { source: PM_CONTEXT_SOURCE, kind: pmKind, id: entityId.trim() } as const;
  const snippets = await loadPmContextSnippets(organizationId, [link]);
  if (!snippets.length) return;

  const existing = parseEmailThreadContextLinks(thread.contextLinks);
  const merged = [...existing];
  if (!merged.some((l) => "source" in l && l.source === PM_CONTEXT_SOURCE && l.kind === link.kind && l.id === link.id)) {
    merged.push(link);
  }

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { contextLinks: serializeEmailThreadContextLinks(merged) },
  });

  revalidatePath(`/inbox/${threadId}`);
}

export async function removeThreadPmContextLinkAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const threadId = formData.get("threadId");
  const kind = formData.get("kind");
  const entityId = formData.get("entityId");
  if (typeof threadId !== "string" || typeof kind !== "string" || typeof entityId !== "string") {
    return;
  }

  const { error, thread } = await getThreadForContextLinks(threadId, session.user.id);
  if (error || !thread) return;

  const existing = parseEmailThreadContextLinks(thread.contextLinks);
  const filtered = existing.filter(
    (l) =>
      !(
        "source" in l &&
        l.source === PM_CONTEXT_SOURCE &&
        l.kind === kind &&
        l.id === entityId.trim()
      ),
  );

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { contextLinks: serializeEmailThreadContextLinks(filtered) },
  });

  revalidatePath(`/inbox/${threadId}`);
}

export type UpdateThreadCategoryState = {
  error: string | null;
  successMessage: string | null;
  completedAt: number;
};

export async function updateThreadCategoryAction(
  _prev: UpdateThreadCategoryState,
  formData: FormData,
): Promise<UpdateThreadCategoryState> {
  const completedAt = Date.now();
  const threadId = formData.get("threadId");
  const category = formData.get("category");
  if (typeof threadId !== "string" || typeof category !== "string") {
    return { error: "Invalid request.", successMessage: null, completedAt: 0 };
  }
  if (!isEmailThreadCategory(category)) {
    return { error: "Choose a valid crate.", successMessage: null, completedAt: 0 };
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
        select: { id: true, email: true, userId: true, organizationId: true },
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
    return { error: "You cannot edit this mailbox.", successMessage: null, completedAt: 0 };
  }

  const updateResult = await updateEmailThreadCategory({
    threadId: thread.id,
    organizationId: active.id,
    category,
    categorySource: "manual",
  });
  if (!updateResult.ok) {
    return { error: updateResult.error, successMessage: null, completedAt: 0 };
  }

  revalidatePath(`/inbox/${threadId}`);
  revalidatePath("/inbox");

  return {
    error: null,
    successMessage: buildThreadReclassifySuccessMessage({
      category,
    }),
    completedAt,
  };
}
