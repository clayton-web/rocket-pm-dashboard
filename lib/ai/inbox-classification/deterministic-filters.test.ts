import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "@/lib/db/prisma";
import { evaluateDeterministicInboxFilters } from "./deterministic-filters";

function thread(overrides: {
  organizationId?: string;
  subject?: string | null;
  snippet?: string | null;
  participantEmails?: string[];
  messages?: Array<{
    fromAddr: string;
    isOutbound?: boolean;
    sentAt?: Date;
    bodyText?: string | null;
  }>;
}) {
  return {
    organizationId: overrides.organizationId ?? "org_test",
    subject: overrides.subject ?? null,
    snippet: overrides.snippet ?? null,
    participantEmails: overrides.participantEmails ?? [],
    messages: (overrides.messages ?? []).map((message) => ({
      fromAddr: message.fromAddr,
      isOutbound: message.isOutbound ?? false,
      sentAt: message.sentAt ?? new Date("2026-06-10T12:00:00.000Z"),
      bodyText: message.bodyText ?? null,
    })),
  };
}

function withMockPrisma<T>(
  mocks: {
    propertyFindFirst?: () => Promise<{ id: string; name: string } | null>;
    tenancyContactFindFirst?: () => Promise<{ firstName: string; lastName: string } | null>;
  },
  run: () => Promise<T>,
): Promise<T> {
  const originalProperty = prisma.property;
  const originalContact = prisma.tenancyContact;

  Object.assign(prisma, {
    property: {
      findFirst: mocks.propertyFindFirst ?? (async () => null),
    },
    tenancyContact: {
      findFirst: mocks.tenancyContactFindFirst ?? (async () => null),
    },
  });

  return run().finally(() => {
    Object.assign(prisma, {
      property: originalProperty,
      tenancyContact: originalContact,
    });
  });
}

describe("evaluateDeterministicInboxFilters", () => {
  it("classifies owner email matches as LANDLORD_COMMUNICATION", async () => {
    const matches = await withMockPrisma(
      {
        propertyFindFirst: async () => ({ id: "prop_1", name: "Oak Street" }),
      },
      () =>
        evaluateDeterministicInboxFilters(
          thread({
            messages: [{ fromAddr: "owner@example.com", bodyText: "Please review the expense report." }],
          }),
        ),
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.category, "LANDLORD_COMMUNICATION");
  });

  it("classifies tenant email matches as TENANT_COMMUNICATION", async () => {
    const matches = await withMockPrisma(
      {
        tenancyContactFindFirst: async () => ({ firstName: "Alex", lastName: "Tenant" }),
      },
      () =>
        evaluateDeterministicInboxFilters(
          thread({
            messages: [{ fromAddr: "tenant@example.com", bodyText: "The sink is leaking." }],
          }),
        ),
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.category, "TENANT_COMMUNICATION");
  });

  it("classifies BCS, EPS, and LMS identifiers as STRATA", async () => {
    for (const subject of [
      "BCS1234 - Annual General Meeting reminder",
      "EPS 5678 levy notice",
      "Fwd: LMS2505R - Building Notice",
    ]) {
      const matches = await evaluateDeterministicInboxFilters(thread({ subject }));
      assert.equal(matches.length, 1);
      assert.equal(matches[0]?.category, "STRATA");
    }
  });

  it("accumulates tenant and strata matches", async () => {
    const matches = await withMockPrisma(
      {
        tenancyContactFindFirst: async () => ({ firstName: "Alex", lastName: "Tenant" }),
      },
      () =>
        evaluateDeterministicInboxFilters(
          thread({
            subject: "BCS1234 maintenance update",
            messages: [{ fromAddr: "tenant@example.com" }],
          }),
        ),
    );

    assert.deepEqual(
      matches.map((match) => match.category).sort(),
      ["STRATA", "TENANT_COMMUNICATION"],
    );
  });

  it("returns no matches when no hard rule applies", async () => {
    const matches = await evaluateDeterministicInboxFilters(
      thread({
        subject: "Maintenance follow-up for unit 204",
        messages: [{ fromAddr: "unknown@example.com", bodyText: "Any update?" }],
      }),
    );

    assert.deepEqual(matches, []);
  });
});
