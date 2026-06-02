import prisma from "@/lib/db/prisma";
import {
  assembleResponderContextForThread,
  type ThreadWithMessages,
} from "@/lib/ai/assemble-responder-context";
import { mergeSensitivityFlags, scanTextForSensitivity, shouldForceReview } from "@/lib/ai/bc-safety";
import {
  assertGeminiApiKeyConfigured,
  createChatJsonCompletion,
  getGeminiResponderModel,
} from "@/lib/ai/gemini-client";
import type { ResponderContext } from "@/lib/ai/context-builder";
import type { Prisma } from "@prisma/client";

const GENERATION_PROMPT_VERSION = "responder-generate-v1";

export type ResponderClassification = {
  thread_summary: string;
  topic: string;
  urgency: "routine" | "soon" | "urgent";
  risk_flags: string[];
  sensitivity_flags: string[];
  recommended_action: "draft_reply" | "escalate_review";
  review_required: boolean;
  review_reason?: string;
};

export type ResponderCitations = {
  retrieval: Array<{
    kind: "rule" | "knowledge" | "style" | "prior_draft" | "integration" | "pm_context";
    id: string;
    title: string;
  }>;
  model_notes: string[];
};

function clampPromptText(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function formatContextForPrompt(ctx: ResponderContext): string {
  const lines: string[] = [];

  lines.push("## Thread");
  lines.push(`Subject: ${ctx.thread.subject ?? "(none)"}`);
  for (const m of ctx.thread.messages) {
    const body = m.bodyText?.trim() || "";
    lines.push(
      `- [${m.isOutbound ? "outbound" : "inbound"}] ${m.fromAddr} @ ${m.sentAt.toISOString()}: ${clampPromptText(body, 4000)}`,
    );
  }

  lines.push("\n## Active rules (highest priority first)");
  for (const r of ctx.rules) {
    lines.push(`### ${r.title} (${r.id})\n${r.instruction}`);
  }

  lines.push("\n## Knowledge sources");
  for (const k of ctx.knowledge) {
    lines.push(`### ${k.title} [${k.type}] (${k.id})\n${clampPromptText(k.content, 6000)}`);
  }

  lines.push("\n## Style examples");
  for (const s of ctx.styleExamples) {
    const title = s.title ?? "Example";
    lines.push(`### ${title} (${s.id})\n${clampPromptText(s.content, 4000)}`);
  }

  lines.push("\n## Approved prior replies (excerpts)");
  for (const p of ctx.approvedDrafts) {
    lines.push(`- (${p.id}) ${clampPromptText(p.excerpt, 1200)}`);
  }

  if (ctx.integrationSnippets.length) {
    lines.push("\n## Related Rocket context (integrations)");
    for (const s of ctx.integrationSnippets) {
      lines.push(`- [${s.source}] ${s.label}: ${s.text}`);
    }
  }

  if (ctx.pmContextSnippets.length) {
    lines.push(
      "\n## Internal property management context (linked records only — do not infer unrelated tenants or properties)",
    );
    for (const s of ctx.pmContextSnippets) {
      lines.push(`- [${s.kind}] ${s.label}: ${s.text}`);
    }
  }

  return lines.join("\n");
}

function buildCitations(ctx: ResponderContext, modelNotes: string[]): ResponderCitations {
  const retrieval: ResponderCitations["retrieval"] = [];

  for (const r of ctx.rules) {
    retrieval.push({ kind: "rule", id: r.id, title: r.title });
  }
  for (const k of ctx.knowledge) {
    retrieval.push({ kind: "knowledge", id: k.id, title: k.title });
  }
  for (const s of ctx.styleExamples) {
    retrieval.push({ kind: "style", id: s.id, title: s.title ?? "Style example" });
  }
  for (const p of ctx.approvedDrafts) {
    retrieval.push({ kind: "prior_draft", id: p.id, title: "Approved reply excerpt" });
  }
  for (const s of ctx.integrationSnippets) {
    retrieval.push({
      kind: "integration",
      id: `${s.source}-${s.label}`,
      title: s.label,
    });
  }
  for (const s of ctx.pmContextSnippets) {
    retrieval.push({
      kind: "pm_context",
      id: `${s.kind}-${s.id}`,
      title: s.label,
    });
  }

  return { retrieval, model_notes: modelNotes };
}

function parseModelOutput(raw: unknown): {
  thread_summary: string;
  topic: string;
  urgency: ResponderClassification["urgency"];
  risk_flags: string[];
  sensitivity_flags: string[];
  recommended_action: ResponderClassification["recommended_action"];
  draft_reply: string;
  context_explanation: string[];
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Model output was not an object.");
  }
  const o = raw as Record<string, unknown>;

  const thread_summary = typeof o.thread_summary === "string" ? o.thread_summary : "";
  const topic = typeof o.topic === "string" ? o.topic : "";
  const urgencyRaw = typeof o.urgency === "string" ? o.urgency : "routine";
  const urgency =
    urgencyRaw === "urgent" || urgencyRaw === "soon" || urgencyRaw === "routine" ? urgencyRaw : "routine";
  const risk_flags = Array.isArray(o.risk_flags) ? o.risk_flags.filter((x): x is string => typeof x === "string") : [];
  const sensitivity_flags = Array.isArray(o.sensitivity_flags)
    ? o.sensitivity_flags.filter((x): x is string => typeof x === "string")
    : [];
  const recRaw = typeof o.recommended_action === "string" ? o.recommended_action : "draft_reply";
  const recommended_action: ResponderClassification["recommended_action"] =
    recRaw === "escalate_review" ? "escalate_review" : "draft_reply";
  const draft_reply = typeof o.draft_reply === "string" ? o.draft_reply : "";
  const context_explanation = Array.isArray(o.context_explanation)
    ? o.context_explanation.filter((x): x is string => typeof x === "string")
    : [];

  return {
    thread_summary,
    topic,
    urgency,
    risk_flags,
    sensitivity_flags,
    recommended_action,
    draft_reply,
    context_explanation,
  };
}

