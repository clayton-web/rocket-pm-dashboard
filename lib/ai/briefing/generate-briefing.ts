import { createChatJsonCompletion } from "@/lib/ai/gemini-client";
import {
  BriefingOutputValidationError,
  parseBriefingGeminiOutput,
  type NormalizedBriefingOutput,
} from "@/lib/ai/briefing/briefing-output.schema";
import { buildBriefingPromptMessages } from "@/lib/ai/briefing/briefing-prompt";
import type { BriefingContext } from "@/lib/briefing/briefing-types";

export type GenerateBriefingResult = {
  output: NormalizedBriefingOutput;
  geminiCallCount: number;
};

export type CreateChatJsonCompletion = (args: {
  messages: Array<{ role: "system" | "user"; content: string }>;
}) => Promise<unknown>;

export class BriefingGenerationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BriefingGenerationError";
  }
}

/**
 * Generates a validated Daily Briefing from a prepared context object.
 * Makes one Gemini call per invocation (batching is handled upstream via context caps).
 * Does not persist to the database — PR 3 job handler will call persist helpers.
 */
export async function generateBriefingFromContext(args: {
  context: BriefingContext;
  createCompletion?: CreateChatJsonCompletion;
}): Promise<GenerateBriefingResult> {
  const createCompletion = args.createCompletion ?? createChatJsonCompletion;
  const { system, user } = buildBriefingPromptMessages(args.context);

  let raw: unknown;
  try {
    raw = await createCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } catch (error) {
    throw new BriefingGenerationError(
      error instanceof Error ? error.message : "Gemini briefing generation failed.",
      error,
    );
  }

  try {
    const output = parseBriefingGeminiOutput(raw);
    return { output, geminiCallCount: 1 };
  } catch (error) {
    if (error instanceof BriefingOutputValidationError) {
      throw error;
    }
    throw new BriefingGenerationError(
      error instanceof Error ? error.message : "Failed to parse briefing output.",
      error,
    );
  }
}
