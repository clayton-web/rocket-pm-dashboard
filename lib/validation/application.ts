import { Prisma } from "@prisma/client";
import type { UpdateDraftApplicationInput } from "@/lib/services/application.service";

export type PostStartApplicationBody = {
  propertyId: string;
  unitId: string;
  email: string;
  prospectId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type PatchApplicationDraftBody = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  currentAddress?: string;
  desiredMoveInDate?: string;
  occupantCount?: number;
  monthlyIncome?: number;
  hasPets?: boolean;
  petDetails?: string;
  smokerStatus?: string;
  employerName?: string;
  jobTitle?: string;
  employmentNotes?: string;
};

export type PostSubmitApplicationBody = {
  email: string;
  consentCreditCheck: boolean;
  consentSignatureName: string;
};

function parseEmail(o: Record<string, unknown>): string | { error: string } {
  const email = typeof o.email === "string" ? o.email.trim() : "";
  if (!email) return { error: "email is required" };
  if (email.length > 320) return { error: "email is too long" };
  return email;
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

function parseDateString(value: unknown): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return { error: "Invalid desiredMoveInDate" };
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: "desiredMoveInDate must be YYYY-MM-DD" };
  }
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { error: "Invalid desiredMoveInDate" };
  return trimmed;
}

export function parseCreatedApplicationId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

export function parsePostStartApplicationBody(
  body: unknown,
): PostStartApplicationBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;

  const propertyId = typeof o.propertyId === "string" ? o.propertyId.trim() : "";
  const unitId = typeof o.unitId === "string" ? o.unitId.trim() : "";
  if (!propertyId) return { error: "propertyId is required" };
  if (!unitId) return { error: "unitId is required" };

  const emailResult = parseEmail(o);
  if (typeof emailResult === "object") return emailResult;

  const firstName = parseOptionalString(o.firstName, "firstName", 200);
  if (typeof firstName === "object") return firstName;
  const lastName = parseOptionalString(o.lastName, "lastName", 200);
  if (typeof lastName === "object") return lastName;
  const phone = parseOptionalString(o.phone, "phone", 50);
  if (typeof phone === "object") return phone;

  const prospectId = parseOptionalString(o.prospectId, "prospectId", 64);
  if (typeof prospectId === "object") return prospectId;

  return {
    propertyId,
    unitId,
    email: emailResult,
    prospectId,
    firstName,
    lastName,
    phone,
  };
}

export function parsePatchApplicationDraftBody(
  body: unknown,
): PatchApplicationDraftBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;

  const emailResult = parseEmail(o);
  if (typeof emailResult === "object") return emailResult;

  const firstName = parseOptionalString(o.firstName, "firstName", 200);
  if (typeof firstName === "object") return firstName;
  const lastName = parseOptionalString(o.lastName, "lastName", 200);
  if (typeof lastName === "object") return lastName;
  const phone = parseOptionalString(o.phone, "phone", 50);
  if (typeof phone === "object") return phone;
  const currentAddress = parseOptionalString(o.currentAddress, "currentAddress", 2000);
  if (typeof currentAddress === "object") return currentAddress;
  const desiredMoveInDate = parseDateString(o.desiredMoveInDate);
  if (typeof desiredMoveInDate === "object") return desiredMoveInDate;
  const petDetails = parseOptionalString(o.petDetails, "petDetails", 2000);
  if (typeof petDetails === "object") return petDetails;
  const smokerStatus = parseOptionalString(o.smokerStatus, "smokerStatus", 100);
  if (typeof smokerStatus === "object") return smokerStatus;
  const employerName = parseOptionalString(o.employerName, "employerName", 200);
  if (typeof employerName === "object") return employerName;
  const jobTitle = parseOptionalString(o.jobTitle, "jobTitle", 200);
  if (typeof jobTitle === "object") return jobTitle;
  const employmentNotes = parseOptionalString(o.employmentNotes, "employmentNotes", 5000);
  if (typeof employmentNotes === "object") return employmentNotes;

  let occupantCount: number | undefined;
  if (o.occupantCount !== undefined && o.occupantCount !== null && o.occupantCount !== "") {
    const n = typeof o.occupantCount === "number" ? o.occupantCount : Number(o.occupantCount);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return { error: "occupantCount must be a positive integer" };
    }
    occupantCount = n;
  }

  let monthlyIncome: number | undefined;
  if (o.monthlyIncome !== undefined && o.monthlyIncome !== null && o.monthlyIncome !== "") {
    const n = typeof o.monthlyIncome === "number" ? o.monthlyIncome : Number(o.monthlyIncome);
    if (!Number.isFinite(n) || n < 0) {
      return { error: "monthlyIncome must be a non-negative number" };
    }
    monthlyIncome = n;
  }

  let hasPets: boolean | undefined;
  if (o.hasPets !== undefined && o.hasPets !== null) {
    if (typeof o.hasPets !== "boolean") return { error: "Invalid hasPets" };
    hasPets = o.hasPets;
  }

  return {
    email: emailResult,
    firstName,
    lastName,
    phone,
    currentAddress,
    desiredMoveInDate,
    occupantCount,
    monthlyIncome,
    hasPets,
    petDetails,
    smokerStatus,
    employerName,
    jobTitle,
    employmentNotes,
  };
}

