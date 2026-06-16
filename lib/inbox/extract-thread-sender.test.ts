import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveInboxSenderDisplay, extractInboundSenderFromMessages } from "./extract-thread-sender";

describe("extractInboundSenderFromMessages", () => {
  it("uses the latest inbound message sender", () => {
    const sender = extractInboundSenderFromMessages([
      {
        fromAddr: "manager@pm.com",
        isOutbound: true,
        sentAt: new Date("2026-06-10T12:00:00.000Z"),
      },
      {
        fromAddr: "old@tenant.com",
        isOutbound: false,
        sentAt: new Date("2026-06-09T12:00:00.000Z"),
      },
      {
        fromAddr: "latest@tenant.com",
        isOutbound: false,
        sentAt: new Date("2026-06-10T11:00:00.000Z"),
      },
    ]);

    assert.deepEqual(sender, {
      senderEmail: "latest@tenant.com",
      senderName: null,
    });
  });

  it("returns null when thread has only outbound messages", () => {
    assert.equal(
      extractInboundSenderFromMessages([
        {
          fromAddr: "manager@pm.com",
          isOutbound: true,
          sentAt: new Date("2026-06-10T12:00:00.000Z"),
        },
      ]),
      null,
    );
  });

  it("parses display names from From headers", () => {
    const sender = extractInboundSenderFromMessages([
      {
        fromAddr: "Jane Doe <jane@tenant.com>",
        isOutbound: false,
        sentAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ]);

    assert.deepEqual(sender, {
      senderEmail: "jane@tenant.com",
      senderName: "Jane Doe",
    });
  });
});

describe("deriveInboxSenderDisplay", () => {
  it("prefers latest inbound from address", () => {
    assert.deepEqual(
      deriveInboxSenderDisplay({
        latestInboundFromAddr: "Strata Council <strata@building.com>",
        participantEmails: ["other@example.com"],
      }),
      {
        senderLabel: "Strata Council",
        senderEmail: "strata@building.com",
      },
    );
  });

  it("falls back to participant emails when inbound sender is missing", () => {
    assert.deepEqual(
      deriveInboxSenderDisplay({
        latestInboundFromAddr: null,
        participantEmails: ["clayton@theaxfords.com", "tenant@example.com"],
        mailboxEmail: "clayton@theaxfords.com",
      }),
      {
        senderLabel: "tenant@example.com",
        senderEmail: "tenant@example.com",
      },
    );
  });

  it("returns Unknown sender when no sender data exists", () => {
    assert.deepEqual(
      deriveInboxSenderDisplay({
        latestInboundFromAddr: null,
        participantEmails: [],
      }),
      {
        senderLabel: "Unknown sender",
        senderEmail: null,
      },
    );
  });
});
