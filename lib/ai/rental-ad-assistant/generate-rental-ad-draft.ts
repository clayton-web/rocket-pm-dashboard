/**
 * Draft-only Rental Ad Assistant generation.
 *
 * Returns advertising guidance and historical comps snapshot for PR 4 to persist.
 * Does not write to Tenancy, Property, Unit, Application, lease/RTB-1, portal, or draft tables.
 */
import type { PrismaClient } from "@prisma/client";
import {
  assertGeminiApiKeyConfigured,
  createChatJsonCompletion,
  getGeminiResponderModel,
} from "@/lib/ai/gemini-client";
import { getInternalRentCompsForRentalAdAssistant } from "@/lib/leasing/internal-rent-comps";
import { buildRentalAdAssistantMessages } from "./build-prompt";
import { parseGeminiRentalAdOutput } from "./parse-output";
import {
  RENTAL_AD_ASSISTANT_PROMPT_VERSION,
  type GenerateRentalAdAssistantDraftInput,
  type GenerateRentalAdAssistantDraftResult,
} from "./types";

export type CreateChatJsonCompletionFn = (args: {
  messages: Array<{ role: "system" | "user"; content: string }>;
}) => Promise<unknown>;

export async function generateRentalAdAssistantDraft(
  prisma: PrismaClient,
  input: GenerateRentalAdAssistantDraftInput,
  options?: {
    createCompletion?: CreateChatJsonCompletionFn;
  },
): Promise<GenerateRentalAdAssistantDraftResult> {
  const usingDefaultCompletion = !options?.createCompletion;
  const createCompletion = options?.createCompletion ?? createChatJsonCompletion;

  const compsSnapshot = await getInternalRentCompsForRentalAdAssistant(prisma, {
    organizationId: input.organizationId,
    city: input.property.city,
    bedrooms: input.inputs.bedrooms,
  });

  const messages = buildRentalAdAssistantMessages({
    property: input.property,
    unit: input.unit,
    inputs: input.inputs,
    compsSnapshot,
  });

  if (usingDefaultCompletion) {
    assertGeminiApiKeyConfigured();
  }

  const raw = await createCompletion({
    messages: [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user },
    ],
  });

  const output = parseGeminiRentalAdOutput(raw, compsSnapshot.count);

  return {
    output,
    compsSnapshot,
    model: getGeminiResponderModel(),
    promptVersion: RENTAL_AD_ASSISTANT_PROMPT_VERSION,
  };
}
