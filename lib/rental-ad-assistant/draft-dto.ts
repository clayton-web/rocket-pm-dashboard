import type { RentalAdAssistantDraft } from "@prisma/client";
import {
  parseRentalAdAssistantCompsSnapshot,
  parseRentalAdAssistantInputs,
  parseRentalAdAssistantOutput,
  type RentalAdAssistantCompsSnapshot,
  type RentalAdAssistantInputs,
  type RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";

export const RENTAL_AD_ASSISTANT_DISCLAIMER =
  "Suggested for advertising purposes only. Not a lease rent, appraisal, or guarantee. Official rent is entered when creating a tenancy and signing the lease.";

export const RENTAL_AD_ASSISTANT_PANEL_TITLE = "Rental Ad Assistant";
export const RENTAL_AD_ASSISTANT_DRAFT_HELPER_LABEL = "Draft helper";

export type RentalAdAssistantDraftDto = {
  id: string;
  unitId: string;
  propertyId: string;
  inputs: RentalAdAssistantInputs | null;
  output: RentalAdAssistantOutput | null;
  compsSnapshot: RentalAdAssistantCompsSnapshot | null;
  model: string | null;
  promptVersion: string | null;
  lastGeneratedAt: string | null;
  updatedAt: string;
};

function parseStoredInputs(value: unknown): RentalAdAssistantInputs | null {
  const parsed = parseRentalAdAssistantInputs(value);
  return "error" in parsed ? null : parsed;
}

function parseStoredOutput(value: unknown): RentalAdAssistantOutput | null {
  if (value == null) return null;
  const parsed = parseRentalAdAssistantOutput(value);
  return "error" in parsed ? null : parsed;
}

function parseStoredComps(value: unknown): RentalAdAssistantCompsSnapshot | null {
  if (value == null) return null;
  const parsed = parseRentalAdAssistantCompsSnapshot(value);
  return "error" in parsed ? null : parsed;
}

export function rentalAdAssistantDraftToDto(
  draft: RentalAdAssistantDraft,
): RentalAdAssistantDraftDto {
  return serializeRentalAdAssistantDraftDto({
    id: draft.id,
    unitId: draft.unitId,
    propertyId: draft.propertyId,
    inputs: parseStoredInputs(draft.inputsJson),
    output: parseStoredOutput(draft.outputJson),
    compsSnapshot: parseStoredComps(draft.compsSnapshotJson),
    model: draft.model,
    promptVersion: draft.promptVersion,
    lastGeneratedAt: draft.lastGeneratedAt?.toISOString() ?? null,
    updatedAt: draft.updatedAt.toISOString(),
  })!;
}

/** Ensures server-action responses contain only JSON-serializable plain data. */
export function serializeRentalAdAssistantDraftDto(
  draft: RentalAdAssistantDraftDto | null,
): RentalAdAssistantDraftDto | null {
  if (!draft) return null;
  return JSON.parse(JSON.stringify(draft)) as RentalAdAssistantDraftDto;
}

export function isOpenAiConfiguredForRentalAdAssistant(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
