export type PostViewingRequestBody = {
  propertyId: string;
  unitId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  message?: string;
};

export function parseCreatedProspectId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
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

  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : undefined;
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : undefined;
  const phone = typeof o.phone === "string" ? o.phone.trim() : undefined;
  const message = typeof o.message === "string" ? o.message : undefined;

  if (firstName && firstName.length > 200) return { error: "firstName is too long" };
  if (lastName && lastName.length > 200) return { error: "lastName is too long" };
  if (phone && phone.length > 50) return { error: "phone is too long" };
  if (message && message.length > 10_000) return { error: "message is too long" };

  return {
    propertyId,
    unitId,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: phone || undefined,
    message: message?.trim() || undefined,
  };
}