const SYSTEM_PROMPT = `You are an assistant helping licensed British Columbia property management staff draft email replies.

Rules:
- You are not a lawyer. Do not give legal advice or guarantee outcomes.
- Prefer cautious language for: tenancy notices, deposits, repairs, access to units, eviction or non-payment, strata issues, owner/tenant disputes, human rights or accommodation requests.
- If the situation looks sensitive or could require a lawyer, RTB decision, or licensed property manager judgment, set recommended_action to "escalate_review" and keep the draft neutral and short.
- Never promise legal outcomes, exact timelines that depend on statutes without verification, or that repairs will be completed by a specific date unless explicitly grounded in supplied context.
- Use Canadian/Business-appropriate tone: clear, respectful, professional.
- Output MUST be a single JSON object with keys: thread_summary, topic, urgency (one of: routine | soon | urgent), risk_flags (string array), sensitivity_flags (string array), recommended_action (draft_reply | escalate_review), draft_reply (string), context_explanation (string array describing which provided rules/knowledge/examples most influenced the reply — plain language, no hallucinated citations).`;

export async function generateAndPersistResponderDraft(args: {
  thread: ThreadWithMessages;
  userId: string;
}): Promise<{ draftId: string }> {
  assertGeminiApiKeyConfigured();

  const context = await assembleResponderContextForThread({
    thread: args.thread,
    userId: args.userId,
  });

  const userPrompt = `Context version: ${context.promptVersion}\n\n${formatContextForPrompt(context)}`;

  const raw = await createChatJsonCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: clampPromptText(userPrompt, 100_000) },
    ],
  });

  const parsed = parseModelOutput(raw);

  const threadBlob = context.thread.messages.map((m) => m.bodyText ?? "").join("\n");
  const heurFlags = scanTextForSensitivity(`${threadBlob}\n${parsed.draft_reply}`);
  const mergedFlags = mergeSensitivityFlags(parsed.sensitivity_flags, heurFlags);
  const review_required =
    shouldForceReview(mergedFlags) || parsed.recommended_action === "escalate_review";

  let recommended_action = parsed.recommended_action;
  if (review_required && recommended_action === "draft_reply") {
    recommended_action = "escalate_review";
  }

  const classification: ResponderClassification = {
    thread_summary: parsed.thread_summary,
    topic: parsed.topic,
    urgency: parsed.urgency,
    risk_flags: parsed.risk_flags,
    sensitivity_flags: mergedFlags,
    recommended_action,
    review_required,
    review_reason: review_required
      ? "BC property management safeguards triggered or model recommended review."
      : undefined,
  };

  const citations = buildCitations(context, parsed.context_explanation);

  const draft = await prisma.$transaction(async (tx) => {
    await tx.aiDraftResponse.updateMany({
      where: {
        organizationId: args.thread.organizationId,
        threadId: args.thread.id,
        status: "DRAFT",
      },
      data: { status: "SUPERSEDED" },
    });

    const created = await tx.aiDraftResponse.create({
      data: {
        organizationId: args.thread.organizationId,
        threadId: args.thread.id,
        createdByUserId: args.userId,
        model: getGeminiResponderModel(),
        promptVersion: GENERATION_PROMPT_VERSION,
        status: "DRAFT",
        draftText: parsed.draft_reply,
        classification: classification as unknown as Prisma.InputJsonValue,
        citations: citations as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: args.thread.organizationId,
        actorUserId: args.userId,
        action: "ai.draft.generated",
        resourceType: "AiDraftResponse",
        resourceId: created.id,
        metadata: { threadId: args.thread.id, topic: classification.topic, review_required },
      },
    });

    return created;
  });

  return { draftId: draft.id };
}
