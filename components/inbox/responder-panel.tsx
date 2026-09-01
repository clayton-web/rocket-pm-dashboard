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
import { buttonClasses } from "@/components/portal/button";
import { InlineNotice, noticeClasses, SURFACE_PANEL } from "@/components/portal/ui";
import type { ResponderClassification, ResponderCitations } from "@/lib/ai/generate-responder-draft";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle";

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
    <aside className={`space-y-4 ${SURFACE_PANEL} p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto`}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">AI responder</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-foreground-muted">
          <li>Rocket PM generates the draft below.</li>
          <li>
            <span className="font-medium text-foreground">Load to Gmail</span> creates a reply draft in the original
            Gmail thread.
          </li>
          <li>Review, edit, and send in Gmail — sending from Rocket PM is not available.</li>
        </ol>
      </div>

      {!geminiConfigured ? (
        <p className="text-xs text-warning-foreground">
          Set <code className="rounded bg-warning-surface px-1">GEMINI_API_KEY</code>{" "}
          (optional: <code className="rounded bg-warning-surface px-1">GEMINI_MODEL</code>) to generate drafts.
        </p>
      ) : null}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="threadId" value={threadId} />
        <button
          type="submit"
          disabled={!geminiConfigured || isPending}
          className={buttonClasses({ variant: "primary", size: "xs", block: true })}
        >
          {isPending ? "Generating…" : "Generate draft"}
        </button>
      </form>

      {state.error ? (
        <InlineNotice tone="danger" size="compact" role="alert">
          {state.error}
        </InlineNotice>
      ) : null}

      {!draft ? (
        <p className="text-xs text-foreground-muted">
          Generate a draft, then load it to Gmail when you are ready to reply.
        </p>
      ) : (
        <div className="space-y-3 text-xs text-foreground-muted">
          {classification?.review_required ? (
            <div className={noticeClasses("warning", "compact")}>
              <div className="font-semibold">Review required</div>
              <p className="mt-1">{classification.review_reason}</p>
              {classification.sensitivity_flags?.length ? (
                <p className="mt-2 text-[11px]">
                  Flags: {classification.sensitivity_flags.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <section>
            <h3 className={SECTION_LABEL}>Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{classification?.thread_summary}</p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <div>
              <h3 className={SECTION_LABEL}>Topic</h3>
              <p className="mt-1">{classification?.topic}</p>
            </div>
            <div>
              <h3 className={SECTION_LABEL}>Urgency</h3>
              <p className="mt-1">{classification?.urgency}</p>
            </div>
          </section>

          {classification?.risk_flags?.length ? (
            <section>
              <h3 className={SECTION_LABEL}>Risk flags</h3>
              <p className="mt-1">{classification.risk_flags.join(", ")}</p>
            </section>
          ) : null}

          <section>
            <h3 className={SECTION_LABEL}>Recommended action</h3>
            <p className="mt-1 font-medium">{classification?.recommended_action?.replaceAll("_", " ")}</p>
          </section>

          <section>
            <h3 className={SECTION_LABEL}>Draft reply</h3>
            <div className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-surface-muted p-2 text-sm text-foreground">
              {draft.draftText}
            </div>
            <form action={loadGmailAction} className="mt-2">
              <input type="hidden" name="threadId" value={threadId} />
              <input type="hidden" name="draftId" value={draft.id} />
              <button
                type="submit"
                disabled={loadPending}
                className={buttonClasses({ size: "xs", block: true })}
              >
                {loadPending ? "Loading into Gmail…" : "Load to Gmail"}
              </button>
            </form>
            {loadState.error ? (
              <InlineNotice tone="danger" size="compact" role="alert" className="mt-2">
                {loadState.error}
              </InlineNotice>
            ) : null}
            {loadState.successMessage ? (
              <InlineNotice tone="success" size="compact" role="status" className="mt-2">
                {loadState.successMessage}
              </InlineNotice>
            ) : null}
          </section>

          {citations?.model_notes?.length ? (
            <section>
              <h3 className={SECTION_LABEL}>What the model used</h3>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {citations.model_notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {citations?.retrieval?.length ? (
            <section>
              <h3 className={SECTION_LABEL}>Retrieval sources</h3>
              <ul className="mt-1 space-y-1">
                {citations.retrieval.slice(0, 12).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span className="text-foreground-subtle">{item.kind}:</span> {item.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[10px] text-foreground-subtle">
            {draft.model} · {draft.promptVersion} ·{" "}
            {new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short" }).format(draft.createdAt)}
          </p>
        </div>
      )}
    </aside>
  );
}
