import prisma from "@/lib/db/prisma";
import type { PmContextKind } from "@/lib/ai/email-context-links";

export type ContextLinkOption = {
  kind: PmContextKind;
  id: string;
  label: string;
};

/** Minimal org-scoped lists for the inbox link picker (no cross-org data). */
export async function loadThreadContextLinkOptions(organizationId: string): Promise<{
  properties: ContextLinkOption[];
  tenancies: ContextLinkOption[];
  maintenanceRequests: ContextLinkOption[];
  applications: ContextLinkOption[];
}> {
  const [properties, tenancies, maintenanceRequests, applications] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true },
    }),
    prisma.tenancy.findMany({
      where: { property: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        contacts: { where: { contactType: "tenant" }, take: 1, select: { firstName: true, lastName: true } },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId },
      orderBy: { submittedAt: "desc" },
      take: 30,
      select: { id: true, title: true, status: true },
    }),
    prisma.application.findMany({
      where: { property: { organizationId } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, status: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  return {
    properties: properties.map((p) => ({
      kind: "property" as const,
      id: p.id,
      label: p.name,
    })),
    tenancies: tenancies.map((t) => {
      const contact = t.contacts[0];
      const who = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Tenancy";
      return {
        kind: "tenancy" as const,
        id: t.id,
        label: `${t.property.name} · Unit ${t.unit.unitNumber} · ${who}`,
      };
    }),
    maintenanceRequests: maintenanceRequests.map((r) => ({
      kind: "maintenance_request" as const,
      id: r.id,
      label: `${r.title} (${r.status})`,
    })),
    applications: applications.map((a) => {
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.email;
      return {
        kind: "application" as const,
        id: a.id,
        label: `${name} (${a.status})`,
      };
    }),
  };
}
