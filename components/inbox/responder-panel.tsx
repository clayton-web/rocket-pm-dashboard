"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AiDraftResponse } from "@prisma/client";
import {
  generateAiDraftAction,
  loadAiDraftToGmailAction,
  type GenerateState,
  type LoadGmailDraftState,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import type { ResponderClassification, ResponderCitations } from "@/lib/ai/generate-responder-draft";

const initialGenerateState: GenerateState = { error: null, completedAt: 0 };
const initialLoadGmailState: LoadGmailDraftState = {
  error: null,
  successMessage: null,
  completedAt: 0,
};

function asClassification(raw: unknown): ResponderClassification | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as ResponderClassification;
  if (typeof o.thread_summary !== "string") return null;
  return o;
}

function asCitations(raw: unknown): ResponderCitations | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ResponderCitations;
}

export function ResponderPanel(props: {
  threadId: string;
  draft: Pick<
    AiDraftResponse,
    "id" | "draftText" | "classification" | "citations" | "model" | "promptVersion" | "createdAt"
  > | null;
  geminiConfigured: boolean;
}) {
  const { threadId, draft, geminiConfigured } = props;
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(generateAiDraftAction, initialGenerateState);
  const [loadState, loadGmailAction, loadPending] = useActionState(
    loadAiDraftToGmailAction,
    initialLoadGmailState,
  );
  const lastCompleted = useRef(0);

  useEffect(() => {
    if (state.completedAt > lastCompleted.current) {
      lastCompleted.current = state.completedAt;
      router.refresh();
    }
  }, [state.completedAt, router]);

  const classification = draft ? asClassification(draft.classification) : null;
  const citations = draft ? asCitations(draft.citations) : null;

  return (
    <aside className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">AI responder</h2>
        <p className="text-xs text-neutral-500">Draft assist only. Sending email is not enabled.</p>
      </div>

      {!geminiConfigured ? (
        <p className="text-xs text-amber-900">
          Set <code className="rounded bg-amber-50 px-1">GEMINI_API_KEY</code>{" "}
          (optional: <code className="rounded bg-amber-50 px-1">GEMINI_MODEL</code>) to generate drafts.
        </p>
      ) : null}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="threadId" value={threadId} />
        <button
          type="submit"
          disabled={!geminiConfigured || isPending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate draft"}
        </button>
      </form>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{state.error}</div>
      ) : null}

      {!draft ? (
        <p className="text-xs text-neutral-600">Run generate to store a draft on this thread.</p>
      ) : (
        <div className="space-y-3 text-xs text-neutral-700">
          {classification?.review_required ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              <div className="font-semibold">Review required</div>
              <p className="mt-1 text-amber-900">{classification.review_reason}</p>
              {classification.sensitivity_flags?.length ? (
                <p className="mt-2 text-[11px] text-amber-900">
                  Flags: {classification.sensitivity_flags.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{classification?.thread_summary}</p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Topic</h3>
              <p className="mt-1">{classification?.topic}</p>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Urgency</h3>
              <p className="mt-1">{classification?.urgency}</p>
            </div>
          </section>

          {classification?.risk_flags?.length ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Risk flags</h3>
              <p className="mt-1">{classification.risk_flags.join(", ")}</p>
            </section>
          ) : null}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Recommended action</h3>
            <p className="mt-1 font-medium">{classification?.recommended_action?.replaceAll("_", " ")}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Draft reply</h3>
            <div className="mt-1 whitespace-pre-wrap rounded-md border border-neutral-100 bg-neutral-50 p-2 text-sm text-neutral-900">
              {draft.draftText}
            </div>
            <form action={loadGmailAction} className="mt-2">
              <input type="hidden" name="threadId" value={threadId} />
              <input type="hidden" name="draftId" value={draft.id} />
              <button
                type="submit"
                disabled={loadPending}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadPending ? "Saving to Gmail…" : "Load to Gmail Drafts"}
              </button>
            </form>
            {loadState.error ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                {loadState.error}
              </div>
            ) : null}
            {loadState.successMessage ? (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                {loadState.successMessage}
              </div>
            ) : null}
          </section>

          {citations?.model_notes?.length ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                What the model used
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {citations.model_notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {citations?.retrieval?.length ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Retrieval sources
              </h3>
              <ul className="mt-1 space-y-1">
                {citations.retrieval.slice(0, 12).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span className="text-neutral-500">{item.kind}:</span> {item.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[10px] text-neutral-400">
            {draft.model} · {draft.promptVersion} ·{" "}
            {new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short" }).format(draft.createdAt)}
          </p>
        </div>
      )}
    </aside>
  );
}
