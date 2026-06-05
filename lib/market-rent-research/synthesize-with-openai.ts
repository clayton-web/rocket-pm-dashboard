import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { buildMarketRentOpenAiMessages } from "./build-openai-prompt";
import {
  createMarketRentChatJsonCompletion,
  type CreateMarketRentChatJsonCompletion,
} from "./openai-client";
import { parseOpenAiMarketRentOutput } from "./parse-openai-output";
import { getMaxAllowedConfidence } from "./stats";
import type { MarketRentResearchResult } from "./types";

export const MARKET_RENT_OPENAI_FALLBACK_NOTE =
  "OpenAI synthesis unavailable; showing deterministic summary.";

export const MARKET_RENT_OPENAI_TIERS_FALLBACK_NOTE =
  "Suggested advertising rent tiers use deterministic calculations; OpenAI tier adjustments were outside guardrails.";

export type SynthesizeMarketRentOptions = {
  createCompletion?: CreateMarketRentChatJsonCompletion;
  inputs: MarketRentResearchInputs;
  compCount: number;
  missingFieldRatio: number;
  compRents: number[];
};

export async function synthesizeMarketRentWithOpenAi(
  baseline: MarketRentResearchResult,
  options: SynthesizeMarketRentOptions,
): Promise<MarketRentResearchResult> {
  const createCompletion = options.createCompletion ?? createMarketRentChatJsonCompletion;
  const maxConfidence = getMaxAllowedConfidence(options.compCount, options.missingFieldRatio);

  try {
    const messages = buildMarketRentOpenAiMessages({
      inputs: options.inputs,
      statistics: baseline.statistics,
      deterministicTiers: baseline.suggestedRent,
      comparableListingsUsed: baseline.comparableListingsUsed,
      sourceBreakdown: baseline.sourceBreakdown,
      dataQualityNotes: baseline.dataQualityNotes,
      deterministicConfidence: baseline.confidence,
      deterministicConfidenceReason: baseline.confidenceReason,
    });

    const raw = await createCompletion({ messages });
    const parsedResult = parseOpenAiMarketRentOutput(raw, {
      compRents: options.compRents,
      maxConfidence,
      deterministicTiers: baseline.suggestedRent,
    });

    if (!parsedResult.ok) {
      return {
        ...baseline,
        explanationSource: "deterministic",
        dataQualityNotes: [...baseline.dataQualityNotes, parsedResult.error],
      };
    }

    const { parsed } = parsedResult;
    const dataQualityNotes = [...baseline.dataQualityNotes];
    if (!parsed.tiersValid) {
      dataQualityNotes.push(MARKET_RENT_OPENAI_TIERS_FALLBACK_NOTE);
    }

    return {
      ...baseline,
      suggestedRent: parsed.suggestedRent ?? baseline.suggestedRent,
      confidence: parsed.confidence,
      confidenceReason: parsed.confidenceReason,
      explanation: parsed.explanation,
      explanationSource: "openai",
      dataQualityNotes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI synthesis failed.";
    return {
      ...baseline,
      explanationSource: "deterministic",
      dataQualityNotes: [...baseline.dataQualityNotes, MARKET_RENT_OPENAI_FALLBACK_NOTE, message],
    };
  }
}
