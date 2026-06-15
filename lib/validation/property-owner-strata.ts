export type PropertyOwnerStrataFormInput = {
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
};

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseOptionalEmail(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid owner email" };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 320) return { error: "Owner email is too long" };
  if (!BASIC_EMAIL_RE.test(trimmed)) return { error: "Owner email format is invalid" };
  return trimmed;
}

function parseOptionalPhone(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid owner phone" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 50) return { error: "Owner phone is too long" };
  return trimmed;
}

function parseOptionalNotes(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid strata notes" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 20_000) return { error: "Strata notes are too long" };
  return trimmed;
}

export function parsePropertyOwnerStrataFormInput(
  body: unknown,
): PropertyOwnerStrataFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const ownerEmail = parseOptionalEmail(raw.ownerEmail);
  if (ownerEmail !== null && typeof ownerEmail === "object") return ownerEmail;

  const ownerPhone = parseOptionalPhone(raw.ownerPhone);
  if (ownerPhone !== null && typeof ownerPhone === "object") return ownerPhone;

  const strataNotes = parseOptionalNotes(raw.strataNotes);
  if (strataNotes !== null && typeof strataNotes === "object") return strataNotes;

  return { ownerEmail, ownerPhone, strataNotes };
}
