import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import {
  mapCloseOutChoiceToEnums,
  isShowingOpenForCloseOut,
} from "@/lib/leasing/showing-close-out";
import {
  parseCloseOutShowingFormInput,
  parseScheduleShowingFormInput,
} from "@/lib/validation/showing";

describe("mapCloseOutChoiceToEnums", () => {
  it("maps staff-friendly choices to existing enums", () => {
    assert.deepEqual(mapCloseOutChoiceToEnums("completed_interested"), {
      status: "completed",
      showingOutcome: "interested",
    });
    assert.deepEqual(mapCloseOutChoiceToEnums("completed_not_interested"), {
      status: "completed",
      showingOutcome: "not_interested",
    });
    assert.deepEqual(mapCloseOutChoiceToEnums("no_show"), {
      status: "no_show",
      showingOutcome: "no_show",
    });
    assert.deepEqual(mapCloseOutChoiceToEnums("cancelled"), {
      status: "cancelled",
      showingOutcome: null,
    });
    assert.deepEqual(mapCloseOutChoiceToEnums("reschedule_requested"), {
      status: "cancelled",
      showingOutcome: "reschedule",
    });
  });
});

describe("isShowingOpenForCloseOut", () => {
  it("only allows scheduled showings to close out", () => {
    assert.equal(isShowingOpenForCloseOut("scheduled"), true);
    assert.equal(isShowingOpenForCloseOut("completed"), false);
  });
});

describe("parseScheduleShowingFormInput", () => {
  it("accepts a valid schedule payload", () => {
    const parsed = parseScheduleShowingFormInput({
      scheduledStart: "2026-06-10T14:30",
      scheduledEnd: "2026-06-10T15:00",
      assignedToUserId: "user_1",
      notes: "Bring keys",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.assignedToUserId, "user_1");
    assert.equal(parsed.notes, "Bring keys");
    assert.ok(parsed.scheduledEnd);
  });

  it("rejects end before start", () => {
    const parsed = parseScheduleShowingFormInput({
      scheduledStart: "2026-06-10T15:00",
      scheduledEnd: "2026-06-10T14:30",
    });
    assert.ok("error" in parsed);
  });
});

describe("parseCloseOutShowingFormInput", () => {
  it("requires a valid close-out choice", () => {
    const parsed = parseCloseOutShowingFormInput({ choice: "completed_interested" });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.choice, "completed_interested");
  });

  it("rejects invalid choices", () => {
    const parsed = parseCloseOutShowingFormInput({ choice: "maybe" });
    assert.ok("error" in parsed);
  });
});

describe("buildApplicationPortalHandoff", () => {
  it("builds copy text with property, unit, and email context", () => {
    const handoff = buildApplicationPortalHandoff({
      propertyName: "Axford House",
      unitLabel: "Unit 2",
      email: "prospect@example.com",
      origin: "https://pm.example.com",
    });
    assert.equal(handoff.portalPath, "/portal/application");
    assert.match(handoff.copyText, /Axford House/);
    assert.match(handoff.copyText, /Unit 2/);
    assert.match(handoff.copyText, /prospect@example.com/);
    assert.match(handoff.copyText, /https:\/\/pm\.example\.com\/portal\/application/);
  });
});
