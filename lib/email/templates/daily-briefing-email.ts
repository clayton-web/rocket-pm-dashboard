import type { BriefingItemView } from "@/lib/briefing/briefing-queries";
import {
  BRIEFING_CATEGORY_LABELS,
  BRIEFING_SLOT_LABELS,
  groupBriefingItemsByCategory,
} from "@/lib/briefing/briefing-queries";
import type { BriefingSlot } from "@prisma/client";

export const DAILY_BRIEFING_EMAIL_DISCLAIMER =
  "Email-based briefing only. Rent/deposit/payment notes are email mentions, not accounting records. Verify in Buildium once integrated.";

export type DailyBriefingEmailInput = {
  orgName: string;
  slot: BriefingSlot;
  windowStart: Date;
  windowEnd: Date;
  executiveSummary: string | null;
  runId: string;
  runUrl: string;
  inboxThreadUrl: (threadId: string) => string;
  items: BriefingItemView[];
};

export type DailyBriefingEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function formatWindow(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

function formatDueDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function buildItemTextLines(
  item: BriefingItemView,
  runUrl: string,
  inboxThreadUrl: (threadId: string) => string,
): string[] {
  const lines = [
    item.summaryTitle,
    `Urgency: ${item.urgency}`,
    `Category: ${BRIEFING_CATEGORY_LABELS[item.category]}`,
  ];

  if (item.subject) {
    lines.push(`Subject: ${item.subject}`);
  }

  if (item.showEmailMentionLabel) {
    lines.push("Note: Email mention only — verify in Buildium once integrated.");
  }

  if (item.summary.keyFacts?.length) {
    lines.push("Key facts:");
    for (const fact of item.summary.keyFacts) {
      lines.push(`- ${fact}`);
    }
  }

  if (item.summary.requiredAction) {
    lines.push(`Required action: ${item.summary.requiredAction}`);
  }

  if (item.summary.suggestedReplyNotes) {
    lines.push(`Suggested reply notes: ${item.summary.suggestedReplyNotes}`);
  }

  const dueLabel = formatDueDate(item.dueDate);
  if (dueLabel) {
    lines.push(`Due: ${dueLabel}`);
  }

  lines.push(`View run: ${runUrl}`);

  if (item.emailThreadId) {
    lines.push(`Open inbox thread: ${inboxThreadUrl(item.emailThreadId)}`);
  }

  return lines;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildItemHtml(item: BriefingItemView, runUrl: string, inboxThreadUrl: string | null): string {
  const parts = [
    `<h3>${escapeHtml(item.summaryTitle)}</h3>`,
    `<p><strong>Urgency:</strong> ${escapeHtml(item.urgency)}<br>`,
    `<strong>Category:</strong> ${escapeHtml(BRIEFING_CATEGORY_LABELS[item.category])}</p>`,
  ];

  if (item.subject) {
    parts.push(`<p><strong>Subject:</strong> ${escapeHtml(item.subject)}</p>`);
  }

  if (item.showEmailMentionLabel) {
    parts.push(
      `<p><em>Email mention only — verify in Buildium once integrated.</em></p>`,
    );
  }

  if (item.summary.keyFacts?.length) {
    parts.push("<p><strong>Key facts:</strong></p><ul>");
    for (const fact of item.summary.keyFacts) {
      parts.push(`<li>${escapeHtml(fact)}</li>`);
    }
    parts.push("</ul>");
  }

  if (item.summary.requiredAction) {
    parts.push(`<p><strong>Required action:</strong> ${escapeHtml(item.summary.requiredAction)}</p>`);
  }

  if (item.summary.suggestedReplyNotes) {
    parts.push(
      `<p><strong>Suggested reply notes:</strong> ${escapeHtml(item.summary.suggestedReplyNotes)}</p>`,
    );
  }

  const dueLabel = formatDueDate(item.dueDate);
  if (dueLabel) {
    parts.push(`<p><strong>Due:</strong> ${escapeHtml(dueLabel)}</p>`);
  }

  parts.push(`<p><a href="${runUrl}">View briefing run</a></p>`);

  if (inboxThreadUrl) {
    parts.push(`<p><a href="${inboxThreadUrl}">Open inbox thread</a></p>`);
  }

  return parts.join("\n");
}

export function buildDailyBriefingEmail(input: DailyBriefingEmailInput): DailyBriefingEmailContent {
  const slotLabel = BRIEFING_SLOT_LABELS[input.slot];
  const subject = `${slotLabel} Daily Briefing — ${input.orgName}`;
  const windowLabel = formatWindow(input.windowStart, input.windowEnd);
  const groups = groupBriefingItemsByCategory(input.items);

  const textLines = [
    "Daily Briefing",
    slotLabel,
    `Window: ${windowLabel}`,
    "",
  ];

  if (input.executiveSummary) {
    textLines.push("Executive summary", input.executiveSummary, "");
  }

  for (const group of groups) {
    textLines.push(BRIEFING_CATEGORY_LABELS[group.category], "");
    for (const item of group.items) {
      textLines.push(...buildItemTextLines(item, input.runUrl, input.inboxThreadUrl), "");
    }
  }

  textLines.push(`Full briefing: ${input.runUrl}`, "", DAILY_BRIEFING_EMAIL_DISCLAIMER);

  const htmlParts = [
    "<h1>Daily Briefing</h1>",
    `<p><strong>${escapeHtml(slotLabel)}</strong><br>Window: ${escapeHtml(windowLabel)}</p>`,
  ];

  if (input.executiveSummary) {
    htmlParts.push(
      "<h2>Executive summary</h2>",
      `<p>${escapeHtml(input.executiveSummary)}</p>`,
    );
  }

  for (const group of groups) {
    htmlParts.push(`<h2>${escapeHtml(BRIEFING_CATEGORY_LABELS[group.category])}</h2>`);
    for (const item of group.items) {
      const inboxUrl = item.emailThreadId ? input.inboxThreadUrl(item.emailThreadId) : null;
      htmlParts.push(buildItemHtml(item, input.runUrl, inboxUrl));
    }
  }

  htmlParts.push(
    `<p><a href="${input.runUrl}">Open full briefing in Rocket PM</a></p>`,
    `<p><small>${escapeHtml(DAILY_BRIEFING_EMAIL_DISCLAIMER)}</small></p>`,
  );

  return {
    subject,
    text: textLines.join("\n"),
    html: htmlParts.join("\n"),
  };
}
