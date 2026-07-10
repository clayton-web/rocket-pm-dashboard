import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveProspectPipelineNextAction,
  deriveProspectPipelineStage,
} from "@/lib/leasing/prospect-pipeline-stage";
import { adaptProspectToWorkItemDraft } from "./prospect-work-item";
import { classifyWorkItem } from "../classify-work-item";
import { labelForProspectPipelineNextAction } from "../next-action-labels";
import type { ProspectQueueRow } from "@/lib/leasing/staff-queue";

function baseRow(overrides: Partial<ProspectQueueRow> = {}): ProspectQueueRow {
  return {
    id: "pros_1",
    createdAt: "2026-07-01T12:00:00.000Z",
    propertyId: "prop_1",
    propertyName: "100 Oak St",
    unitLabel: "Unit 2",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: null,
    occupantCount: 1,
    hasPets: false,
    desiredMoveInDate: null,
    householdIncomeRangeLabel: null,
    preferredViewingNotes: null,
    messagePreview: null,
    pipelineStage: "viewing_request",
    pipelineStageLabel: "Viewing Request",
    pipelineNextAction: "schedule_viewing",
    primaryApplicationId: null,
    tenancyId: null,
    placementOnly: false,
    nextScheduledShowingStart: null,
    ...overrides,
  };
}

describe("adaptProspectToWorkItemDraft", () => {
  it("matches deriveProspectPipelineNextAction labels for schedule viewing", () => {
    const prospect = { status: "new", qualifiedAt: null, applicationSentAt: null };
    const pipeline = deriveProspectPipelineStage({
      prospect,
      showings: [],
      applications: [],
    });
    const action = deriveProspectPipelineNextAction(pipeline, prospect);
    const row = baseRow({
      pipelineStage: pipeline.stage,
      pipelineStageLabel: pipeline.stageLabel,
      pipelineNextAction: action,
    });
    const draft = adaptProspectToWorkItemDraft(row);
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, labelForProspectPipelineNextAction(action));
    assert.equal(draft.nextActionLabel, "Schedule Viewing");
    assert.equal(draft.href, "/leasing/prospects/pros_1");
  });

  it("matches send-application next action for viewing_booked", () => {
    const prospect = {
      status: "new",
      qualifiedAt: "2026-07-01T12:00:00.000Z",
      applicationSentAt: null,
    };
    const pipeline = deriveProspectPipelineStage({
      prospect,
      showings: [{ status: "scheduled" }],
      applications: [],
    });
    const action = deriveProspectPipelineNextAction(pipeline, prospect);
    assert.equal(action, "mark_application_sent");
    const draft = adaptProspectToWorkItemDraft(
      baseRow({
        pipelineStage: pipeline.stage,
        pipelineStageLabel: pipeline.stageLabel,
        pipelineNextAction: action,
        nextScheduledShowingStart: "2026-07-12T18:00:00.000Z",
      }),
    );
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, "Send application");
    const classified = classifyWorkItem(draft);
    assert.equal(classified?.primarySection, "needs_attention");
  });

  it("places application_sent in waiting on applicant", () => {
    const prospect = {
      status: "new",
      qualifiedAt: "2026-07-01T12:00:00.000Z",
      applicationSentAt: "2026-07-02T12:00:00.000Z",
    };
    const pipeline = deriveProspectPipelineStage({
      prospect,
      showings: [{ status: "completed" }],
      applications: [],
    });
    const action = deriveProspectPipelineNextAction(pipeline, prospect);
    const draft = adaptProspectToWorkItemDraft(
      baseRow({
        pipelineStage: pipeline.stage,
        pipelineStageLabel: pipeline.stageLabel,
        pipelineNextAction: action,
      }),
    );
    assert.ok(draft);
    assert.equal(draft.waitingOn, "applicant");
    assert.equal(classifyWorkItem(draft)?.primarySection, "waiting");
  });

  it("defers application_received and approved to application queues", () => {
    assert.equal(
      adaptProspectToWorkItemDraft(
        baseRow({ pipelineStage: "application_received", pipelineNextAction: "view_application" }),
      ),
      null,
    );
    assert.equal(
      adaptProspectToWorkItemDraft(
        baseRow({ pipelineStage: "approved", pipelineNextAction: "convert_application" }),
      ),
      null,
    );
  });
});
