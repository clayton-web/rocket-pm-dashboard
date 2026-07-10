export type CompletePlacementFormInput = {
  leaseStartDate: string;
  leaseEndDate?: string;
  monthlyRent: number;
  landlordHandoffNotes?: string;
  internalNotes?: string;
  rentalListingId?: string;
};

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed || undefined;
}

function parseDateField(value: unknown, field: string): string | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: `${field} must be YYYY-MM-DD` };
  }
  return trimmed;
}

function parsePositiveMoney(value: unknown, field: string): number | { error: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!(value > 0)) return { error: `${field} must be greater than zero` };
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (!Number.isFinite(n) || !(n > 0)) {
      return { error: `${field} must be greater than zero` };
    }
    return n;
  }
  return { error: `${field} is required` };
}

export function parseCompletePlacementFormInput(
  formData: unknown,
): CompletePlacementFormInput | { error: string } {
  if (typeof formData !== "object" || formData === null) {
    return { error: "Invalid form data" };
  }
  const o = formData as Record<string, unknown>;

  const leaseStartDate = parseDateField(o.leaseStartDate, "Lease start date");
  if (typeof leaseStartDate === "object") return leaseStartDate;

  let leaseEndDate: string | undefined;
  if (o.leaseEndDate !== undefined && o.leaseEndDate !== null && o.leaseEndDate !== "") {
    const end = parseDateField(o.leaseEndDate, "Lease end date");
    if (typeof end === "object") return end;
    leaseEndDate = end;
  }

  const monthlyRent = parsePositiveMoney(o.monthlyRent, "Monthly rent");
  if (typeof monthlyRent === "object") return monthlyRent;

  const landlordHandoffNotes = parseOptionalString(
    o.landlordHandoffNotes,
    "Landlord handoff notes",
    5000,
  );
  if (landlordHandoffNotes && typeof landlordHandoffNotes === "object") {
    return landlordHandoffNotes;
  }

  const internalNotes = parseOptionalString(o.internalNotes, "Internal notes", 5000);
  if (internalNotes && typeof internalNotes === "object") return internalNotes;

  const rentalListingId = parseOptionalString(o.rentalListingId, "Rental listing", 64);
  if (rentalListingId && typeof rentalListingId === "object") return rentalListingId;

  return {
    leaseStartDate,
    leaseEndDate,
    monthlyRent,
    landlordHandoffNotes,
    internalNotes,
    rentalListingId,
  };
}
