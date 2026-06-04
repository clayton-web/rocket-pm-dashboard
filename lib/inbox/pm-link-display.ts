import prisma from "@/lib/db/prisma";
import type { PmContextKind, PmContextLink } from "@/lib/ai/email-context-links";

export type PmLinkDisplay = {
  kind: PmContextKind;
  id: string;
  label: string;
  chipLabel: string;
  href: string | null;
};

function displayKey(kind: PmContextKind, id: string): string {
  return `${kind}:${id}`;
}

export function pmLinkHref(kind: PmContextKind, id: string, extra?: { tenancyId?: string }): string | null {
  switch (kind) {
    case "tenancy":
      return `/leasing/tenancies/${id}`;
    case "maintenance_request":
      return `/maintenance/${id}`;
    case "application":
      return `/leasing/applications/${id}`;
    case "notice":
      return `/leasing/notices/${id}`;
    case "tenancy_contact":
      return extra?.tenancyId ? `/leasing/tenancies/${extra.tenancyId}` : null;
    default:
      return null;
  }
}

export async function resolvePmLinkDisplay(
  organizationId: string,
  links: PmContextLink[],
): Promise<Map<string, PmLinkDisplay>> {
  const map = new Map<string, PmLinkDisplay>();
  if (links.length === 0) return map;

  const byKind = new Map<PmContextKind, string[]>();
  for (const link of links) {
    const list = byKind.get(link.kind) ?? [];
    list.push(link.id);
    byKind.set(link.kind, list);
  }

  const propertyIds = [...new Set(byKind.get("property") ?? [])];
  if (propertyIds.length > 0) {
    const rows = await prisma.property.findMany({
      where: { id: { in: propertyIds }, organizationId, isActive: true },
      select: { id: true, name: true },
    });
    for (const p of rows) {
      map.set(displayKey("property", p.id), {
        kind: "property",
        id: p.id,
        label: p.name,
        chipLabel: p.name,
        href: null,
      });
    }
  }

  const tenancyIds = [...new Set(byKind.get("tenancy") ?? [])];
  if (tenancyIds.length > 0) {
    const rows = await prisma.tenancy.findMany({
      where: { id: { in: tenancyIds }, property: { organizationId } },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        contacts: {
          where: { contactType: "tenant" },
          take: 1,
          select: { firstName: true, lastName: true },
        },
      },
    });
    for (const t of rows) {
      const contact = t.contacts[0];
      const who = contact
        ? [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim()
        : "";
      const label = who
        ? `${t.property.name} · Unit ${t.unit.unitNumber} · ${who}`
        : `${t.property.name} · Unit ${t.unit.unitNumber}`;
      map.set(displayKey("tenancy", t.id), {
        kind: "tenancy",
        id: t.id,
        label,
        chipLabel: label,
        href: pmLinkHref("tenancy", t.id),
      });
    }
  }

  const maintenanceIds = [...new Set(byKind.get("maintenance_request") ?? [])];
  if (maintenanceIds.length > 0) {
    const rows = await prisma.maintenanceRequest.findMany({
      where: { id: { in: maintenanceIds }, organizationId },
      select: { id: true, title: true, status: true },
    });
    for (const r of rows) {
      const label = `${r.title} (${r.status})`;
      map.set(displayKey("maintenance_request", r.id), {
        kind: "maintenance_request",
        id: r.id,
        label,
        chipLabel: r.title,
        href: pmLinkHref("maintenance_request", r.id),
      });
    }
  }

  const applicationIds = [...new Set(byKind.get("application") ?? [])];
  if (applicationIds.length > 0) {
    const rows = await prisma.application.findMany({
      where: { id: { in: applicationIds }, property: { organizationId } },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    });
    for (const a of rows) {
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.email;
      const label = `${name} · ${a.status}`;
      map.set(displayKey("application", a.id), {
        kind: "application",
        id: a.id,
        label,
        chipLabel: name,
        href: pmLinkHref("application", a.id),
      });
    }
  }

  const unitIds = [...new Set(byKind.get("unit") ?? [])];
  if (unitIds.length > 0) {
    const rows = await prisma.unit.findMany({
      where: { id: { in: unitIds }, property: { organizationId, isActive: true } },
      select: { id: true, unitNumber: true, property: { select: { name: true } } },
    });
    for (const u of rows) {
      const label = `${u.property.name} · Unit ${u.unitNumber}`;
      map.set(displayKey("unit", u.id), {
        kind: "unit",
        id: u.id,
        label,
        chipLabel: label,
        href: null,
      });
    }
  }

  const contactIds = [...new Set(byKind.get("tenancy_contact") ?? [])];
  if (contactIds.length > 0) {
    const rows = await prisma.tenancyContact.findMany({
      where: { id: { in: contactIds }, tenancy: { property: { organizationId } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        tenancyId: true,
        tenancy: {
          select: {
            property: { select: { name: true } },
            unit: { select: { unitNumber: true } },
          },
        },
      },
    });
    for (const c of rows) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Contact";
      const label = `${name} · ${c.tenancy.property.name} Unit ${c.tenancy.unit.unitNumber}`;
      map.set(displayKey("tenancy_contact", c.id), {
        kind: "tenancy_contact",
        id: c.id,
        label,
        chipLabel: name,
        href: pmLinkHref("tenancy_contact", c.id, { tenancyId: c.tenancyId }),
      });
    }
  }

  const noticeIds = [...new Set(byKind.get("notice") ?? [])];
  if (noticeIds.length > 0) {
    const rows = await prisma.notice.findMany({
      where: { id: { in: noticeIds }, property: { organizationId } },
      select: { id: true, title: true },
    });
    for (const n of rows) {
      map.set(displayKey("notice", n.id), {
        kind: "notice",
        id: n.id,
        label: n.title,
        chipLabel: n.title,
        href: pmLinkHref("notice", n.id),
      });
    }
  }

  const documentIds = [...new Set(byKind.get("document") ?? [])];
  if (documentIds.length > 0) {
    const rows = await prisma.document.findMany({
      where: { id: { in: documentIds }, property: { organizationId } },
      select: { id: true, title: true },
    });
    for (const d of rows) {
      map.set(displayKey("document", d.id), {
        kind: "document",
        id: d.id,
        label: d.title,
        chipLabel: d.title,
        href: null,
      });
    }
  }

  return map;
}

export function getPmLinkDisplay(
  map: Map<string, PmLinkDisplay>,
  link: PmContextLink,
): PmLinkDisplay | null {
  return map.get(displayKey(link.kind, link.id)) ?? null;
}
