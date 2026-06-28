import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingItemCategory,
  BriefingItemUrgency,
} from "@prisma/client";
import { BRIEFING_FILTER_REASON } from "@/lib/briefing/briefing-filters";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";
import {
  BRIEFING_NEXT_ACTION,
  BRIEFING_WAITING_ON,
  computeAgeDays,
  deriveCounterpartyWaitingOn,
  deriveEmailOperationsIntelligence,
  deriveNextAction,
  deriveWaitingOn,
  formatBriefingItemAge,
  isSystemSenderEmail,
  mergeOperationsIntoSummaryJson,
  parseOperationsSummaryJson,
  resolveOperationsForBriefingItemView,
} from "@/lib/briefing/sources/email/operations-intelligence";

const baseInput = {
  category: BriefingItemCategory.TENANT,
  urgency: BriefingItemUrgency.HIGH,
  latestMessageIsInbound: true,
  reasonCodes: [BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL],
  senderEmail: "tenant@example.com",
  subject: "Question about lease renewal",
  excerpt: "Can we discuss renewing the lease?",
  requiredAction: null,
  attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
};

describe("operations intelligence — waiting on", () => {
  it("assigns Property Manager when latest message is inbound", () => {
    assert.equal(deriveWaitingOn(baseInput), BRIEFING_WAITING_ON.PROPERTY_MANAGER);
  });

  it("assigns Tenant when latest message is outbound on tenant thread", () => {
    assert.equal(
      deriveCounterpartyWaitingOn({ ...baseInput, latestMessageIsInbound: false }),
      BRIEFING_WAITING_ON.TENANT,
    );
  });

  it("assigns Owner for landlord category", () => {
    assert.equal(
      deriveCounterpartyWaitingOn({
        ...baseInput,
        category: BriefingItemCategory.LANDLORD,
        reasonCodes: [BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL],
        latestMessageIsInbound: false,
      }),
      BRIEFING_WAITING_ON.OWNER,
    );
  });

  it("assigns Strata for strata category", () => {
    assert.equal(
      deriveCounterpartyWaitingOn({
        ...baseInput,
        category: BriefingItemCategory.STRATA,
        reasonCodes: [BRIEFING_FILTER_REASON.STRATA_IDENTIFIER],
        latestMessageIsInbound: false,
      }),
      BRIEFING_WAITING_ON.STRATA,
    );
  });

  it("assigns Applicant for prospect match", () => {
    assert.equal(
      deriveCounterpartyWaitingOn({
        ...baseInput,
        category: BriefingItemCategory.GENERAL_ADMIN,
        reasonCodes: [BRIEFING_FILTER_REASON.MATCHED_PROSPECT_EMAIL],
        latestMessageIsInbound: false,
      }),
      BRIEFING_WAITING_ON.APPLICANT,
    );
  });

  it("assigns Vendor for maintenance with vendor keywords", () => {
    assert.equal(
      deriveCounterpartyWaitingOn({
        ...baseInput,
        category: BriefingItemCategory.MAINTENANCE,
        reasonCodes: [],
        subject: "Plumber scheduled for unit 204",
        latestMessageIsInbound: false,
      }),
      BRIEFING_WAITING_ON.VENDOR,
    );
  });

  it("assigns System for automated senders", () => {
    assert.equal(isSystemSenderEmail("noreply@service.example.com"), true);
    assert.equal(
      deriveCounterpartyWaitingOn({
        ...baseInput,
        senderEmail: "noreply@service.example.com",
        latestMessageIsInbound: false,
      }),
      BRIEFING_WAITING_ON.SYSTEM,
    );
  });
});

describe("operations intelligence — next action", () => {
  it("assigns Await response when latest message is outbound", () => {
    assert.equal(
      deriveNextAction({ ...baseInput, latestMessageIsInbound: false }),
      BRIEFING_NEXT_ACTION.AWAIT_RESPONSE,
    );
  });

  it("assigns Reply for inbound tenant thread", () => {
    assert.equal(deriveNextAction(baseInput), BRIEFING_NEXT_ACTION.REPLY);
  });

  it("assigns Schedule work for inbound maintenance", () => {
    assert.equal(
      deriveNextAction({
        ...baseInput,
        category: BriefingItemCategory.MAINTENANCE,
        subject: "Broken furnace needs repair",
        reasonCodes: [BRIEFING_FILTER_REASON.EMAIL_MENTION_MAINTENANCE],
      }),
      BRIEFING_NEXT_ACTION.SCHEDULE_WORK,
    );
  });

  it("assigns Review for urgent RTB threads", () => {
    assert.equal(
      deriveNextAction({
        ...baseInput,
        category: BriefingItemCategory.URGENT,
        subject: "RTB dispute notice",
        reasonCodes: [BRIEFING_FILTER_REASON.RTB_REVIEW_NEEDED],
      }),
      BRIEFING_NEXT_ACTION.REVIEW,
    );
  });

  it("assigns Request approval for landlord threads", () => {
    assert.equal(
      deriveNextAction({
        ...baseInput,
        category: BriefingItemCategory.LANDLORD,
        subject: "Approval needed for exterior paint",
        reasonCodes: [BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL],
      }),
      BRIEFING_NEXT_ACTION.REQUEST_APPROVAL,
    );
  });

  it("assigns Follow up for carry-forward items", () => {
    assert.equal(
      deriveNextAction({
        ...baseInput,
        attentionSection: BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION,
      }),
      BRIEFING_NEXT_ACTION.FOLLOW_UP,
    );
  });
});

