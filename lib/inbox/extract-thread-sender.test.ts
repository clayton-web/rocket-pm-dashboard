import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractInboundSenderFromMessages } from "./extract-thread-sender";

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
});
