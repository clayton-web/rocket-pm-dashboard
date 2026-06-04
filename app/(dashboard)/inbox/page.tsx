import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { InboxCommandCenter } from "@/components/inbox/inbox-command-center";
import { InboxToolbar } from "@/components/inbox/inbox-toolbar";
import { getInboxCommandCenter } from "@/lib/inbox/inbox-command-center.service";
import { isInboxQueueParam } from "@/lib/inbox/inbox-thread-queues";
import { listMailboxesForInbox } from "@/lib/gmail/sync-permissions";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";

type PageProps = {
  searchParams: Promise<{
    mailbox?: string;
    queue?: string;
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

  const queue = isInboxQueueParam(params.queue) ? params.queue : null;

  const commandCenter =
    selectedMailboxId && selectedMailbox
      ? await getInboxCommandCenter({
          organizationId: active.id,
          mailboxId: selectedMailboxId,
          mailboxStatus: selectedMailbox.status,
          queue,
        })
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Inbox</h1>
        <p className="text-sm text-neutral-600">
          PM work queue from synced Gmail threads. Manual sync only in this phase.
        </p>
      </div>

      <div id="mailbox-toolbar">
        <InboxToolbar
          mailboxes={mailboxes}
          selectedMailboxId={selectedMailboxId}
          syncOk={params.sync === "ok"}
          syncError={params.sync_error}
        />
      </div>

      {selectedMailboxId && commandCenter ? (
        <InboxCommandCenter
          data={commandCenter}
          mailboxId={selectedMailboxId}
          queue={queue}
          lastSyncedAt={selectedMailbox?.lastSyncedAt?.toISOString() ?? null}
        />
      ) : null}
    </div>
  );
}
