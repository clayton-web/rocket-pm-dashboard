/**
 * DRAFT ONLY. This must never be used as official rent or imported by
 * tenancy/application/lease-signing workflows. Official rent remains Tenancy.monthlyRent.
 *
 * RentalAdAssistantDraft stores temporary advertising helper content only.
 * It does not write to Property, Unit, Tenancy, Application, or lease/RTB-1 records.
 */
import { Prisma, type PrismaClient, type RentalAdAssistantDraft } from "@prisma/client";
import type {
  RentalAdAssistantCompsSnapshot,
  RentalAdAssistantInputs,
  RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";
import {
  ForbiddenError,
  hasOrgWidePropertyRights,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import type { StaffContext } from "./staff-context";

export type RentalAdAssistantDraftRecord = RentalAdAssistantDraft;

export type SaveRentalAdAssistantDraftOutputInput = {
  output: RentalAdAssistantOutput;
  compsSnapshot?: RentalAdAssistantCompsSnapshot;
  model?: string;
  promptVersion?: string;
  lastGeneratedAt?: Date;
};

type UnitWithProperty = {
  id: string;
  propertyId: string;
  property: { id: string; organizationId: string };
};

async function getUnitInActiveOrg(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<UnitWithProperty> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      propertyId: true,
      property: { select: { id: true, organizationId: true } },
    },
  });
  if (!unit) throw new NotFoundError("Unit not found");
  if (unit.property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this unit");
  }
  return unit;
}

async function requireDraftEditorAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  if (hasOrgWidePropertyRights(principal)) {
    await requirePropertyAccess(prisma, principal, propertyId);
    return;
  }
  await requirePropertyManagerAccess(prisma, principal, propertyId);
}

function toInputsJson(inputs: RentalAdAssistantInputs): Prisma.InputJsonValue {
  return inputs as unknown as Prisma.InputJsonValue;
}

function toOutputJson(output: RentalAdAssistantOutput): Prisma.InputJsonValue {
  return output as unknown as Prisma.InputJsonValue;
}

function toCompsJson(comps: RentalAdAssistantCompsSnapshot): Prisma.InputJsonValue {
  return comps as unknown as Prisma.InputJsonValue;
}

/** Returns the draft workspace for a unit, or null if none exists yet. */
export async function getRentalAdAssistantDraftForUnit(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<RentalAdAssistantDraft | null> {
  const unit = await getUnitInActiveOrg(prisma, principal, unitId);
  await requireDraftEditorAccess(prisma, principal, unit.propertyId);

  return prisma.rentalAdAssistantDraft.findFirst({
    where: {
      unitId: unit.id,
      organizationId: principal.organizationId,
    },
  });
}

/** Creates or updates draft inputs for a unit. Does not modify Property or Unit records. */
export async function saveRentalAdAssistantDraftInputs(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
  inputs: RentalAdAssistantInputs,
): Promise<RentalAdAssistantDraft> {
  const unit = await getUnitInActiveOrg(prisma, principal, unitId);
  await requireDraftEditorAccess(prisma, principal, unit.propertyId);

  const inputsJson = toInputsJson(inputs);

  return prisma.rentalAdAssistantDraft.upsert({
    where: { unitId: unit.id },
    create: {
      organizationId: principal.organizationId,
      propertyId: unit.propertyId,
      unitId: unit.id,
      createdByUserId: principal.userId,
      updatedByUserId: principal.userId,
      inputsJson,
    },
    update: {
      inputsJson,
      updatedByUserId: principal.userId,
    },
  });
}

/** Updates draft advertising output. Requires an existing draft row (save inputs first). */
export async function saveRentalAdAssistantDraftOutput(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
  input: SaveRentalAdAssistantDraftOutputInput,
): Promise<RentalAdAssistantDraft> {
  const unit = await getUnitInActiveOrg(prisma, principal, unitId);
  await requireDraftEditorAccess(prisma, principal, unit.propertyId);

  const existing = await prisma.rentalAdAssistantDraft.findFirst({
    where: {
      unitId: unit.id,
      organizationId: principal.organizationId,
    },
  });
  if (!existing) {
    throw new NotFoundError("Rental ad assistant draft not found. Save inputs first.");
  }

  const data: Prisma.RentalAdAssistantDraftUpdateInput = {
    outputJson: toOutputJson(input.output),
    updatedByUserId: principal.userId,
  };

  if (input.compsSnapshot !== undefined) {
    data.compsSnapshotJson = toCompsJson(input.compsSnapshot);
  }
  if (input.model !== undefined) data.model = input.model?.trim() || null;
  if (input.promptVersion !== undefined) data.promptVersion = input.promptVersion?.trim() || null;
  if (input.lastGeneratedAt !== undefined) data.lastGeneratedAt = input.lastGeneratedAt;

  return prisma.rentalAdAssistantDraft.update({
    where: { id: existing.id },
    data,
  });
}

/** Clears generated output metadata while keeping saved inputs. */
export async function clearRentalAdAssistantDraftOutput(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<RentalAdAssistantDraft> {
  const unit = await getUnitInActiveOrg(prisma, principal, unitId);
  await requireDraftEditorAccess(prisma, principal, unit.propertyId);

  const existing = await prisma.rentalAdAssistantDraft.findFirst({
    where: {
      unitId: unit.id,
      organizationId: principal.organizationId,
    },
  });
  if (!existing) {
    throw new NotFoundError("Rental ad assistant draft not found.");
  }

  return prisma.rentalAdAssistantDraft.update({
    where: { id: existing.id },
    data: {
      outputJson: Prisma.DbNull,
      compsSnapshotJson: Prisma.DbNull,
      model: null,
      promptVersion: null,
      lastGeneratedAt: null,
      updatedByUserId: principal.userId,
    },
  });
}
