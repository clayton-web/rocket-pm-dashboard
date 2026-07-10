import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import {
  HOUSEHOLD_INCOME_RANGES,
  isValidHouseholdIncomeRange,
  isValidSmokerStatus,
  SMOKER_STATUSES,
} from "@/lib/leasing/prospect-intake";

export type PostViewingRequestBody = {
  propertyId: string;
  unitId?: string;
  rentalListingId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  occupantCount: number;
  hasPets: boolean;
  petDetails?: string;
  smokerStatus: string;
  householdIncomeRange: string;
  desiredMoveInDate: string;
  preferredViewingNotes?: string;
  message?: string;
};

export function parseCreatedProspectId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

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

function parseRequiredString(
  value: unknown,
  field: string,
  maxLen: number,
): string | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required` };
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

function parseOccupantCount(value: unknown): number | { error: string } {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value < 1 || value > 50) return { error: "occupantCount must be between 1 and 50" };
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (n < 1 || n > 50) return { error: "occupantCount must be between 1 and 50" };
    return n;
  }
  return { error: "occupantCount is required" };
}

function parseHasPets(value: unknown): boolean | { error: string } {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "yes") return true;
  if (value === "false" || value === "no") return false;
  return { error: "hasPets is required" };
}

function parseDesiredMoveInDate(value: unknown): string | { error: string } {
  if (typeof value !== "string") return { error: "desiredMoveInDate is required" };
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: "desiredMoveInDate must be YYYY-MM-DD" };
  }
  const d = toDateOnlyUTC(trimmed);
  if (Number.isNaN(d.getTime())) return { error: "Invalid desiredMoveInDate" };
  return trimmed;
}

export function parsePostViewingRequestBody(
  body: unknown,
): PostViewingRequestBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;

  const propertyId = typeof o.propertyId === "string" ? o.propertyId.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";

  if (!propertyId) return { error: "propertyId is required" };
  if (!email) return { error: "email is required" };
  if (email.length > 320) return { error: "email is too long" };

  let unitId: string | undefined;
  if (o.unitId !== undefined && o.unitId !== null && o.unitId !== "") {
    if (typeof o.unitId !== "string") return { error: "Invalid unitId" };
    unitId = o.unitId.trim();
    if (!unitId) return { error: "Invalid unitId" };
  }

  let rentalListingId: string | undefined;
  if (o.rentalListingId !== undefined && o.rentalListingId !== null && o.rentalListingId !== "") {
    if (typeof o.rentalListingId !== "string") return { error: "Invalid rentalListingId" };
    rentalListingId = o.rentalListingId.trim();
    if (!rentalListingId) return { error: "Invalid rentalListingId" };
  }

  const firstName = parseRequiredString(o.firstName, "firstName", 200);
  if (typeof firstName === "object" && "error" in firstName) return firstName;

  const lastName = parseRequiredString(o.lastName, "lastName", 200);
  if (typeof lastName === "object" && "error" in lastName) return lastName;

  const phone = parseOptionalString(o.phone, "phone", 50);
  if (phone && typeof phone === "object" && "error" in phone) return phone;

  const occupantCount = parseOccupantCount(o.occupantCount);
  if (typeof occupantCount === "object" && "error" in occupantCount) return occupantCount;

  const hasPets = parseHasPets(o.hasPets);
  if (typeof hasPets === "object" && "error" in hasPets) return hasPets;

  const petDetails = parseOptionalString(o.petDetails, "petDetails", 2000);
  if (petDetails && typeof petDetails === "object" && "error" in petDetails) return petDetails;
  if (hasPets && !petDetails) {
    return { error: "petDetails is required when you have pets" };
  }

  const smokerStatusRaw = parseRequiredString(o.smokerStatus, "smokerStatus", 50);
  if (typeof smokerStatusRaw === "object" && "error" in smokerStatusRaw) return smokerStatusRaw;
  if (!isValidSmokerStatus(smokerStatusRaw)) {
    return { error: `smokerStatus must be one of: ${SMOKER_STATUSES.join(", ")}` };
  }

  const incomeRaw = parseRequiredString(o.householdIncomeRange, "householdIncomeRange", 50);
  if (typeof incomeRaw === "object" && "error" in incomeRaw) return incomeRaw;
  if (!isValidHouseholdIncomeRange(incomeRaw)) {
    return { error: `householdIncomeRange must be one of: ${HOUSEHOLD_INCOME_RANGES.join(", ")}` };
  }

  const desiredMoveInDate = parseDesiredMoveInDate(o.desiredMoveInDate);
  if (typeof desiredMoveInDate === "object" && "error" in desiredMoveInDate) {
    return desiredMoveInDate;
  }

  const preferredViewingNotes = parseOptionalString(o.preferredViewingNotes, "preferredViewingNotes", 2000);
  if (
    preferredViewingNotes &&
    typeof preferredViewingNotes === "object" &&
    "error" in preferredViewingNotes
  ) {
    return preferredViewingNotes;
  }

  const message = parseOptionalString(o.message, "message", 10_000);
  if (message && typeof message === "object" && "error" in message) return message;

  return {
    propertyId,
    unitId,
    rentalListingId,
    email,
    firstName,
    lastName,
    phone,
    occupantCount,
    hasPets,
    petDetails,
    smokerStatus: smokerStatusRaw,
    householdIncomeRange: incomeRaw,
    desiredMoveInDate,
    preferredViewingNotes,
    message,
  };
}
