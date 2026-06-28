import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingItemCategory, BriefingItemUrgency } from "@prisma/client";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";
import {
  buildOperationsIntelligenceInputFromContextThread,
  enrichBriefingEmailSummaryJson,
} from "@/lib/briefing/sources/email/enrich-email-operations-summary";
import {
  BRIEFING_NEXT_ACTION,
  BRIEFING_WAITING_ON,
} from "@/lib/briefing/sources/email/operations-intelligence";

describe("enrichBriefingEmailSummaryJson", () => {
  it("adds operations intelligence fields to summary json", () => {
    const enriched = enrichBriefingEmailSummaryJson({
      summaryJson: {
        keyFacts: ["Lease question"],
        requiredAction: "Reply with renewal options",
      },
      operationsInput: buildOperationsIntelligenceInputFromContextThread({
        thread: {
          threadId: "thread_1",
          newestMessageId: "msg_1",
          providerThreadId: "gmail_1",
          providerMessageId: "gmail_msg_1",
          sender: "Alex Tenant",
          senderEmail: "tenant@example.com",
          subject: "Lease renewal question",
          categoryHint: BriefingItemCategory.TENANT,
          urgencyHint: BriefingItemUrgency.HIGH,
          entityHints: { contactName: "Alex Tenant" },
          reasonCodes: ["matched_tenant_email"],
          dataProvenance: "EMAIL_MENTION",
          lastMessageAt: "2026-06-26T12:00:00.000Z",
          isUnread: true,
          latestMessageIsInbound: true,
        },
        category: BriefingItemCategory.TENANT,
        urgency: BriefingItemUrgency.HIGH,
        attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
        requiredAction: "Reply with renewal options",
      }),
      firstSurfacedAt: new Date("2026-06-26T12:00:00.000Z"),
      referenceDate: new Date("2026-06-26T14:00:00.000Z"),
    });

    assert.equal(enriched.waitingOn, BRIEFING_WAITING_ON.PROPERTY_MANAGER);
    assert.equal(enriched.nextAction, BRIEFING_NEXT_ACTION.REPLY);
    assert.equal(enriched.ageLabel, "Today");
    assert.equal(typeof enriched.firstSurfacedAt, "string");
  });
});
