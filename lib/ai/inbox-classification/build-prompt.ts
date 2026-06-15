import {
  INBOX_CLASSIFICATION_MAX_BODY_CHARS,
  INBOX_CLASSIFICATION_MAX_MESSAGES,
  INBOX_CLASSIFICATION_PROMPT_VERSION,
} from "@/lib/ai/inbox-classification/constants";
import { EMAIL_THREAD_CATEGORY_DESCRIPTIONS } from "@/lib/inbox/email-thread-category";

export type InboxClassificationContext = {
  subject: string | null;
  snippet: string | null;
  participantEmails: string[];
  senderEmail: string | null;
  senderName: string | null;
  pmContextLines: string[];
  messages: Array<{
    fromAddr: string;
    isOutbound: boolean;
    sentAt: string;
    bodyText: string | null;
  }>;
};

function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function formatCategoryDefinitions(): string {
  return Object.entries(EMAIL_THREAD_CATEGORY_DESCRIPTIONS)
    .map(([key, description]) => `- ${key}: ${description}`)
    .join("\n");
}

export function buildInboxClassificationPrompt(context: InboxClassificationContext): {
  promptVersion: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
} {
  const recentMessages = context.messages.slice(-INBOX_CLASSIFICATION_MAX_MESSAGES);

  const lines: string[] = [];
  lines.push("## Thread");
  lines.push(`Subject: ${context.subject?.trim() || "(none)"}`);
  lines.push(`Snippet: ${context.snippet?.trim() || "(none)"}`);
  lines.push(`Participants: ${context.participantEmails.join(", ") || "(none)"}`);

  lines.push("\n## Primary sender");
  lines.push(`Email: ${context.senderEmail ?? "(unknown)"}`);
  if (context.senderName) {
    lines.push(`Name: ${context.senderName}`);
  }

  if (context.pmContextLines.length > 0) {
    lines.push("\n## Linked PM records");
    for (const line of context.pmContextLines) {
      lines.push(`- ${line}`);
    }
  }

  lines.push("\n## Recent messages (oldest to newest)");
  for (const message of recentMessages) {
    const body = message.bodyText?.trim() || "";
    lines.push(
      `- [${message.isOutbound ? "outbound" : "inbound"}] ${message.fromAddr} @ ${message.sentAt}: ${clampText(body, INBOX_CLASSIFICATION_MAX_BODY_CHARS)}`,
    );
  }

  const system = [
    "You classify synced property-management inbox email threads into Rocket PM dashboard crates.",
    "Return JSON only with keys: category, confidence, reason.",
    "category must be one of: LANDLORD_COMMUNICATION, TENANT_COMMUNICATION, STRATA, TENANT_INQUIRY, UNCATEGORIZED.",
    "confidence must be a number from 0 to 1.",
    "reason must be a short plain-language justification.",
    "Use UNCATEGORIZED when evidence is insufficient.",
    "",
    "Category definitions:",
    formatCategoryDefinitions(),
  ].join("\n");

  const user = [
    `Classify this email thread. Prompt version: ${INBOX_CLASSIFICATION_PROMPT_VERSION}.`,
    "",
    lines.join("\n"),
  ].join("\n");

  return {
    promptVersion: INBOX_CLASSIFICATION_PROMPT_VERSION,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}
