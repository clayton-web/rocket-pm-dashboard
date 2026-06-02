import type { Prisma } from "@prisma/client";
import type { RemoteEntityRef } from "@/lib/integrations/types";

/** Prisma-backed entities linked from the unified Rocket PM schema. */
export const PM_CONTEXT_SOURCE = "pm" as const;

export type PmContextKind =
  | "property"
  | "unit"
  | "tenancy"
  | "tenancy_contact"
  | "maintenance_request"
  | "application"
  | "notice"
  | "document";

export type PmContextLink = {
  source: typeof PM_CONTEXT_SOURCE;
  kind: PmContextKind;
  id: string;
};

export type EmailThreadContextLink = PmContextLink | RemoteEntityRef;

const PM_KINDS = new Set<PmContextKind>([
  "property",
  "unit",
  "tenancy",
  "tenancy_contact",
  "maintenance_request",
  "application",
  "notice",
  "document",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parsePmLink(raw: Record<string, unknown>): PmContextLink | null {
  if (raw.source !== PM_CONTEXT_SOURCE) return null;
  const kind = raw.kind;
  const id = raw.id;
  if (typeof kind !== "string" || !PM_KINDS.has(kind as PmContextKind)) return null;
  if (typeof id !== "string" || id.trim() === "") return null;
  return { source: PM_CONTEXT_SOURCE, kind: kind as PmContextKind, id: id.trim() };
}

function parseRemoteLink(raw: Record<string, unknown>): RemoteEntityRef | null {
  const system = raw.system;
  const kind = raw.kind;
  const id = raw.id;
  if (typeof system !== "string" || typeof kind !== "string" || typeof id !== "string") return null;
  if (id.trim() === "") return null;
  const allowedSystems = new Set(["rocket-core", "rocket-inspections", "maintenance", "documents", "crm"]);
  if (!allowedSystems.has(system)) return null;
  return { system: system as RemoteEntityRef["system"], kind: kind as RemoteEntityRef["kind"], id: id.trim() };
}

export function isPmContextLink(link: EmailThreadContextLink): link is PmContextLink {
  return "source" in link && link.source === PM_CONTEXT_SOURCE;
}

export function isRemoteContextLink(link: EmailThreadContextLink): link is RemoteEntityRef {
  return "system" in link && !("source" in link);
}

export function parseEmailThreadContextLinks(json: unknown): EmailThreadContextLink[] {
  if (!Array.isArray(json)) return [];
  const out: EmailThreadContextLink[] = [];
  const seen = new Set<string>();

  for (const item of json) {
    if (!isRecord(item)) continue;
    const pm = parsePmLink(item);
    const remote = pm ? null : parseRemoteLink(item);
    const link = pm ?? remote;
    if (!link) continue;
    const key = isPmContextLink(link)
      ? `${link.source}:${link.kind}:${link.id}`
      : `${link.system}:${link.kind}:${link.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }

  return out;
}

export function partitionContextLinks(links: EmailThreadContextLink[] | null | undefined): {
  pmLinks: PmContextLink[];
  remoteLinks: RemoteEntityRef[];
} {
  const pmLinks: PmContextLink[] = [];
  const remoteLinks: RemoteEntityRef[] = [];
  for (const link of links ?? []) {
    if (isPmContextLink(link)) pmLinks.push(link);
    else if (isRemoteContextLink(link)) remoteLinks.push(link);
  }
  return { pmLinks, remoteLinks };
}

export function serializeEmailThreadContextLinks(
  links: EmailThreadContextLink[],
): Prisma.InputJsonValue {
  return links as unknown as Prisma.InputJsonValue;
}

export function pmLinkLabel(link: PmContextLink): string {
  return `${link.kind.replace(/_/g, " ")} · ${link.id.slice(0, 8)}…`;
}