describe("operations intelligence — age", () => {
  it("formats same-day age as Today", () => {
    const reference = new Date("2026-06-28T18:00:00.000Z");
    const surfaced = new Date("2026-06-28T09:00:00.000Z");
    assert.equal(formatBriefingItemAge(surfaced, reference), "Today");
    assert.equal(computeAgeDays(surfaced, reference), 0);
  });

  it("formats multi-day age", () => {
    const reference = new Date("2026-06-28T18:00:00.000Z");
    const surfaced = new Date("2026-06-25T09:00:00.000Z");
    assert.equal(formatBriefingItemAge(surfaced, reference), "3 days");
    assert.equal(computeAgeDays(surfaced, reference), 3);
  });

  it("derives full operations payload", () => {
    const reference = new Date("2026-06-28T18:00:00.000Z");
    const surfaced = new Date("2026-06-27T10:00:00.000Z");
    const ops = deriveEmailOperationsIntelligence({
      input: baseInput,
      firstSurfacedAt: surfaced,
      referenceDate: reference,
    });

    assert.equal(ops.waitingOn, BRIEFING_WAITING_ON.PROPERTY_MANAGER);
    assert.equal(ops.nextAction, BRIEFING_NEXT_ACTION.REPLY);
    assert.equal(ops.ageLabel, "1 day");
    assert.equal(ops.ageDays, 1);
    assert.equal(ops.firstSurfacedAt, surfaced.toISOString());
  });
});

describe("operations intelligence — summary json helpers", () => {
  it("merges and parses operations fields", () => {
    const merged = mergeOperationsIntoSummaryJson({
      summaryJson: { keyFacts: ["Leak reported"] },
      operations: {
        waitingOn: BRIEFING_WAITING_ON.PROPERTY_MANAGER,
        nextAction: BRIEFING_NEXT_ACTION.REPLY,
        firstSurfacedAt: "2026-06-27T10:00:00.000Z",
        ageDays: 1,
        ageLabel: "1 day",
      },
    });

    const parsed = parseOperationsSummaryJson(merged);
    assert.equal(parsed.waitingOn, BRIEFING_WAITING_ON.PROPERTY_MANAGER);
    assert.equal(parsed.nextAction, BRIEFING_NEXT_ACTION.REPLY);
    assert.equal(parsed.ageLabel, "1 day");
  });

  it("resolves stored operations for display", () => {
    const resolved = resolveOperationsForBriefingItemView({
      summary: {
        waitingOn: BRIEFING_WAITING_ON.TENANT,
        nextAction: BRIEFING_NEXT_ACTION.AWAIT_RESPONSE,
        firstSurfacedAt: "2026-06-25T10:00:00.000Z",
        ageDays: 3,
        ageLabel: "3 days",
      },
      category: BriefingItemCategory.TENANT,
      urgency: BriefingItemUrgency.HIGH,
      referenceDate: new Date("2026-06-28T18:00:00.000Z"),
    });

    assert.equal(resolved.waitingOn, BRIEFING_WAITING_ON.TENANT);
    assert.equal(resolved.nextAction, BRIEFING_NEXT_ACTION.AWAIT_RESPONSE);
    assert.equal(resolved.ageLabel, "3 days");
  });

  it("falls back when legacy summary json lacks operations fields", () => {
    const resolved = resolveOperationsForBriefingItemView({
      summary: { requiredAction: "Reply to tenant" },
      category: BriefingItemCategory.TENANT,
      urgency: BriefingItemUrgency.NORMAL,
      attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
      referenceDate: new Date("2026-06-28T18:00:00.000Z"),
    });

    assert.equal(resolved.waitingOn, BRIEFING_WAITING_ON.PROPERTY_MANAGER);
    assert.equal(resolved.nextAction, BRIEFING_NEXT_ACTION.REPLY);
  });
});
