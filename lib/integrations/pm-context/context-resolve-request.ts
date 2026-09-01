import type { ContextResolveRequest } from "@/lib/integrations/pm-context/context-resolve-contract";
import { normalizeIntegrationEmail } from "@/lib/integrations/pm-context/normalize-address-hint";

/** Signals accepted by the schema but not acted on in v1. Echoed back in the response. */
export const UNSUPPORTED_SIGNAL_KEYS = ["senderPhone"] as const;

export const MAX_HINTS_PER_FIELD = 5;
export const MAX_HINT_LENGTH = 200;
export const MAX_ID_LENGTH = 64;

export type ParsedContextResolveRequest = {
  request: ContextResolveRequest;
  /** Keys the caller sent that this version ignores, so they are visibly reported back. */
  unsupportedSignals: string[];
};

function parseHintList(value: unknown, field: string): string[] | { error: string } {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return { error: `${field} must be an array of strings` };
  if (value.length > MAX_HINTS_PER_FIELD) {
    return { error: `${field} accepts at most ${MAX_HINTS_PER_FIELD} values` };
  }

  const hints: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return { error: `${field} must be an array of strings` };
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_HINT_LENGTH) {
      return { error: `${field} values must be ${MAX_HINT_LENGTH} characters or fewer` };
    }
    hints.push(trimmed);
  }
  return hints;
}

function parseOptionalId(value: unknown, field: string): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `${field} must be a string` };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_ID_LENGTH) return { error: `${field} is not a valid id` };
  return trimmed;
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

/**
 * Validates the resolver request body.
 *
 * An `organizationId` in the body is rejected outright rather than ignored: the client must never
 * believe it can select an organization, and a silent ignore would hide an integration bug.
 */
export function parseContextResolveRequest(
  body: unknown,
): ParsedContextResolveRequest | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;

  if (raw.organizationId !== undefined) {
    return {
      error: "organizationId is not accepted; organization is derived from the credential",
    };
  }

  let senderEmail: string | null = null;
  if (raw.senderEmail !== undefined && raw.senderEmail !== null && raw.senderEmail !== "") {
    if (typeof raw.senderEmail !== "string") {
      return { error: "senderEmail must be a string" };
    }
    if (raw.senderEmail.length > MAX_HINT_LENGTH) {
      return { error: "senderEmail is too long" };
    }
    senderEmail = normalizeIntegrationEmail(raw.senderEmail);
    if (!senderEmail) return { error: "senderEmail is not a valid email address" };
  }

  const addressHints = parseHintList(raw.addressHints, "addressHints");
  if (isError(addressHints)) return addressHints;

  const unitHints = parseHintList(raw.unitHints, "unitHints");
  if (isError(unitHints)) return unitHints;

  const knownPropertyId = parseOptionalId(raw.knownPropertyId, "knownPropertyId");
  if (isError(knownPropertyId)) return knownPropertyId;

  const knownUnitId = parseOptionalId(raw.knownUnitId, "knownUnitId");
  if (isError(knownUnitId)) return knownUnitId;

  const hasSignal =
    senderEmail !== null ||
    addressHints.length > 0 ||
    unitHints.length > 0 ||
    knownPropertyId !== null ||
    knownUnitId !== null;
  if (!hasSignal) {
    return { error: "At least one lookup signal is required" };
  }

  const unsupportedSignals = UNSUPPORTED_SIGNAL_KEYS.filter(
    (key) => raw[key] !== undefined && raw[key] !== null && raw[key] !== "",
  );

  return {
    request: { senderEmail, addressHints, unitHints, knownPropertyId, knownUnitId },
    unsupportedSignals: [...unsupportedSignals],
  };
}
