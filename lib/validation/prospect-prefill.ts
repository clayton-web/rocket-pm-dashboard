export type ProspectPrefillQuery = {
  email: string;
  propertyId: string;
  unitId: string;
};

export function parseProspectPrefillQuery(
  searchParams: URLSearchParams,
): ProspectPrefillQuery | { error: string } {
  const propertyId = searchParams.get("propertyId")?.trim() ?? "";
  const unitId = searchParams.get("unitId")?.trim() ?? "";
  const email = searchParams.get("email")?.trim() ?? "";

  if (!propertyId) return { error: "propertyId is required" };
  if (!unitId) return { error: "unitId is required" };
  if (!email) return { error: "email is required" };
  if (email.length > 320) return { error: "email is too long" };

  return { propertyId, unitId, email };
}
