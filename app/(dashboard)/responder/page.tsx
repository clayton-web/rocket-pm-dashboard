import Link from "next/link";

export default function ResponderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-lg font-semibold text-neutral-900">AI responder</h1>
      <p className="text-sm leading-relaxed text-neutral-600">
        The responder runs on each email thread. Open a thread from the{" "}
        <Link href="/inbox" className="font-medium text-neutral-900 underline">
          inbox
        </Link>{" "}
        to see the panel on the right (desktop) or below messages (small screens).
      </p>
    </div>
  );
}
