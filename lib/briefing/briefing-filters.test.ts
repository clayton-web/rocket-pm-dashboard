import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingItemCategory, BriefingItemUrgency } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  BRIEFING_FILTER_REASON,
  evaluateBriefingEmailFilter,
} from "@/lib/briefing/briefing-filters";
import type { BriefingEmailThreadCandidate } from "@/lib/briefing/briefing-types";

function thread(overrides: Partial<BriefingEmailThreadCandidate> = {}): BriefingEmailThreadCandidate {
  return {
    id: overrides.id ?? "thread_1",
    organizationId: overrides.organizationId ?? "org_test",
    providerThreadId: overrides.providerThreadId ?? "gmail_thread_1",
    subject: overrides.subject ?? null,
    snippet: overrides.snippet ?? null,
    category: overrides.category ?? "UNCATEGORIZED",
    categoryConfidence: overrides.categoryConfidence ?? null,
    participantEmails: overrides.participantEmails ?? [],
    lastMessageAt: overrides.lastMessageAt ?? new Date("2026-06-26T12:00:00.000Z"),
    isUnread: overrides.isUnread ?? false,
    messages: overrides.messages ?? [
      {
        id: "msg_1",
        providerMessageId: "gmail_msg_1",
        fromAddr: "sender@example.com",
        isOutbound: false,
        sentAt: new Date("2026-06-26T12:00:00.000Z"),
        bodyText: null,
      },
    ],
  };
}

function withMockPrisma<T>(
  mocks: {
    propertyFindFirst?: () => Promise<{ id: string; name: string } | null>;
    tenancyContactFindFirst?: () => Promise<{
      id: string;
      firstName: string;
      lastName: string;
      tenancy: {
        id: string;
        unit: { unitNumber: string; property: { id: string; name: string } };
      };
    } | null>;
    prospectFindFirst?: () => Promise<{ id: string; firstName: string; lastName: string } | null>;
    applicationFindFirst?: () => Promise<{ id: string; firstName: string; lastName: string } | null>;
  },
  run: () => Promise<T>,
): Promise<T> {
  const originalProperty = prisma.property;
  const originalContact = prisma.tenancyContact;
  const originalProspect = prisma.prospect;
  const originalApplication = prisma.application;

  Object.assign(prisma, {
    property: { findFirst: mocks.propertyFindFirst ?? (async () => null) },
    tenancyContact: { findFirst: mocks.tenancyContactFindFirst ?? (async () => null) },
    prospect: { findFirst: mocks.prospectFindFirst ?? (async () => null) },
    application: { findFirst: mocks.applicationFindFirst ?? (async () => null) },
  });

  return run().finally(() => {
    Object.assign(prisma, {
      property: originalProperty,
      tenancyContact: originalContact,
      prospect: originalProspect,
      application: originalApplication,
    });
  });
}

