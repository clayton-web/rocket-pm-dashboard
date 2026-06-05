/**
 * Rental Ad Assistant action handlers — draft helper only.
 * Does not write to Tenancy, Property, Unit, Application, lease/RTB-1, or portal records.
 */
import type { PrismaClient } from "@prisma/client";
import { finalizeRentalAdAssistantOutput } from "@/lib/ai/rental-ad-assistant/finalize-output";
import {
  generateRentalAdAssistantDraft,
  type CreateChatJsonCompletionFn,
} from "@/lib/ai/rental-ad-assistant/generate-rental-ad-draft";
import { formatPropertyAddress } from "@/lib/property/display";
import {
  clearRentalAdAssistantDraftOutput,
  getRentalAdAssistantDraftForUnit,
  saveRentalAdAssistantDraftInputs,
  saveRentalAdAssistantDraftOutput,
} from "@/lib/services/rental-ad-assistant-draft.service";
import type { StaffContext } from "@/lib/services/staff-context";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import {
  parseRentalAdAssistantInputs,
  parseRentalAdAssistantOutput,
  type RentalAdAssistantInputs,
  type RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";
import { rentalAdAssistantDraftToDto, type RentalAdAssistantDraftDto } from "./draft-dto";

export type RentalAdAssistantActionResult =
  | { ok: true; draft: RentalAdAssistantDraftDto | null }
  | { ok: false; error: string };

function parseInputsPayload(body: unknown): RentalAdAssistantInputs | { error: string } {
  return parseRentalAdAssistantInputs(body);
}

function parseOutputPayload(body: unknown): RentalAdAssistantOutput | { error: string } {
  return parseRentalAdAssistantOutput(body);
}

async function loadUnitGenerationContext(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      unitNumber: true,
      bedrooms: true,
      propertyId: true,
      property: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          streetLine1: true,
          streetLine2: true,
          city: true,
          province: true,
          postalCode: true,
        },
      },
    },
  });
  if (!unit) throw new NotFoundError("Unit not found");
  if (unit.property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this unit");
  }

  return {
    property: {
      propertyId: unit.property.id,
      addressDisplay: formatPropertyAddress(unit.property),
      city: unit.property.city,
      province: unit.property.province,
      postalCode: unit.property.postalCode,
    },
    unit: {
      unitId: unit.id,
      unitLabel: unit.unitNumber,
      bedrooms: unit.bedrooms,
    },
  };
}

export async function handleLoadRentalAdAssistantDraft(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<RentalAdAssistantActionResult> {
  const trimmedUnitId = unitId.trim();
  if (!trimmedUnitId) return { ok: false, error: "Unit is required." };

  const draft = await getRentalAdAssistantDraftForUnit(prisma, principal, trimmedUnitId);
  return { ok: true, draft: draft ? rentalAdAssistantDraftToDto(draft) : null };
}

export async function handleSaveRentalAdAssistantDraft(
  prisma: PrismaClient,
  principal: StaffContext,
  args: {
    unitId: string;
    inputs: unknown;
    output?: unknown;
  },
): Promise<RentalAdAssistantActionResult> {
  const trimmedUnitId = args.unitId.trim();
  if (!trimmedUnitId) return { ok: false, error: "Unit is required." };

  const parsedInputs = parseInputsPayload(args.inputs);
  if ("error" in parsedInputs) return { ok: false, error: parsedInputs.error };

  let saved = await saveRentalAdAssistantDraftInputs(
    prisma,
    principal,
    trimmedUnitId,
    parsedInputs,
  );

  if (args.output !== undefined && args.output !== null) {
    const parsedOutput = parseOutputPayload(args.output);
    if ("error" in parsedOutput) return { ok: false, error: parsedOutput.error };

    saved = await saveRentalAdAssistantDraftOutput(prisma, principal, trimmedUnitId, {
      output: finalizeRentalAdAssistantOutput(parsedOutput),
    });
  }

  return { ok: true, draft: rentalAdAssistantDraftToDto(saved) };
}

export async function handleGenerateRentalAdAssistantDraft(
  prisma: PrismaClient,
  principal: StaffContext,
  args: {
    unitId: string;
    inputs: unknown;
    createCompletion?: CreateChatJsonCompletionFn;
  },
): Promise<RentalAdAssistantActionResult> {
  const trimmedUnitId = args.unitId.trim();
  if (!trimmedUnitId) return { ok: false, error: "Unit is required." };

  const parsedInputs = parseInputsPayload(args.inputs);
  if ("error" in parsedInputs) return { ok: false, error: parsedInputs.error };

  await saveRentalAdAssistantDraftInputs(prisma, principal, trimmedUnitId, parsedInputs);

  const context = await loadUnitGenerationContext(prisma, principal, trimmedUnitId);

  const generated = await generateRentalAdAssistantDraft(
    prisma,
    {
      organizationId: principal.organizationId,
      property: context.property,
      unit: context.unit,
      inputs: parsedInputs,
    },
    args.createCompletion ? { createCompletion: args.createCompletion } : undefined,
  );

  const saved = await saveRentalAdAssistantDraftOutput(prisma, principal, trimmedUnitId, {
    output: generated.output,
    compsSnapshot: generated.compsSnapshot,
    model: generated.model,
    promptVersion: generated.promptVersion,
    lastGeneratedAt: new Date(),
  });

  return { ok: true, draft: rentalAdAssistantDraftToDto(saved) };
}

export async function handleClearRentalAdAssistantDraftOutput(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<RentalAdAssistantActionResult> {
  const trimmedUnitId = unitId.trim();
  if (!trimmedUnitId) return { ok: false, error: "Unit is required." };

  const saved = await clearRentalAdAssistantDraftOutput(prisma, principal, trimmedUnitId);
  return { ok: true, draft: rentalAdAssistantDraftToDto(saved) };
}
