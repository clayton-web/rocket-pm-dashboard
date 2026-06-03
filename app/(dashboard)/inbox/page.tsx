import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { InboxToolbar } from "@/components/inbox/inbox-toolbar";
import { ThreadList } from "@/components/inbox/thread-list";
import prisma from "@/lib/db/prisma";
import { listMailboxesForInbox } from "@/lib/gmail/sync-permissions";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";

type PageProps = {
  searchParams: Promise<{
    mailbox?: string;
    sync?: string;
    sync_error?: string;
  }>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-lg font-semibold text-neutral-900">Inbox</h1>
        <p className="text-sm text-neutral-600">Select an organization to view the inbox.</p>
      </div>
    );
  }

  const params = await searchParams;
  const mailboxes = await listMailboxesForInbox({
    userId: session.user.id,
    organizationId: active.id,
    activeRole: active.role,
  });

  const mailboxParam = params.mailbox;
  const selectedMailboxId =
    mailboxParam && mailboxes.some((m) => m.id === mailboxParam) ? mailboxParam : mailboxes[0]?.id ?? null;
  const selectedMailbox = selectedMailboxId
    ? mailboxes.find((m) => m.id === selectedMailboxId) ?? null
    : null;

  const threads =
    selectedMailboxId == null
      ? []
      : await prisma.emailThread.findMany({
          where: {
            organizationId: active.id,
            connectedAccountId: selectedMailboxId,
          },
          orderBy: { lastMessageAt: "desc" },
          take: 100,
          select: {
            id: true,
            subject: true,
            snippet: true,
            lastMessageAt: true,
            isUnread: true,
            participantEmails: true,
          },
        });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Inbox</h1>
        <p className="text-sm text-neutral-600">Synced threads from Gmail (manual sync only in this phase).</p>
      </div>

      <InboxToolbar
        mailboxes={mailboxes}
        selectedMailboxId={selectedMailboxId}
        syncOk={params.sync === "ok"}
        syncError={params.sync_error}
      />

      {selectedMailboxId ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-900">Threads</h2>
          <ThreadList
            mailboxId={selectedMailboxId}
            threads={threads}
            lastSyncedAt={selectedMailbox?.lastSyncedAt ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}
