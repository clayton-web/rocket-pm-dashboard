import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDeterministicInboxFilters } from "./deterministic-filters";

function thread(overrides: {
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

describe("evaluateDeterministicInboxFilters", () => {
  it("classifies LMS building notices as STRATA, including forwarded subjects", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Fwd: LMS2505R - Building Notice - Dryer Vent Cleaning - 2026-06-22",
        messages: [{ fromAddr: "owner@example.com", bodyText: "Please forward to tenants." }],
      }),
    );

    assert.equal(result.action, "classify");
    if (result.action === "classify") {
      assert.equal(result.category, "STRATA");
    }
  });

  it("classifies BCS notices as STRATA", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({ subject: "BCS1234 - Annual General Meeting reminder" }),
    );

    assert.equal(result.action, "classify");
    if (result.action === "classify") {
      assert.equal(result.category, "STRATA");
    }
  });

  it("classifies known strata sender domains as STRATA", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Building maintenance update",
        messages: [{ fromAddr: "communications@mc.fsresidential.com" }],
      }),
    );

    assert.equal(result.action, "classify");
    if (result.action === "classify") {
      assert.equal(result.category, "STRATA");
    }
  });

  it("classifies tenancy agreement HelloSign notifications as TENANT_COMMUNICATION", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Everyone has signed w4th Tenancy Agreement",
        messages: [{ fromAddr: "noreply@mail.hellosign.com" }],
      }),
    );

    assert.equal(result.action, "classify");
    if (result.action === "classify") {
      assert.equal(result.category, "TENANT_COMMUNICATION");
    }
  });

  it("classifies lease agreement viewed notifications as TENANT_COMMUNICATION", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Emily Tennant has viewed lease agreement",
        messages: [{ fromAddr: "noreply@mail.hellosign.com" }],
      }),
    );

    assert.equal(result.action, "classify");
    if (result.action === "classify") {
      assert.equal(result.category, "TENANT_COMMUNICATION");
    }
  });

  it("leaves real estate sales offers uncategorized without Gemini", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "213th Offer revised has been signed by Katherine",
        messages: [{ fromAddr: "noreply@mail.hellosign.com" }],
      }),
    );

    assert.equal(result.action, "skip_uncategorized");
    if (result.action === "skip_uncategorized") {
      assert.match(result.reason, /sales\/offer/i);
    }
  });

  it("does not treat rental inquiries with offer language as sales offers", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Rental inquiry and application to rent 1365 West 4th",
        snippet: "We would like to apply for rent and schedule a viewing request.",
      }),
    );

    assert.equal(result.action, "none");
  });

  it("skips Google Alert newsletters without Gemini", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Google Alert - vancouver real estate",
        messages: [{ fromAddr: "googlealerts-noreply@google.com" }],
      }),
    );

    assert.equal(result.action, "skip_uncategorized");
    if (result.action === "skip_uncategorized") {
      assert.match(result.reason, /newsletter|alert|marketing/i);
    }
  });

  it("skips Travelzoo marketing without Gemini", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Vancouver travel deals inside",
        messages: [{ fromAddr: "exclusive@ca.travelzoo.com" }],
      }),
    );

    assert.equal(result.action, "skip_uncategorized");
  });

  it("falls through to Gemini when no deterministic rule matches", () => {
    const result = evaluateDeterministicInboxFilters(
      thread({
        subject: "Maintenance follow-up for unit 204",
        messages: [{ fromAddr: "tenant@example.com", bodyText: "The sink is still leaking." }],
      }),
    );

    assert.equal(result.action, "none");
  });
});