export function parsePostSubmitApplicationBody(
  body: unknown,
): PostSubmitApplicationBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid JSON body" };
  }
  const o = body as Record<string, unknown>;

  const emailResult = parseEmail(o);
  if (typeof emailResult === "object") return emailResult;

  if (o.consentCreditCheck !== true) {
    return { error: "consentCreditCheck must be true" };
  }

  const consentSignatureName =
    typeof o.consentSignatureName === "string" ? o.consentSignatureName.trim() : "";
  if (!consentSignatureName) return { error: "consentSignatureName is required" };
  if (consentSignatureName.length > 200) return { error: "consentSignatureName is too long" };

  return {
    email: emailResult,
    consentCreditCheck: true,
    consentSignatureName,
  };
}

/** Map validated patch body to service update input. */
export function patchBodyToServiceInput(parsed: PatchApplicationDraftBody): UpdateDraftApplicationInput {
  const data: UpdateDraftApplicationInput = {};
  if (parsed.firstName !== undefined) data.firstName = parsed.firstName ?? null;
  if (parsed.lastName !== undefined) data.lastName = parsed.lastName ?? null;
  if (parsed.phone !== undefined) data.phone = parsed.phone ?? null;
  if (parsed.currentAddress !== undefined) data.currentAddress = parsed.currentAddress ?? null;
  if (parsed.desiredMoveInDate !== undefined) {
    data.desiredMoveInDate = parsed.desiredMoveInDate
      ? new Date(`${parsed.desiredMoveInDate}T12:00:00.000Z`)
      : null;
  }
  if (parsed.occupantCount !== undefined) data.occupantCount = parsed.occupantCount ?? null;
  if (parsed.monthlyIncome !== undefined) {
    data.monthlyIncome =
      parsed.monthlyIncome == null ? null : new Prisma.Decimal(parsed.monthlyIncome);
  }
  if (parsed.hasPets !== undefined) data.hasPets = parsed.hasPets;
  if (parsed.petDetails !== undefined) data.petDetails = parsed.petDetails ?? null;
  if (parsed.smokerStatus !== undefined) data.smokerStatus = parsed.smokerStatus ?? null;
  if (parsed.employerName !== undefined) data.employerName = parsed.employerName ?? null;
  if (parsed.jobTitle !== undefined) data.jobTitle = parsed.jobTitle ?? null;
  if (parsed.employmentNotes !== undefined) data.employmentNotes = parsed.employmentNotes ?? null;
  return data;
}
