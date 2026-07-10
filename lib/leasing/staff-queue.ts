import prisma from "@/lib/db/prisma";
import {
  deriveProspectPipelineNextAction,
  deriveProspectPipelineStage,
  isProspectAttentionComplete,
  type ProspectPipelineNextAction,
} from "@/lib/leasing/prospect-pipeline-stage";
import { formatHouseholdIncomeRange } from "@/lib/leasing/prospect-intake";
import { formatPropertyAddress, formatUnitLabel } from "@/lib/property/display";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser, listProspectsForProperty } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

export type ProspectQueueRow = {
  id: string;
  createdAt: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  occupantCount: number | null;
  hasPets: boolean;
  desiredMoveInDate: string | null;
  householdIncomeRangeLabel: string | null;
  preferredViewingNotes: string | null;
  messagePreview: string | null;
  pipelineStage: string;
  pipelineStageLabel: string;
  /** Derived via deriveProspectPipelineNextAction — same source as prospect detail. */
  pipelineNextAction: ProspectPipelineNextAction;
  primaryApplicationId: string | null;
  tenancyId: string | null;
  placementOnly: boolean;
  /** Earliest scheduled showing start, when present. */
  nextScheduledShowingStart: string | null;
};

export async function listNewProspectQueueForStaff(ctx: StaffContext): Promise<ProspectQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: ProspectQueueRow[] = [];
  const allProspectIds: string[] = [];
  const placementOnlyByPropertyId = new Map<string, boolean>();

  for (const property of properties) {
    placementOnlyByPropertyId.set(property.id, property.serviceRelationship === "PLACEMENT_ONLY");
    let prospects;
    try {
      prospects = await listProspectsForProperty(prisma, ctx, property.id, { status: "new" });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    const unitIds = [...new Set(prospects.map((p) => p.unitId).filter(Boolean))] as string[];
    const units =
      unitIds.length > 0
        ? await prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, unitNumber: true },
          })
        : [];
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const p of prospects) {
      allProspectIds.push(p.id);
      const unitNumber = p.unitId ? unitById.get(p.unitId) : null;
      rows.push({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        propertyId: property.id,
        propertyName: formatPropertyAddress(property),
        unitLabel: formatUnitLabel(unitNumber),
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        occupantCount: p.occupantCount,
        hasPets: p.hasPets,
        desiredMoveInDate: p.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
        householdIncomeRangeLabel: p.householdIncomeRange
          ? formatHouseholdIncomeRange(p.householdIncomeRange)
          : null,
        preferredViewingNotes: p.preferredViewingNotes,
        messagePreview: p.message,
        pipelineStage: "viewing_request",
        pipelineStageLabel: "Viewing Request",
        pipelineNextAction: "schedule_viewing",
        primaryApplicationId: null,
        tenancyId: null,
        placementOnly: placementOnlyByPropertyId.get(property.id) === true,
        nextScheduledShowingStart: null,
      });
    }
  }

  if (allProspectIds.length === 0) {
    return rows;
  }

  const [showings, applications] = await Promise.all([
    prisma.showing.findMany({
      where: { prospectId: { in: allProspectIds } },
      select: { prospectId: true, status: true, scheduledStart: true },
    }),
    prisma.application.findMany({
      where: { prospectId: { in: allProspectIds } },
      select: {
        prospectId: true,
        id: true,
        status: true,
        submittedAt: true,
        tenancy: { select: { id: true } },
        tenantPlacement: { select: { id: true } },
      },
    }),
  ]);

  const showingsByProspect = new Map<string, { status: string; scheduledStart: Date }[]>();
  for (const showing of showings) {
    const list = showingsByProspect.get(showing.prospectId) ?? [];
    list.push({ status: showing.status, scheduledStart: showing.scheduledStart });
    showingsByProspect.set(showing.prospectId, list);
  }

  const applicationsByProspect = new Map<
    string,
    {
      id: string;
      status: string;
      submittedAt: Date | null;
      hasTenancy: boolean;
      tenancyId: string | null;
      hasPlacement: boolean;
      placementId: string | null;
    }[]
  >();
  for (const application of applications) {
    if (!application.prospectId) continue;
    const list = applicationsByProspect.get(application.prospectId) ?? [];
    list.push({
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt,
      hasTenancy: application.tenancy != null,
      tenancyId: application.tenancy?.id ?? null,
      hasPlacement: application.tenantPlacement != null,
      placementId: application.tenantPlacement?.id ?? null,
    });
    applicationsByProspect.set(application.prospectId, list);
  }

  const prospectById = new Map(
    (
      await prisma.prospect.findMany({
        where: { id: { in: allProspectIds } },
        select: {
          id: true,
          status: true,
          qualifiedAt: true,
          applicationSentAt: true,
        },
      })
    ).map((prospect) => [prospect.id, prospect]),
  );

  for (const row of rows) {
    const prospect = prospectById.get(row.id);
    if (!prospect) continue;
    const prospectShowings = showingsByProspect.get(row.id) ?? [];
    const pipeline = deriveProspectPipelineStage({
      prospect,
      showings: prospectShowings,
      applications: applicationsByProspect.get(row.id) ?? [],
    });
    row.pipelineStage = pipeline.stage;
    row.pipelineStageLabel = pipeline.stageLabel;
    row.primaryApplicationId = pipeline.primaryApplicationId;
    row.tenancyId = pipeline.tenancyId;
    row.pipelineNextAction = deriveProspectPipelineNextAction(pipeline, prospect, {
      placementOnly: row.placementOnly,
    });
    const nextScheduled = prospectShowings
      .filter((s) => s.status === "scheduled")
      .map((s) => s.scheduledStart)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    row.nextScheduledShowingStart = nextScheduled?.toISOString() ?? null;
  }

  const attentionRows = rows.filter(
    (row) => !isProspectAttentionComplete(row.pipelineStage as Parameters<typeof isProspectAttentionComplete>[0]),
  );

  attentionRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return attentionRows;
}
