import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOnboardingNextStep } from "@/lib/leasing/onboarding-progress";
import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";
import { adaptOnboardingToWorkItemDraft } from "./onboarding-work-item";
import { classifyWorkItem } from "../classify-work-item";

function attentionRow(
  kind: OnboardingAttentionRow["kind"],
  overrides: Partial<OnboardingAttentionRow> = {},
): OnboardingAttentionRow {
  return {
    kind,
    badgeLabel:
      kind === "overdue"
        ? "Overdue move-in"
        : kind === "upcoming"
          ? "Upcoming move-in"
          : kind === "portal_not_ready"
            ? "Portal not ready"
            : "Pending move-in",
    href: "/leasing/tenancies/ten_1",
    sortAt: "2026-07-01",
    tenantLabel: "Tina Tenant",
    propertyName: "100 Oak St",
    unitLabel: "Unit 3",
    moveInDate: kind === "overdue" ? "2026-07-01" : "2026-07-14",
    leaseStartDate: "2026-07-01",
    portalAccessEnabled: kind === "portal_not_ready" ? false : true,
    tenancy: {
      id: "ten_1",
      status: "pending_move_in",
      propertyId: "prop_1",
      propertyName: "100 Oak St",
      unitLabel: "Unit 3",
      tenantLabel: "Tina Tenant",
      moveInDate: kind === "overdue" ? "2026-07-01" : "2026-07-14",
      leaseStartDate: "2026-07-01",
      monthlyRent: "2000",
      createdAt: "2026-06-01T12:00:00.000Z",
      portalAccessEnabled: kind === "portal_not_ready" ? false : true,
    },
    ...overrides,
  };
}

describe("adaptOnboardingToWorkItemDraft", () => {
  it("passes through getOnboardingNextStep title (equivalence)", () => {
    const nextStep = getOnboardingNextStep({
      portalAccessEnabled: true,
      moveInDate: "2026-07-01",
      leaseSetupStatus: "lease_setup_incomplete",
    });
    const draft = adaptOnboardingToWorkItemDraft(attentionRow("pending"), nextStep);
    assert.equal(draft.nextActionLabel, nextStep.title);
    assert.equal(draft.nextActionLabel, "Complete lease setup");
  });

  it("classifies overdue attention as overdue section", () => {
    const nextStep = getOnboardingNextStep({
      portalAccessEnabled: true,
      moveInDate: "2026-07-01",
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      activationReady: false,
    });
    const draft = adaptOnboardingToWorkItemDraft(attentionRow("overdue"), nextStep);
    assert.equal(draft.nextActionLabel, nextStep.title);
    assert.equal(classifyWorkItem(draft)?.primarySection, "overdue");
  });

  it("classifies upcoming attention as coming_up", () => {
    const nextStep = getOnboardingNextStep({
      portalAccessEnabled: true,
      moveInDate: "2026-07-14",
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: true,
        executed: true,
      },
      activationReady: true,
    });
    const draft = adaptOnboardingToWorkItemDraft(attentionRow("upcoming"), nextStep);
    assert.equal(draft.nextActionLabel, nextStep.title);
    assert.equal(classifyWorkItem(draft)?.primarySection, "coming_up");
  });

  it("classifies await_tenant_signature as waiting", () => {
    const nextStep = getOnboardingNextStep({
      portalAccessEnabled: true,
      moveInDate: "2026-07-20",
      leaseSetupStatus: "ready_for_rtb1",
      leaseExecution: {
        hasRtb1Draft: true,
        signatureSent: true,
        tenantSigned: false,
        executed: false,
      },
    });
    assert.equal(nextStep.kind, "await_tenant_signature");
    const draft = adaptOnboardingToWorkItemDraft(attentionRow("pending"), nextStep);
    assert.equal(draft.nextActionLabel, nextStep.title);
    assert.equal(classifyWorkItem(draft)?.primarySection, "waiting");
    assert.equal(draft.waitingOn, "tenant");
  });
});
