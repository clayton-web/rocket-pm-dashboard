import Link from "next/link";
import { GmailConnectionsPanel } from "@/components/email/gmail-connections-panel";
import { withBasePath } from "@/lib/app-path";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    error_detail?: string;
    connected?: string;
  }>;
};

export default async function EmailPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error;
  const description = params.error_detail;
  const connected = params.connected;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Gmail connection</h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          Connect a Gmail mailbox for this organization. Tokens stay on the server; the browser never receives refresh
          tokens. Sync and compose features will use this connection in later phases.
        </p>
      </div>

      {connected ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Gmail connected successfully.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="font-medium">Could not complete Gmail connection</div>
          <div className="mt-1 text-red-800">{error}</div>
          {description ? <div className="mt-1 text-xs text-red-700">{description}</div> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={withBasePath("/api/integrations/gmail/connect")}
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Connect Gmail
        </a>
        <Link href="/inbox" prefetch={false} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
          Back to inbox
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Connected accounts</h2>
        <GmailConnectionsPanel />
      </div>
    </div>
  );
}
