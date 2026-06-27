import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countOutboundMessages,
  detectOutboundReplyAfter,
} from "@/lib/briefing/sources/email/active-email-items/detect-outbound-reply";

describe("detectOutboundReplyAfter", () => {
  const surfacedAt = new Date("2026-06-26T10:00:00.000Z");

  it("returns null when no outbound message exists after the baseline", () => {
    const result = detectOutboundReplyAfter({
      after: surfacedAt,
      messages: [
        { isOutbound: false, sentAt: new Date("2026-06-26T09:00:00.000Z") },
        { isOutbound: true, sentAt: new Date("2026-06-26T09:30:00.000Z") },
      ],
    });

    assert.equal(result, null);
  });

  it("returns the newest outbound sentAt after the baseline", () => {
    const result = detectOutboundReplyAfter({
      after: surfacedAt,
      messages: [
        { isOutbound: true, sentAt: new Date("2026-06-26T10:15:00.000Z") },
        { isOutbound: true, sentAt: new Date("2026-06-26T11:00:00.000Z") },
        { isOutbound: false, sentAt: new Date("2026-06-26T12:00:00.000Z") },
      ],
    });

    assert.equal(result?.toISOString(), "2026-06-26T11:00:00.000Z");
  });

  it("ignores inbound messages after the baseline", () => {
    const result = detectOutboundReplyAfter({
      after: surfacedAt,
      messages: [{ isOutbound: false, sentAt: new Date("2026-06-26T11:00:00.000Z") }],
    });

    assert.equal(result, null);
  });
});

describe("countOutboundMessages", () => {
  const messages = [
    { isOutbound: true, sentAt: new Date("2026-06-26T09:00:00.000Z") },
    { isOutbound: false, sentAt: new Date("2026-06-26T09:30:00.000Z") },
    { isOutbound: true, sentAt: new Date("2026-06-26T10:30:00.000Z") },
  ];

  it("counts all outbound messages when no cutoff is provided", () => {
    assert.equal(countOutboundMessages({ messages }), 2);
  });

  it("counts outbound messages sent on or before the cutoff", () => {
    assert.equal(
      countOutboundMessages({
        messages,
        beforeInclusive: new Date("2026-06-26T10:00:00.000Z"),
      }),
      1,
    );
  });
});
