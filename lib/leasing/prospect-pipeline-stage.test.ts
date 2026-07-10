import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveProspectPipelineNextAction,
  deriveProspectPipelineStage,
  PROSPECT_PIPELINE_STAGE_LABELS,
} from "./prospect-pipeline-stage";

const baseProspect = {
  status: "new" as const,
  qualifiedAt: null,
  applicationSentAt: null,
};

describe("deriveProspectPipelineStage", () => {
  it("returns viewing_request for a fresh prospect", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [],
    });
    assert.equal(result.stage, "viewing_request");
    assert.equal(result.stageLabel, PROSPECT_PIPELINE_STAGE_LABELS.viewing_request);
  });

  it("returns qualified when qualifiedAt is set", () => {
    const result = deriveProspectPipelineStage({
      prospect: { ...baseProspect, qualifiedAt: "2026-06-10T12:00:00.000Z" },
      showings: [],
      applications: [],
    });
    assert.equal(result.stage, "qualified");
  });

  it("returns viewing_booked when a scheduled showing exists", () => {
    const result = deriveProspectPipelineStage({
      prospect: { ...baseProspect, qualifiedAt: "2026-06-10T12:00:00.000Z" },
      showings: [{ status: "scheduled" }],
      applications: [],
    });
    assert.equal(result.stage, "viewing_booked");
  });

  it("returns application_sent when applicationSentAt is set without a submitted app", () => {
    const result = deriveProspectPipelineStage({
      prospect: {
        ...baseProspect,
        qualifiedAt: "2026-06-10T12:00:00.000Z",
        applicationSentAt: "2026-06-11T12:00:00.000Z",
      },
      showings: [{ status: "completed" }],
      applications: [{ id: "app_1", status: "draft", hasTenancy: false }],
    });
    assert.equal(result.stage, "application_sent");
  });

  it("returns application_received for submitted applications", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [
        {
          id: "app_1",
          status: "submitted",
          submittedAt: "2026-06-12T12:00:00.000Z",
          hasTenancy: false,
        },
      ],
    });
    assert.equal(result.stage, "application_received");
    assert.equal(result.primaryApplicationId, "app_1");
  });

  it("returns approved for approved applications without tenancy", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [{ id: "app_1", status: "approved", hasTenancy: false }],
    });
    assert.equal(result.stage, "approved");
  });

  it("returns declined for declined applications", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [{ id: "app_1", status: "declined", hasTenancy: false }],
    });
    assert.equal(result.stage, "declined");
  });

  it("returns tenant when the primary application has a tenancy", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [
        {
          id: "app_1",
          status: "approved",
          hasTenancy: true,
          tenancyId: "ten_1",
        },
      ],
    });
    assert.equal(result.stage, "tenant");
    assert.equal(result.tenancyId, "ten_1");
  });

  it("returns placed when the primary application has a tenant placement", () => {
    const result = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [
        {
          id: "app_1",
          status: "approved",
          hasTenancy: false,
          hasPlacement: true,
          placementId: "place_1",
        },
      ],
    });
    assert.equal(result.stage, "placed");
    assert.equal(result.placementId, "place_1");
  });

  it("returns archived for archived prospects regardless of related records", () => {
    const result = deriveProspectPipelineStage({
      prospect: { ...baseProspect, status: "archived" },
      showings: [{ status: "scheduled" }],
      applications: [{ id: "app_1", status: "approved", hasTenancy: true, tenancyId: "ten_1" }],
    });
    assert.equal(result.stage, "archived");
  });

  it("prefers application_received over application_sent timestamp", () => {
    const result = deriveProspectPipelineStage({
      prospect: { ...baseProspect, applicationSentAt: "2026-06-11T12:00:00.000Z" },
      showings: [],
      applications: [{ id: "app_1", status: "under_review", hasTenancy: false }],
    });
    assert.equal(result.stage, "application_received");
  });
});

describe("deriveProspectPipelineNextAction", () => {
  it("suggests mark qualified at viewing request", () => {
    const pipeline = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [],
    });
    assert.equal(deriveProspectPipelineNextAction(pipeline, baseProspect), "mark_qualified");
  });

  it("suggests convert application when approved", () => {
    const pipeline = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [{ id: "app_1", status: "approved", hasTenancy: false }],
    });
    assert.equal(deriveProspectPipelineNextAction(pipeline, baseProspect), "convert_application");
  });

  it("suggests complete placement when approved on a placement-only property", () => {
    const pipeline = deriveProspectPipelineStage({
      prospect: baseProspect,
      showings: [],
      applications: [{ id: "app_1", status: "approved", hasTenancy: false }],
    });
    assert.equal(
      deriveProspectPipelineNextAction(pipeline, baseProspect, { placementOnly: true }),
      "complete_placement",
    );
  });
});
