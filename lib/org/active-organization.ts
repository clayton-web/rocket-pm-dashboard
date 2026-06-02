import type { OrganizationMembershipRole } from "@prisma/client";
import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

const ACTIVE_ORG_COOKIE = "rocket_pm_active_org";

export type ActiveOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationMembershipRole;
};

export async function getMembershipsForUser(userId: string) {
  return prisma.organizationMembership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });
}

export async function setActiveOrganizationId(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id, organizationId },
    include: { organization: true },
  });

  if (!membership) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.platformAccessLevel !== "OPERATOR") {
      throw new Error("Forbidden");
    }
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new Error("Organization not found");
    }
  }

  const jar = await cookies();
  jar.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getActiveOrganizationContext(): Promise<ActiveOrganization | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const jar = await cookies();
  const activeOrgId = jar.get(ACTIVE_ORG_COOKIE)?.value ?? null;

  if (activeOrgId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: session.user.id, organizationId: activeOrgId },
      include: { organization: true },
    });
    if (membership) {
      return {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.platformAccessLevel === "OPERATOR") {
      const org = await prisma.organization.findUnique({ where: { id: activeOrgId } });
      if (org) {
        return { id: org.id, name: org.name, slug: org.slug, role: "ADMIN" };
      }
    }
  }

  const memberships = await getMembershipsForUser(session.user.id);
  if (memberships.length === 1) {
    const only = memberships[0]!;
    return {
      id: only.organization.id,
      name: only.organization.name,
      slug: only.organization.slug,
      role: only.role,
    };
  }

  return null;
}

export async function requireActiveOrganization(): Promise<ActiveOrganization> {
  const ctx = await getActiveOrganizationContext();
  if (!ctx) {
    throw new Error("Active organization required");
  }
  return ctx;
}
