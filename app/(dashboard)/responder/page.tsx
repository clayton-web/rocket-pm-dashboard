import Link from "next/link";

export default function ResponderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">AI responder</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Rocket PM helps you draft replies to synced Gmail threads. You always review, edit, and send from Gmail — not
          from this app.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Daily workflow</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            Open the{" "}
            <Link href="/inbox" className="font-medium text-neutral-900 underline">
              inbox
            </Link>
            , choose a mailbox, and run <span className="font-medium">Sync now</span> to pull recent threads.
          </li>
          <li>Open a thread and use <span className="font-medium">Generate draft</span> — Rocket PM writes a suggested reply.</li>
          <li>
            Click <span className="font-medium">Load to Gmail</span> — this creates a reply draft inside the original Gmail
            thread (not a new conversation).
          </li>
          <li>Review, edit, and send the message in Gmail.</li>
        </ol>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>
          The responder panel appears on each thread page — on the right on desktop, below messages on smaller screens.
        </p>
        <p className="mt-2">
          Need to connect or reconnect Gmail?{" "}
          <Link href="/email" className="font-medium text-neutral-900 underline">
            Gmail connection
          </Link>
        </p>
      </section>

      <Link
        href="/inbox"
        className="inline-flex rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        Go to inbox
      </Link>
    </div>
  );
}
