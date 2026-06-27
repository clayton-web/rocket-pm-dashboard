import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSlot,
  BriefingSourceType,
} from "@prisma/client";
import {
  buildDailyBriefingEmail,
  DAILY_BRIEFING_EMAIL_DISCLAIMER,
} from "@/lib/email/templates/daily-briefing-email";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import type { BriefingItemView } from "@/lib/briefing/briefing-queries";

function sampleItem(overrides: Partial<BriefingItemView> = {}): BriefingItemView {
  return {
    id: "item_1",
    summaryTitle: "Rent payment mentioned",
    category: BriefingItemCategory.RENT_DEPOSIT,
    urgency: BriefingItemUrgency.URGENT,
    sourceType: BriefingSourceType.EMAIL,
    subject: "Re: June rent",
    emailThreadId: "thread_1",
    dueDate: null,
    sortOrder: 0,
    summary: {
      keyFacts: ["Tenant emailed about rent timing"],
      requiredAction: "Confirm payment status",
      suggestedReplyNotes: "Acknowledge receipt",
      dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
    },
    showEmailMentionLabel: true,
    ...overrides,
  };
}

describe("buildDailyBriefingEmail", () => {
  it("renders executive summary and urgent rent/deposit items first", () => {
    const content = buildDailyBriefingEmail({
      orgName: "Axford PM",
      slot: BriefingSlot.MORNING,
      windowStart: new Date("2026-06-26T07:00:00.000Z"),
      windowEnd: new Date("2026-06-26T14:00:00.000Z"),
      executiveSummary: "One urgent rent mention and one tenant item.",
      runId: "run_1",
      runUrl: "https://app.example.com/briefing/run_1",
      inboxThreadUrl: (threadId) => `https://app.example.com/inbox/${threadId}`,
      items: [
        sampleItem(),
        sampleItem({
          id: "item_2",
          summaryTitle: "Leaking sink",
          category: BriefingItemCategory.TENANT,
          urgency: BriefingItemUrgency.NORMAL,
          showEmailMentionLabel: false,
        }),
      ],
    });

    assert.match(content.subject, /Morning Daily Briefing — Axford PM/);
    assert.match(content.text, /Executive summary/);
    assert.match(content.text, /One urgent rent mention and one tenant item./);
    assert.match(content.text, /Rent payment mentioned/);
    assert.match(content.text, /Leaking sink/);

    const rentIndex = content.text.indexOf("Rent payment mentioned");
    const tenantIndex = content.text.indexOf("Leaking sink");
    assert.ok(rentIndex >= 0 && tenantIndex >= 0 && rentIndex < tenantIndex);
  });

  it("includes Buildium email-mention disclaimer", () => {
    const content = buildDailyBriefingEmail({
      orgName: "Axford PM",
      slot: BriefingSlot.AFTERNOON,
      windowStart: new Date("2026-06-26T14:00:00.000Z"),
      windowEnd: new Date("2026-06-26T19:00:00.000Z"),
      executiveSummary: null,
      runId: "run_2",
      runUrl: "https://app.example.com/briefing/run_2",
      inboxThreadUrl: (threadId) => `https://app.example.com/inbox/${threadId}`,
      items: [sampleItem()],
    });

    assert.match(content.text, new RegExp(DAILY_BRIEFING_EMAIL_DISCLAIMER));
    assert.match(content.html, /Verify in Buildium once integrated/);
    assert.match(content.text, /Email mention only — verify in Buildium once integrated./);
  });

  it("does not include raw email body fields", () => {
    const content = buildDailyBriefingEmail({
      orgName: "Axford PM",
      slot: BriefingSlot.MORNING,
      windowStart: new Date("2026-06-26T07:00:00.000Z"),
      windowEnd: new Date("2026-06-26T14:00:00.000Z"),
      executiveSummary: "Summary only.",
      runId: "run_3",
      runUrl: "https://app.example.com/briefing/run_3",
      inboxThreadUrl: (threadId) => `https://app.example.com/inbox/${threadId}`,
      items: [sampleItem({ subject: "Safe subject line only" })],
    });

    assert.ok(!content.text.includes("bodyText"));
    assert.ok(!content.text.includes("snippet"));
    assert.match(content.text, /Safe subject line only/);
    assert.match(content.text, /https:\/\/app\.example\.com\/inbox\/thread_1/);
  });
});
