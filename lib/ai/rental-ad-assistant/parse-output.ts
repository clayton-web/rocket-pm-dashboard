import {
  parseRentalAdAssistantOutput,
  type RentalAdConfidence,
  type RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";
import { finalizeRentalAdAssistantOutput } from "./finalize-output";
import type { RentalAdGeneratedDraftRaw } from "./types";

const CONFIDENCE_RANK: Record<RentalAdConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function maxConfidenceForCompCount(compCount: number): RentalAdConfidence {
  if (compCount >= 4) return "high";
  if (compCount >= 1) return "medium";
  return "low";
}

function lowerConfidence(
  current: RentalAdConfidence,
  maxAllowed: RentalAdConfidence,
): RentalAdConfidence {
  return CONFIDENCE_RANK[current] > CONFIDENCE_RANK[maxAllowed] ? maxAllowed : current;
}

export function appendConfidenceNote(reason: string, note: string): string {
  const trimmed = reason.trim();
  if (!trimmed) return note;
  if (trimmed.includes(note)) return trimmed;
  return `${trimmed} ${note}`;
}

export function normalizeRentalAdGeneratedRaw(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Rental ad AI output was not an object.");
  }

  const o = raw as RentalAdGeneratedDraftRaw & Record<string, unknown>;

  if ("monthlyRent" in o || "askingRent" in o) {
    throw new Error(
      'AI output must use suggestedAdvertisingRent, not monthlyRent or askingRent.',
    );
  }

  if (!o.suggestedAdvertisingRent || typeof o.suggestedAdvertisingRent !== "object") {
    throw new Error("AI output is missing suggestedAdvertisingRent.");
  }

  const rent = o.suggestedAdvertisingRent as Record<string, unknown>;
  if (rent.conservative === undefined || rent.recommended === undefined || rent.aggressive === undefined) {
    throw new Error(
      "AI output must include conservative, recommended, and aggressive suggested advertising rent tiers.",
    );
  }

  return {
    suggestedAdvertisingRent: {
      conservative: rent.conservative,
      recommended: rent.recommended,
      aggressive: rent.aggressive,
      currency: rent.currency ?? "CAD",
    },
    confidence: o.confidence,
    confidenceReason: o.confidenceReason,
    explanation: o.explanation,
    headline: o.headline,
    fullDescription: o.fullDescription,
    shortDescription: o.shortDescription,
    valueAddSuggestions: o.valueAddSuggestions ?? [],
    reviewFlags: o.reviewFlags,
  };
}

export function enforceConfidenceByCompCount(
  output: RentalAdAssistantOutput,
  compCount: number,
): RentalAdAssistantOutput {
  const maxAllowed = maxConfidenceForCompCount(compCount);
  const adjusted = lowerConfidence(output.confidence, maxAllowed);

  if (adjusted === output.confidence) {
    return output;
  }

  const downgradeNote =
    compCount === 0
      ? "Confidence capped at low because no historical portfolio lease comps matched."
      : compCount <= 3
        ? "Confidence capped at medium because fewer than four historical portfolio lease comps matched."
        : "";

  return {
    ...output,
    confidence: adjusted,
    confidenceReason: appendConfidenceNote(output.confidenceReason, downgradeNote),
  };
}

export function parseRentalAdGeneratedOutput(
  raw: unknown,
  compCount: number,
): RentalAdAssistantOutput {
  const normalized = normalizeRentalAdGeneratedRaw(raw);
  const parsed = parseRentalAdAssistantOutput(normalized);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  return finalizeRentalAdAssistantOutput(enforceConfidenceByCompCount(parsed, compCount));
}
