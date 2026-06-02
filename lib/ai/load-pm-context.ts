import prisma from "@/lib/db/prisma";
import type { PmContextKind, PmContextLink } from "@/lib/ai/email-context-links";

export type PmContextSnippet = {
  kind: PmContextKind;
  id: string;
  label: string;
  text: string;
};

const MAX_SNIPPET = 800;
const MAX_TRIAGE = 240;
const MAX_NOTICE_BODY = 200;
const MAX_OPEN_MAINTENANCE = 3;

function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatAddress(parts: {
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string;
}): string {
  const line2 = parts.streetLine2?.trim();
  const prov = parts.province?.trim() || "BC";
  return clamp(
    [parts.streetLine1, line2, `${parts.city}, ${prov} ${parts.postalCode}`].filter(Boolean).join(", "),
    200,
  );
}

async function assertPropertyInOrg(propertyId: string, organizationId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      streetLine1: true,
      streetLine2: true,
      city: true,
      province: true,
      postalCode: true,
    },
  });
}

const OPEN_MAINTENANCE_STATUSES = ["new", "triaged", "dispatched", "in_progress", "scheduled"] as const;

async function openMaintenanceLines(args: {
  organizationId: string;
  propertyId?: string;
  tenancyId?: string;
}): Promise<string[]> {
  const rows = await prisma.maintenanceRequest.findMany({
    where: {
      organizationId: args.organizationId,
      status: { in: [...OPEN_MAINTENANCE_STATUSES] },
      ...(args.tenancyId ? { tenancyId: args.tenancyId } : {}),
      ...(args.propertyId && !args.tenancyId ? { propertyId: args.propertyId } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: MAX_OPEN_MAINTENANCE,
    select: {
      id: true,
      title: true,
      status: true,
      urgency: true,
      trade: true,
      triageSummary: true,
    },
  });

  return rows.map(
    (r) =>
      `${r.title} (${r.status}, ${r.urgency} ${r.trade})` +
      (r.triageSummary ? ` — ${clamp(r.triageSummary, 120)}` : ""),
  );
}

/**
 * Loads concise PM snippets for explicitly linked records only.
 * All queries are scoped to `organizationId`.
 */
export async function loadPmContextSnippets(
  organizationId: string,
  links: PmContextLink[],
): Promise<PmContextSnippet[]> {
  if (!links.length) return [];

  const snippets: PmContextSnippet[] = [];
  const seen = new Set<string>();

  const push = (snippet: PmContextSnippet) => {
    const key = `${snippet.kind}:${snippet.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    snippets.push(snippet);
  };

  for (const link of links) {
    switch (link.kind) {
      case "property": {
        const p = await assertPropertyInOrg(link.id, organizationId);
        if (!p) break;
        const open = await openMaintenanceLines({ organizationId, propertyId: p.id });
        push({
          kind: "property",
          id: p.id,
          label: `Property · ${p.name}`,
          text: clamp(
            `Name: ${p.name}. Address: ${formatAddress(p)}.` +
              (open.length ? ` Open maintenance (${open.length}): ${open.join("; ")}` : ""),
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "unit": {
        const u = await prisma.unit.findFirst({
          where: { id: link.id, property: { organizationId, isActive: true } },
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            property: { select: { name: true, id: true } },
          },
        });
        if (!u) break;
        push({
          kind: "unit",
          id: u.id,
          label: `Unit · ${u.property.name} ${u.unitNumber}`,
          text: clamp(
            `Unit ${u.unitNumber}${u.floor ? ` (floor ${u.floor})` : ""} at ${u.property.name}.`,
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "tenancy": {
        const t = await prisma.tenancy.findFirst({
          where: { id: link.id, property: { organizationId } },
          include: {
            property: { select: { name: true, streetLine1: true, city: true } },
            unit: { select: { unitNumber: true } },
            contacts: {
              where: { contactType: "tenant" },
              take: 2,
              select: { firstName: true, lastName: true, email: true },
            },
          },
        });
        if (!t) break;
        const tenantNames = t.contacts
          .map((c) => `${c.firstName} ${c.lastName}`.trim())
          .filter(Boolean)
          .join(", ");
        const open = await openMaintenanceLines({ organizationId, tenancyId: t.id });
        push({
          kind: "tenancy",
          id: t.id,
          label: `Tenancy · ${t.property.name} ${t.unit.unitNumber}`,
          text: clamp(
            `Status: ${t.status}. Lease ${t.leaseStartDate.toISOString().slice(0, 10)}` +
              (t.leaseEndDate ? ` to ${t.leaseEndDate.toISOString().slice(0, 10)}` : "") +
              `. Property: ${t.property.name}, ${t.property.city}.` +
              (tenantNames ? ` Tenant contact(s): ${tenantNames}.` : "") +
              (open.length ? ` Open maintenance: ${open.join("; ")}` : ""),
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "tenancy_contact": {
        const c = await prisma.tenancyContact.findFirst({
          where: { id: link.id, tenancy: { property: { organizationId } } },
          include: {
            tenancy: {
              select: {
                status: true,
                unit: { select: { unitNumber: true } },
                property: { select: { name: true } },
              },
            },
          },
        });
        if (!c) break;
        push({
          kind: "tenancy_contact",
          id: c.id,
          label: `Contact · ${c.firstName} ${c.lastName}`,
          text: clamp(
            `${c.firstName} ${c.lastName} (${c.contactType}), ${c.email}. ` +
              `Tenancy at ${c.tenancy.property.name} unit ${c.tenancy.unit.unitNumber}, status ${c.tenancy.status}.`,
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "maintenance_request": {
        const r = await prisma.maintenanceRequest.findFirst({
          where: { id: link.id, organizationId },
          include: {
            property: { select: { name: true } },
            unit: { select: { unitNumber: true } },
          },
        });
        if (!r) break;
        push({
          kind: "maintenance_request",
          id: r.id,
          label: `Maintenance · ${r.title}`,
          text: clamp(
            `${r.title}. Status: ${r.status}, urgency: ${r.urgency}, trade: ${r.trade}. ` +
              `Location: ${r.property.name} unit ${r.unit.unitNumber}.` +
              (r.triageSummary ? ` Triage: ${clamp(r.triageSummary, MAX_TRIAGE)}` : ""),
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "application": {
        const a = await prisma.application.findFirst({
          where: { id: link.id, property: { organizationId } },
          include: {
            property: { select: { name: true } },
            unit: { select: { unitNumber: true } },
          },
        });
        if (!a) break;
        const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.email;
        push({
          kind: "application",
          id: a.id,
          label: `Application · ${name}`,
          text: clamp(
            `Rental application status: ${a.status}. Applicant: ${name}. ` +
              `Unit ${a.unit.unitNumber} at ${a.property.name}.` +
              (a.desiredMoveInDate
                ? ` Desired move-in: ${a.desiredMoveInDate.toISOString().slice(0, 10)}.`
                : ""),
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "notice": {
        const n = await prisma.notice.findFirst({
          where: { id: link.id, property: { organizationId } },
          select: {
            id: true,
            noticeType: true,
            title: true,
            servedAt: true,
            body: true,
            property: { select: { name: true } },
          },
        });
        if (!n) break;
        push({
          kind: "notice",
          id: n.id,
          label: `Notice · ${n.title}`,
          text: clamp(
            `${n.noticeType}: ${n.title} (${n.property.name})` +
              (n.servedAt ? `, served ${n.servedAt.toISOString().slice(0, 10)}` : "") +
              `. Summary: ${clamp(n.body, MAX_NOTICE_BODY)}`,
            MAX_SNIPPET,
          ),
        });
        break;
      }
      case "document": {
        const d = await prisma.document.findFirst({
          where: { id: link.id, property: { organizationId } },
          select: {
            id: true,
            title: true,
            documentType: true,
            isSigned: true,
            property: { select: { name: true } },
          },
        });
        if (!d) break;
        push({
          kind: "document",
          id: d.id,
          label: `Document · ${d.title}`,
          text: clamp(
            `${d.documentType}: ${d.title} (${d.property.name})${d.isSigned ? ", signed" : ""}. Metadata only — full file not included.`,
            MAX_SNIPPET,
          ),
        });
        break;
      }
      default:
        break;
    }
  }

  return snippets;
}
