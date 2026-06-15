import type { Prisma, PrismaClient, TenancyContact, TenancyContactType } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";

export type CreateTenancyContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  contactType: TenancyContactType;
  portalAccessEnabled?: boolean;
};

export type UpdateTenancyContactInput = Partial<
  Pick<
    TenancyContact,
    "firstName" | "lastName" | "email" | "phone" | "contactType" | "portalAccessEnabled"
  >
>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getTenancyForContactAuth(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string
) {
  requireStaff(principal);
  const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId } });
  if (!tenancy) throw new NotFoundError("Tenancy not found");
  await requirePropertyManagerAccess(prisma, principal, tenancy.propertyId);
  return tenancy;
}

async function getContactOrThrow(prisma: PrismaClient, id: string): Promise<TenancyContact> {
  const row = await prisma.tenancyContact.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Tenancy contact not found");
  return row;
}

/** Property managers and org admins/owners in the active org (field agents blocked via `requirePropertyManagerAccess`). */
export async function createTenancyContact(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string,
  input: CreateTenancyContactInput
): Promise<TenancyContact> {
  await getTenancyForContactAuth(prisma, principal, tenancyId);

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  if (!firstName) throw new Error("firstName is required");
  if (!lastName) throw new Error("lastName is required");
  if (!email) throw new Error("email is required");

  return prisma.tenancyContact.create({
    data: {
      tenancyId,
      firstName,
      lastName,
      email,
      phone: input.phone?.trim() || null,
      contactType: input.contactType,
      portalAccessEnabled: input.portalAccessEnabled ?? false,
    },
  });
}

export async function updateTenancyContact(
  prisma: PrismaClient,
  principal: StaffContext,
  contactId: string,
  input: UpdateTenancyContactInput
): Promise<TenancyContact> {
  const existing = await getContactOrThrow(prisma, contactId);
  await getTenancyForContactAuth(prisma, principal, existing.tenancyId);

  const data: Prisma.TenancyContactUpdateInput = {};
  if (input.firstName !== undefined) {
    const v = input.firstName.trim();
    if (!v) throw new Error("firstName cannot be empty");
    data.firstName = v;
  }
  if (input.lastName !== undefined) {
    const v = input.lastName.trim();
    if (!v) throw new Error("lastName cannot be empty");
    data.lastName = v;
  }
  if (input.email !== undefined) {
    data.email = normalizeEmail(input.email);
  }
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.contactType !== undefined) data.contactType = input.contactType;
  if (input.portalAccessEnabled !== undefined) data.portalAccessEnabled = input.portalAccessEnabled;

  if (Object.keys(data).length === 0) return existing;
  return prisma.tenancyContact.update({ where: { id: contactId }, data });
}

export async function listTenancyContacts(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string
): Promise<TenancyContact[]> {
  await getTenancyForContactAuth(prisma, principal, tenancyId);
  return prisma.tenancyContact.findMany({
    where: { tenancyId },
    orderBy: [{ contactType: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}
