import {
  MARKET_RENT_CONFIDENCE_VALUES,
  type MarketRentConfidence,
} from "@/lib/validation/market-rent-research";
import { downgradeConfidence, roundToNearest25 } from "./stats";
import type { MarketRentSuggestedRent } from "./types";

export type ParsedOpenAiMarketRentOutput = {
  explanation: string;
  confidence: MarketRentConfidence;
  confidenceReason: string;
  suggestedRent: MarketRentSuggestedRent | null;
  tiersValid: boolean;
};

function parseTierNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundToNearest25(n);
}

function parseSuggestedRent(value: unknown): MarketRentSuggestedRent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const conservative = parseTierNumber(raw.conservative);
  const recommended = parseTierNumber(raw.recommended);
  const aggressive = parseTierNumber(raw.aggressive);
  const currency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
  if (conservative == null || recommended == null || aggressive == null || currency !== "CAD") {
    return null;
  }
  return { conservative, recommended, aggressive, currency: "CAD" };
}

function parseConfidence(value: unknown): MarketRentConfidence | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as MarketRentConfidence;
  return MARKET_RENT_CONFIDENCE_VALUES.includes(normalized) ? normalized : null;
}

export function areRentTiersMonotonic(tiers: MarketRentSuggestedRent): boolean {
  return tiers.conservative <= tiers.recommended && tiers.recommended <= tiers.aggressive;
}

/** Tiers must stay within ±10% of the comp set min/max. */
export function areRentTiersWithinCompGuardrails(
  tiers: MarketRentSuggestedRent,
  compRents: number[],
): boolean {
  if (compRents.length === 0) return false;
  const min = Math.min(...compRents);
  const max = Math.max(...compRents);
  return tiers.conservative >= min * 0.9 && tiers.aggressive <= max * 1.1;
}

export function validateOpenAiRentTiers(
  tiers: MarketRentSuggestedRent,
  compRents: number[],
): boolean {
  return areRentTiersMonotonic(tiers) && areRentTiersWithinCompGuardrails(tiers, compRents);
}

export function parseOpenAiMarketRentOutput(
  raw: unknown,
  context: {
    compRents: number[];
    maxConfidence: MarketRentConfidence;
    deterministicTiers: MarketRentSuggestedRent;
  },
): { ok: true; parsed: ParsedOpenAiMarketRentOutput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "OpenAI output was not a JSON object." };
  }

  const record = raw as Record<string, unknown>;
  const suggestedRent = parseSuggestedRent(record.suggestedRent);
  if (!suggestedRent) {
    return { ok: false, error: "OpenAI output is missing valid suggestedRent tiers." };
  }

  const explanation =
    typeof record.explanation === "string" ? record.explanation.trim() : "";
  if (!explanation) {
    return { ok: false, error: "OpenAI output is missing explanation." };
  }

  const confidence = parseConfidence(record.confidence);
  if (!confidence) {
    return { ok: false, error: "OpenAI output has invalid confidence." };
  }

  const confidenceReason =
    typeof record.confidenceReason === "string" ? record.confidenceReason.trim() : "";
  if (!confidenceReason) {
    return { ok: false, error: "OpenAI output is missing confidenceReason." };
  }

  const tiersValid = validateOpenAiRentTiers(suggestedRent, context.compRents);

  return {
    ok: true,
    parsed: {
      explanation,
      confidence: downgradeConfidence(confidence, context.maxConfidence),
      confidenceReason,
      suggestedRent: tiersValid ? suggestedRent : null,
      tiersValid,
    },
  };
}
