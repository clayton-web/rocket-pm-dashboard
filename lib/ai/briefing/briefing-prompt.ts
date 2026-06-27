import type { BriefingContext } from "@/lib/briefing/briefing-types";
import { BRIEFING_PROMPT_VERSION } from "@/lib/briefing/briefing-types";
import { BRIEFING_MVP_SCOPE_NOTE } from "@/lib/briefing/briefing-sources";

export type BriefingPromptMessages = {
  system: string;
  user: string;
};

export function buildBriefingSystemPrompt(): string {
  return [
    `You are a Daily Briefing assistant for a British Columbia property management company (Rocket PM).`,
    `Prompt version: ${BRIEFING_PROMPT_VERSION}.`,
    "",
    "MVP scope:",
    `- ${BRIEFING_MVP_SCOPE_NOTE}`,
    "- Only summarize synced Gmail/email threads provided in context.",
    "- Do NOT invent rent balances, deposit amounts, arrears totals, or ledger entries.",
    "- Future Buildium/accounting integration (RENT_PAYMENT, DEPOSIT source types) is NOT active.",
    "",
    "Rules:",
    "- Summarize only facts present in the provided context. Do not invent details.",
    "- Do not provide legal advice. Flag RTB, tribunal, or legal deadlines as review needed.",
    "- Preserve uncertainty when information is incomplete.",
    "- Ignore unrelated personal emails even if present in context.",
    "- Group related messages about the same property, tenant, or issue when possible.",
    "- Prefer concise operational summaries staff can act on quickly.",
    "- Never include raw long email bodies or lengthy quoted text in the output.",
    "- Output valid JSON only, matching the required schema exactly.",
    "",
    "Email-based categories (use exactly these enum values):",
    "URGENT — RTB/legal/review-needed/safety (from email signals only)",
    "LANDLORD — owner/landlord email threads",
    "TENANT — tenant email threads",
    "MAINTENANCE — maintenance/repair discussed in email (not work-order records)",
    "RENT_DEPOSIT — rent/deposit/payment mentioned in email ONLY; label as email mention, never as accounting fact",
    "STRATA — strata council/manager emails",
    "GENERAL_ADMIN — other PM admin email",
    "",
    "Urgency (use exactly these enum values):",
    "LOW, NORMAL, HIGH, URGENT",
    "",
    "Source type for MVP: always EMAIL with sourceThreadId from context.",
    "dataProvenance: always EMAIL_MENTION in MVP (never ACCOUNTING_SYSTEM or OPERATIONAL_SYSTEM).",
    "",
    "Rent/deposit guidance:",
    "- If email mentions rent, deposit, arrears, or payment, category may be RENT_DEPOSIT.",
    "- keyFacts must clarify this is an email mention (e.g. \"Email mentions overdue rent — verify in Buildium\").",
    "- Do not state dollar amounts unless explicitly quoted in the email excerpt.",
    "",
    "Each item must set isPropertyManagementRelated=true for included briefing items.",
    "keyFacts: maximum 5 concise bullet strings.",
    "estimatedReadingMinutes: realistic integer for staff reading the briefing.",
    "Include suggestedFollowUpActions for operational next steps.",
  ].join("\n");
}

export function buildBriefingUserPrompt(context: BriefingContext): string {
  return [
    `Generate a Daily Briefing for ${context.organization.name}.`,
    `Slot: ${context.slot}.`,
    `Scope: ${context.scopeNote}`,
    `Active sources: ${context.activeSourceTypes.join(", ")}.`,
    `Activity window: ${context.window.start} to ${context.window.end}.`,
    `Counts — scanned: ${context.counts.scanned}, included: ${context.counts.included}, skipped: ${context.counts.skipped}.`,
    "",
    "Return JSON with this shape:",
    JSON.stringify(
      {
        summaryTitle: "string",
        executiveSummary: "string",
        estimatedReadingMinutes: 5,
        scannedCount: context.counts.scanned,
        includedCount: context.counts.included,
        skippedCount: context.counts.skipped,
        sections: [
          {
            category: "RENT_DEPOSIT",
            items: [
              {
                sourceType: "EMAIL",
                sourceThreadId: "thread_id_from_context",
                summaryTitle: "Email mention: tenant asks about deposit return",
                category: "RENT_DEPOSIT",
                urgency: "NORMAL",
                keyFacts: ["Email mention: tenant asking about deposit return timing — not verified accounting data"],
                dataProvenance: "EMAIL_MENTION",
                isPropertyManagementRelated: true,
              },
            ],
          },
        ],
        suggestedFollowUpActions: [
          {
            action: "Review thread and verify deposit status in Buildium when integrated",
            relatedThreadId: "optional thread id",
            priority: "NORMAL",
          },
        ],
        warnings: ["optional uncertainty notes"],
      },
      null,
      2,
    ),
    "",
    "Thread context (subject/snippet/excerpts only — no raw bodies, no accounting data):",
    JSON.stringify(context.threads, null, 2),
  ].join("\n");
}

export function buildBriefingPromptMessages(context: BriefingContext): BriefingPromptMessages {
  return {
    system: buildBriefingSystemPrompt(),
    user: buildBriefingUserPrompt(context),
  };
}
