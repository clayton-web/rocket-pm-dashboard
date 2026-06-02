import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { assertCanUseMailbox } from "@/lib/gmail/sync-permissions";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
import { ThreadMessages } from "@/components/inbox/thread-messages";
import { ResponderPanel } from "@/components/inbox/responder-panel";
import { ThreadContextLinksPanel } from "@/components/inbox/thread-context-links-panel";
import { loadThreadContextLinkOptions } from "@/lib/ai/thread-context-link-options";

type PageProps = {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ mailbox?: string }>;
};

export default async function ThreadDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-lg font-semibold text-neutral-900">Thread</h1>
        <p className="text-sm text-neutral-600">Select an organization to read mail.</p>
      </div>
    );
  }

  const { threadId } = await params;
  const query = await searchParams;

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
      },
    },
  });

  if (!thread) {
    notFound();
  }

  await assertCanUseMailbox({
    userId: session.user.id,
    organizationId: active.id,
    activeRole: active.role,
    account: thread.connectedAccount,
  });

  const mailboxQuery = query.mailbox ?? thread.connectedAccount.id;

  const latestDraft = await prisma.aiDraftResponse.findFirst({
    where: {
      organizationId: active.id,
      threadId: thread.id,
      status: "DRAFT",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      draftText: true,
      classification: true,
      citations: true,
      model: true,
      promptVersion: true,
      createdAt: true,
    },
  });

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const linkOptions = await loadThreadContextLinkOptions(active.id);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <ThreadMessages thread={thread} mailboxQuery={mailboxQuery} />
        <div className="flex flex-col gap-4">
          <ThreadContextLinksPanel
            threadId={thread.id}
            contextLinksJson={thread.contextLinks}
            options={linkOptions}
          />
          <ResponderPanel threadId={thread.id} draft={latestDraft} geminiConfigured={geminiConfigured} />
        </div>
      </div>
    </div>
  );
}
