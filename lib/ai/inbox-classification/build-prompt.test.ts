import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInboxClassificationPrompt } from "./build-prompt";

describe("buildInboxClassificationPrompt", () => {
  it("includes sender memory and PM context in the user prompt", () => {
    const prompt = buildInboxClassificationPrompt({
      subject: "Strata levy notice",
      snippet: "Please review the attached levy",
      participantEmails: ["strata@building.com", "manager@pm.com"],
      senderEmail: "strata@building.com",
      senderName: null,
      senderMemoryCategory: "STRATA",
      senderMemorySource: "manual",
      pmContextLines: ["[property] Oak Street: 2-bed condo in Vancouver"],
      messages: [
        {
          fromAddr: "strata@building.com",
          isOutbound: false,
          sentAt: "2026-06-10T10:00:00.000Z",
          bodyText: "Levy due next month.",
        },
      ],
    });

    const user = prompt.messages.find((message) => message.role === "user")?.content ?? "";
    const system = prompt.messages.find((message) => message.role === "system")?.content ?? "";

    assert.match(user, /Strata levy notice/);
    assert.match(user, /Remembered category: STRATA/);
    assert.match(user, /\[property\] Oak Street/);
    assert.match(system, /LANDLORD_COMMUNICATION/);
    assert.match(system, /TENANT_INQUIRY/);
    assert.equal(prompt.promptVersion, "inbox-classify-v1");
  });
});
