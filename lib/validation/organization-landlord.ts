import type { OrganizationLandlordProfile } from "@/lib/leasing/lease-setup";

export type OrganizationLandlordFormInput = {
  landlordLegalName: string;
  landlordServiceStreetLine1: string;
  landlordServiceStreetLine2: string | null;
  landlordServiceCity: string;
  landlordServiceProvince: string;
  landlordServicePostalCode: string;
  landlordServicePhone: string;
  landlordServiceEmail: string | null;
  landlordIsAgent: boolean;
};

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

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

export function parseOrganizationLandlordFormInput(
  body: unknown,
): OrganizationLandlordFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const landlordLegalName = parseRequiredString(raw.landlordLegalName, "Landlord legal name", 300);
  if (typeof landlordLegalName === "object") return landlordLegalName;

  const landlordServiceStreetLine1 = parseRequiredString(
    raw.landlordServiceStreetLine1,
    "Service street address",
    300,
  );
  if (typeof landlordServiceStreetLine1 === "object") return landlordServiceStreetLine1;

  const landlordServiceStreetLine2 = parseOptionalString(
    raw.landlordServiceStreetLine2,
    "Service street line 2",
    300,
  );
  if (typeof landlordServiceStreetLine2 === "object" && landlordServiceStreetLine2 !== null && "error" in landlordServiceStreetLine2) {
    return landlordServiceStreetLine2;
  }

  const landlordServiceCity = parseRequiredString(raw.landlordServiceCity, "Service city", 120);
  if (typeof landlordServiceCity === "object") return landlordServiceCity;

  const landlordServiceProvince = parseRequiredString(
    raw.landlordServiceProvince,
    "Service province",
    40,
  );
  if (typeof landlordServiceProvince === "object") return landlordServiceProvince;

  const landlordServicePostalCode = parseRequiredString(
    raw.landlordServicePostalCode,
    "Service postal code",
    20,
  );
  if (typeof landlordServicePostalCode === "object") return landlordServicePostalCode;

  const landlordServicePhone = parseRequiredString(raw.landlordServicePhone, "Service phone", 50);
  if (typeof landlordServicePhone === "object") return landlordServicePhone;

  const landlordServiceEmail = parseOptionalString(
    raw.landlordServiceEmail,
    "Service email",
    320,
  );
  if (typeof landlordServiceEmail === "object" && landlordServiceEmail !== null && "error" in landlordServiceEmail) {
    return landlordServiceEmail;
  }

  const landlordIsAgent = raw.landlordIsAgent === true || raw.landlordIsAgent === "true";

  return {
    landlordLegalName,
    landlordServiceStreetLine1,
    landlordServiceStreetLine2,
    landlordServiceCity,
    landlordServiceProvince,
    landlordServicePostalCode,
    landlordServicePhone,
    landlordServiceEmail,
    landlordIsAgent,
  };
}

export function organizationLandlordProfileFromOrg(
  org: OrganizationLandlordProfile & { name: string },
): OrganizationLandlordProfile {
  return {
    landlordLegalName: org.landlordLegalName,
    landlordServiceStreetLine1: org.landlordServiceStreetLine1,
    landlordServiceStreetLine2: org.landlordServiceStreetLine2,
    landlordServiceCity: org.landlordServiceCity,
    landlordServiceProvince: org.landlordServiceProvince,
    landlordServicePostalCode: org.landlordServicePostalCode,
    landlordServicePhone: org.landlordServicePhone,
    landlordServiceEmail: org.landlordServiceEmail,
    landlordIsAgent: org.landlordIsAgent,
  };
}

export function organizationLandlordFormDefaults(
  org: OrganizationLandlordProfile,
): OrganizationLandlordFormInput {
  return {
    landlordLegalName: org.landlordLegalName ?? "",
    landlordServiceStreetLine1: org.landlordServiceStreetLine1 ?? "",
    landlordServiceStreetLine2: org.landlordServiceStreetLine2 ?? null,
    landlordServiceCity: org.landlordServiceCity ?? "",
    landlordServiceProvince: org.landlordServiceProvince ?? "BC",
    landlordServicePostalCode: org.landlordServicePostalCode ?? "",
    landlordServicePhone: org.landlordServicePhone ?? "",
    landlordServiceEmail: org.landlordServiceEmail ?? null,
    landlordIsAgent: org.landlordIsAgent,
  };
}
