import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSlot } from "@prisma/client";
import {
  buildBriefingPromptMessages,
  buildBriefingSystemPrompt,
} from "@/lib/ai/briefing/briefing-prompt";
import type { BriefingContext } from "@/lib/briefing/briefing-types";

const sampleContext: BriefingContext = {
  promptVersion: "daily-briefing-v1",
  organization: { id: "org_1", name: "Axford PM" },
  slot: BriefingSlot.MORNING,
  window: {
    start: "2026-06-26T07:00:00.000Z",
    end: "2026-06-26T14:00:00.000Z",
  },
  activeSourceTypes: ["EMAIL"],
  scopeNote:
    "EMAIL-only MVP. Rent/deposit/payment references are email mentions, not accounting data. Buildium integration is future-ready only.",
  counts: { scanned: 2, included: 1, skipped: 1 },
  threads: [
    {
      threadId: "thread_1",
      newestMessageId: "msg_1",
      providerThreadId: "gmail_thread_1",
      providerMessageId: "gmail_msg_1",
      sender: "Alex Tenant",
      senderEmail: "tenant@example.com",
      subject: "Leaking sink",
      excerpt: "Water under the kitchen sink.",
      categoryHint: "TENANT",
      urgencyHint: "HIGH",
      entityHints: { propertyName: "Oak Street", unitLabel: "204" },
      reasonCodes: ["matched_tenant_email"],
      dataProvenance: "EMAIL_MENTION",
      lastMessageAt: "2026-06-26T12:00:00.000Z",
      isUnread: true,
    },
  ],
};

describe("buildBriefingPromptMessages", () => {
  it("includes BC PM and privacy instructions in the system prompt", () => {
    const system = buildBriefingSystemPrompt();
    assert.ok(system.includes("British Columbia"));
    assert.ok(system.includes("Do not provide legal advice"));
    assert.ok(system.includes("Never include raw long email bodies"));
    assert.ok(system.includes("RTB"));
    assert.ok(system.includes("Buildium"));
    assert.ok(system.includes("EMAIL_MENTION"));
    assert.ok(system.includes("Do NOT invent rent balances"));
  });

  it("includes organization, slot, and thread context in user prompt", () => {
    const { user } = buildBriefingPromptMessages(sampleContext);
    assert.ok(user.includes("Axford PM"));
    assert.ok(user.includes("MORNING"));
    assert.ok(user.includes("thread_1"));
    assert.ok(user.includes("Leaking sink"));
  });

  it("does not embed raw email bodies in prompt context", () => {
    const { user } = buildBriefingPromptMessages(sampleContext);
    assert.ok(!user.includes("bodyText"));
    assert.ok(user.includes("subject/snippet/excerpts only"));
    assert.ok(user.includes("EMAIL-only MVP"));
  });
});