describe("evaluateBriefingEmailFilter", () => {
  it("includes landlord threads matched by owner email", async () => {
    const result = await withMockPrisma(
      {
        propertyFindFirst: async () => ({ id: "prop_1", name: "Oak Street" }),
      },
      () =>
        evaluateBriefingEmailFilter(
          thread({
            messages: [
              {
                id: "msg_1",
                providerMessageId: "gmail_msg_1",
                fromAddr: "owner@example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-26T12:00:00.000Z"),
                bodyText: null,
              },
            ],
          }),
        ),
    );

    assert.equal(result.include, true);
    assert.equal(result.categorySuggestion, BriefingItemCategory.LANDLORD);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL));
  });

  it("includes tenant threads matched by tenancy contact email", async () => {
    const result = await withMockPrisma(
      {
        tenancyContactFindFirst: async () => ({
          id: "contact_1",
          firstName: "Alex",
          lastName: "Tenant",
          tenancy: {
            id: "ten_1",
            unit: { unitNumber: "204", property: { id: "prop_1", name: "Oak Street" } },
          },
        }),
      },
      () =>
        evaluateBriefingEmailFilter(
          thread({
            messages: [
              {
                id: "msg_1",
                providerMessageId: "gmail_msg_1",
                fromAddr: "tenant@example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-26T12:00:00.000Z"),
                bodyText: null,
              },
            ],
          }),
        ),
    );

    assert.equal(result.include, true);
    assert.equal(result.categorySuggestion, BriefingItemCategory.TENANT);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL));
  });

  it("classifies BCS and LMS identifiers as STRATA", async () => {
    for (const subject of ["BCS1234 council notice", "Update from LMS2505R"]) {
      const result = await evaluateBriefingEmailFilter(thread({ subject }));
      assert.equal(result.include, true, subject);
      assert.equal(result.categorySuggestion, BriefingItemCategory.STRATA);
      assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.STRATA_IDENTIFIER));
    }
  });

  it("flags RTB keywords as URGENT category", async () => {
    const result = await withMockPrisma(
      {
        propertyFindFirst: async () => ({ id: "prop_1", name: "Oak Street" }),
      },
      () =>
        evaluateBriefingEmailFilter(
          thread({
            subject: "RTB dispute resolution deadline",
            messages: [
              {
                id: "msg_1",
                providerMessageId: "gmail_msg_1",
                fromAddr: "owner@example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-26T12:00:00.000Z"),
                bodyText: null,
              },
            ],
          }),
        ),
    );

    assert.equal(result.include, true);
    assert.equal(result.categorySuggestion, BriefingItemCategory.URGENT);
    assert.equal(result.urgencySuggestion, BriefingItemUrgency.URGENT);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.RTB_REVIEW_NEEDED));
  });

  it("tags rent/deposit keyword threads as email mentions only", async () => {
    const result = await withMockPrisma(
      {
        tenancyContactFindFirst: async () => ({
          id: "contact_1",
          firstName: "Alex",
          lastName: "Tenant",
          tenancy: {
            id: "ten_1",
            unit: { unitNumber: "204", property: { id: "prop_1", name: "Oak Street" } },
          },
        }),
      },
      () =>
        evaluateBriefingEmailFilter(
          thread({
            subject: "Question about deposit return timing",
            messages: [
              {
                id: "msg_1",
                providerMessageId: "gmail_msg_1",
                fromAddr: "tenant@example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-26T12:00:00.000Z"),
                bodyText: null,
              },
            ],
          }),
        ),
    );

    assert.equal(result.include, true);
    assert.equal(result.categorySuggestion, BriefingItemCategory.TENANT);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.EMAIL_MENTION_RENT_DEPOSIT));
  });

  it("skips unrelated personal email without PM signals", async () => {
    const result = await evaluateBriefingEmailFilter(
      thread({
        subject: "Dinner plans this weekend?",
        snippet: "Want to grab pizza on Saturday?",
        messages: [
          {
            id: "msg_1",
            providerMessageId: "gmail_msg_1",
            fromAddr: "friend@personal.com",
            isOutbound: false,
            sentAt: new Date("2026-06-26T12:00:00.000Z"),
            bodyText: null,
          },
        ],
      }),
    );

    assert.equal(result.include, false);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.SKIPPED_NO_PM_SIGNAL));
  });

  it("skips keyword-only maintenance email without entity match", async () => {
    const result = await evaluateBriefingEmailFilter(
      thread({
        subject: "Maintenance follow-up",
        snippet: "Any update on the repair?",
        messages: [
          {
            id: "msg_1",
            providerMessageId: "gmail_msg_1",
            fromAddr: "unknown@example.com",
            isOutbound: false,
            sentAt: new Date("2026-06-26T12:00:00.000Z"),
            bodyText: null,
          },
        ],
      }),
    );

    assert.equal(result.include, false);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.SKIPPED_KEYWORD_ONLY));
  });

  it("skips outbound-only threads", async () => {
    const result = await evaluateBriefingEmailFilter(
      thread({
        messages: [
          {
            id: "msg_1",
            providerMessageId: "gmail_msg_1",
            fromAddr: "staff@pm.com",
            isOutbound: true,
            sentAt: new Date("2026-06-26T12:00:00.000Z"),
            bodyText: null,
          },
        ],
      }),
    );

    assert.equal(result.include, false);
    assert.ok(result.reasonCodes.includes(BRIEFING_FILTER_REASON.SKIPPED_OUTBOUND_ONLY));
  });
});
