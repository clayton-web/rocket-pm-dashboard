import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OFFBOARDING_ATTENTION_TONES,
  ONBOARDING_ATTENTION_TONES,
} from "@/components/leasing/leasing-status-tones";

const ONBOARDING_KINDS = ["overdue", "upcoming", "portal_not_ready", "pending"] as const;
const OFFBOARDING_KINDS = [
  "pending_notice",
  "awaiting_schedule",
  "awaiting_inspection_schedule",
  "awaiting_inspection_complete",
] as const;

const TONES = new Set(["neutral", "success", "warning", "danger", "info"]);

describe("onboarding attention tones", () => {
  it("maps every attention kind onto a shared tone", () => {
    for (const kind of ONBOARDING_KINDS) {
      assert.ok(TONES.has(ONBOARDING_ATTENTION_TONES[kind]), `${kind} has no valid tone`);
    }
  });

  it("escalates an overdue move-in above an upcoming one", () => {
    assert.equal(ONBOARDING_ATTENTION_TONES.overdue, "danger");
    assert.equal(ONBOARDING_ATTENTION_TONES.upcoming, "info");
    assert.equal(ONBOARDING_ATTENTION_TONES.portal_not_ready, "warning");
    assert.equal(ONBOARDING_ATTENTION_TONES.pending, "neutral");
  });

  it("keeps the four onboarding kinds visually distinguishable", () => {
    const tones = ONBOARDING_KINDS.map((k) => ONBOARDING_ATTENTION_TONES[k]);
    assert.equal(new Set(tones).size, tones.length);
  });
});

describe("offboarding attention tones", () => {
  it("maps every attention kind onto a shared tone", () => {
    for (const kind of OFFBOARDING_KINDS) {
      assert.ok(TONES.has(OFFBOARDING_ATTENTION_TONES[kind]), `${kind} has no valid tone`);
    }
  });

  /**
   * The deliberate collapse: four sequential steps previously carried four unrelated hues. Only the
   * notice-review gate is time-sensitive, so it stays the only warning; the inspection steps are
   * routine and rely on their labels for identity.
   */
  it("reserves warning for the time-sensitive notice gate", () => {
    assert.equal(OFFBOARDING_ATTENTION_TONES.pending_notice, "warning");
    assert.equal(OFFBOARDING_ATTENTION_TONES.awaiting_schedule, "info");
    assert.equal(OFFBOARDING_ATTENTION_TONES.awaiting_inspection_schedule, "neutral");
    assert.equal(OFFBOARDING_ATTENTION_TONES.awaiting_inspection_complete, "neutral");
  });

  it("uses a three-step ladder rather than a hue per step", () => {
    const tones = OFFBOARDING_KINDS.map((k) => OFFBOARDING_ATTENTION_TONES[k]);
    assert.equal(new Set(tones).size, 3);
  });
});
