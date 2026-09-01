import type {
  PropertyServiceRelationship,
  TenancyContactType,
  TenancyStatus,
} from "@prisma/client";
import { getTenancyOccupancyCurrency } from "@/lib/leasing/tenancy-occupancy";
import type {
  ContactCandidate,
  ContextResolveRequest,
  MatchConfidence,
  OwnerContactMatch,
  PropertyCandidate,
  TenancyCandidate,
  UnitCandidate,
} from "@/lib/integrations/pm-context/context-resolve-contract";
import type { IntegrationPrincipal } from "@/lib/integrations/pm-context/integration-principal";
import {
  normalizeStreetLineKey,
  normalizeUnitKey,
  parseAddressHint,
} from "@/lib/integrations/pm-context/normalize-address-hint";
import { formatPropertyAddress, formatPropertyUnitLine } from "@/lib/property/display";

/** Ceiling for the organization-scoped property scan used by address-hint matching. */
export const MAX_ORG_PROPERTY_SCAN = 2000;

/** Keeps responses compact — Communicator ranks and confirms, it does not need a full dump. */
export const MAX_CANDIDATES_PER_TYPE = 10;

const CONFIDENCE_ORDER: Record<MatchConfidence, number> = { high: 0, medium: 1, low: 2 };

type PropertyRow = {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  isActive: boolean;
  serviceRelationship: PropertyServiceRelationship;
};

type UnitRow = {
  id: string;
  propertyId: string;
  unitNumber: string;
  isActive: boolean;
};

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  contactType: TenancyContactType;
  tenancyId: string;
  tenancy: {
    id: string;
    status: TenancyStatus;
    propertyId: string;
    unitId: string;
    property: { id: string; name: string; streetLine1: string; streetLine2: string | null };
    unit: { id: string; unitNumber: string };
  };
};

type OwnerPropertyRow = {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
};

type TenancyRow = {
  id: string;
  status: TenancyStatus;
  propertyId: string;
  unitId: string;
  property: { id: string; name: string; streetLine1: string; streetLine2: string | null };
  unit: { id: string; unitNumber: string };
};

/**
 * Narrow database port. Every method is organization-constrained by its caller in this module;
 * the interface exists so tests can supply fixtures without a live database.
 */
export type ContextResolverDb = {
  tenancyContact: { findMany: (args: unknown) => Promise<ContactRow[]> };
  property: {
    findFirst: (args: unknown) => Promise<PropertyRow | null>;
    findMany: (args: unknown) => Promise<(PropertyRow | OwnerPropertyRow)[]>;
  };
  unit: {
    findFirst: (args: unknown) => Promise<(UnitRow & { property: PropertyRow }) | null>;
    findMany: (args: unknown) => Promise<UnitRow[]>;
  };
  tenancy: { findMany: (args: unknown) => Promise<TenancyRow[]> };
};

export type ResolvedContext = {
  contacts: ContactCandidate[];
  properties: PropertyCandidate[];
  units: UnitCandidate[];
  tenancies: TenancyCandidate[];
  ownerContactMatches: OwnerContactMatch[];
  /** Audit-only diagnostics. Never returned to the caller. */
  diagnostics: { propertyScanTruncated: boolean };
};

const PROPERTY_SELECT = {
  id: true,
  name: true,
  streetLine1: true,
  streetLine2: true,
  isActive: true,
  serviceRelationship: true,
} as const;

const OWNER_PROPERTY_SELECT = {
  id: true,
  name: true,
  streetLine1: true,
  streetLine2: true,
} as const;

const TENANCY_SELECT = {
  id: true,
  status: true,
  propertyId: true,
  unitId: true,
  property: { select: { id: true, name: true, streetLine1: true, streetLine2: true } },
  unit: { select: { id: true, unitNumber: true } },
} as const;

function leadingStreetNumber(streetKey: string): string | null {
  const match = streetKey.match(/^(\d+)/);
  return match?.[1] ?? null;
}

function contactDisplayLabel(row: ContactRow): string {
  const name = [row.firstName, row.lastName].map((p) => p.trim()).filter(Boolean).join(" ");
  const location = formatPropertyUnitLine(row.tenancy.property, row.tenancy.unit.unitNumber);
  return name ? `${name} — ${location}` : location;
}

function sortByConfidence<T extends { confidence: MatchConfidence }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence])
    .slice(0, MAX_CANDIDATES_PER_TYPE);
}

/**
 * Resolves PM context from minimized lookup signals.
 *
 * Organization isolation: every query below is constrained by `principal.organizationId` in the
 * `where` clause itself — including `Tenancy`, `TenancyContact`, and `Unit`, which carry no
 * `organizationId` column and are scoped through their relation to `Property`. Nothing is fetched
 * by global id and authorized afterwards, so a cross-organization record is indistinguishable
 * from a nonexistent one.
 */
export async function resolveContext(
  db: ContextResolverDb,
  principal: IntegrationPrincipal,
  request: ContextResolveRequest,
): Promise<ResolvedContext> {
  const organizationId = principal.organizationId;

  const contacts: ContactCandidate[] = [];
  const properties: PropertyCandidate[] = [];
  const units: UnitCandidate[] = [];
  const tenancies: TenancyCandidate[] = [];
  const ownerContactMatches: OwnerContactMatch[] = [];

  const propertyRowById = new Map<string, PropertyRow>();
  const seenPropertyIds = new Set<string>();
  const seenUnitIds = new Set<string>();
  const seenTenancyIds = new Set<string>();

  function addProperty(row: PropertyRow, confidence: MatchConfidence, reason: PropertyCandidate["matchReason"]): void {
    propertyRowById.set(row.id, row);
    if (seenPropertyIds.has(row.id)) return;
    seenPropertyIds.add(row.id);
    properties.push({
      entityType: "property",
      id: row.id,
      confidence,
      matchReason: reason,
      displayLabel: formatPropertyAddress(row),
      isActive: row.isActive,
      serviceRelationship: row.serviceRelationship,
    });
  }

  function addUnit(
    row: UnitRow,
    property: { name: string; streetLine1: string; streetLine2: string | null },
    confidence: MatchConfidence,
    reason: UnitCandidate["matchReason"],
  ): void {
    if (seenUnitIds.has(row.id)) return;
    seenUnitIds.add(row.id);
    units.push({
      entityType: "unit",
      id: row.id,
      propertyId: row.propertyId,
      confidence,
      matchReason: reason,
      displayLabel: formatPropertyUnitLine(property, row.unitNumber),
      isActive: row.isActive,
    });
  }

  function addTenancy(row: TenancyRow, confidence: MatchConfidence, reason: TenancyCandidate["matchReason"]): void {
    if (seenTenancyIds.has(row.id)) return;
    seenTenancyIds.add(row.id);
    tenancies.push({
      entityType: "tenancy",
      id: row.id,
      propertyId: row.propertyId,
      unitId: row.unitId,
      confidence,
      matchReason: reason,
      displayLabel: formatPropertyUnitLine(row.property, row.unit.unitNumber),
      status: row.status,
      occupancy: getTenancyOccupancyCurrency(row.status),
    });
  }

  // --- Known ids: constrained by organization in the query, never looked up globally. ---

  const scopedPropertyIds = new Set<string>();

  if (request.knownPropertyId) {
    const row = await db.property.findFirst({
      where: { id: request.knownPropertyId, organizationId },
      select: PROPERTY_SELECT,
    });
    if (row) {
      addProperty(row, "high", "known_property_id_authorized");
      scopedPropertyIds.add(row.id);
    }
  }

  if (request.knownUnitId) {
    const row = await db.unit.findFirst({
      where: { id: request.knownUnitId, property: { organizationId } },
      select: {
        id: true,
        propertyId: true,
        unitNumber: true,
        isActive: true,
        property: { select: PROPERTY_SELECT },
      },
    });
    if (row) {
      addProperty(row.property, "high", "known_property_id_authorized");
      addUnit(row, row.property, "high", "known_unit_id_authorized");
      scopedPropertyIds.add(row.propertyId);
    }
  }

  // --- Sender email: current and historical tenancy contacts, kept strictly separate. ---

  if (request.senderEmail) {
    const contactRows = await db.tenancyContact.findMany({
      where: {
        email: { equals: request.senderEmail, mode: "insensitive" },
        tenancy: { property: { organizationId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        contactType: true,
        tenancyId: true,
        tenancy: { select: TENANCY_SELECT },
      },
      take: MAX_CANDIDATES_PER_TYPE * 2,
    });

    const current = contactRows.filter(
      (row) => getTenancyOccupancyCurrency(row.tenancy.status) === "current",
    );
    const historical = contactRows.filter(
      (row) => getTenancyOccupancyCurrency(row.tenancy.status) === "historical",
    );

    // A single current occupancy is the only unambiguous sender identification.
    const currentConfidence: MatchConfidence = current.length === 1 ? "high" : "medium";

    for (const row of current) {
      contacts.push({
        entityType: "tenancy_contact",
        id: row.id,
        confidence: currentConfidence,
        matchReason: "sender_email_exact_current_tenancy_contact",
        displayLabel: contactDisplayLabel(row),
        contactType: row.contactType,
        occupancy: "current",
        tenancyId: row.tenancyId,
        unitId: row.tenancy.unitId,
        propertyId: row.tenancy.propertyId,
      });
      addTenancy(row.tenancy, currentConfidence, "sender_email_exact_current_tenancy_contact");
    }

    // Never promoted to high: a past tenant must not be presented as the current occupant.
    for (const row of historical) {
      contacts.push({
        entityType: "tenancy_contact",
        id: row.id,
        confidence: "medium",
        matchReason: "sender_email_exact_historical_tenancy_contact",
        displayLabel: contactDisplayLabel(row),
        contactType: row.contactType,
        occupancy: "historical",
        tenancyId: row.tenancyId,
        unitId: row.tenancy.unitId,
        propertyId: row.tenancy.propertyId,
      });
      addTenancy(row.tenancy, "medium", "sender_email_exact_historical_tenancy_contact");
    }

    // Property-level owner contact. Unstructured field — no Owner model, so no owner id exists.
    const ownerRows = (await db.property.findMany({
      where: { organizationId, ownerEmail: { equals: request.senderEmail, mode: "insensitive" } },
      select: OWNER_PROPERTY_SELECT,
      take: MAX_CANDIDATES_PER_TYPE,
    })) as OwnerPropertyRow[];

    for (const row of ownerRows) {
      ownerContactMatches.push({
        entityType: "property_owner_contact",
        propertyId: row.id,
        ownerContactField: "ownerEmail",
        isFirstClassOwnerEntity: false,
        confidence: "medium",
        matchReason: "sender_email_exact_property_owner_contact",
        displayLabel: `Property owner contact — ${formatPropertyAddress(row)}`,
      });
    }
  }

  // --- Address hints: exact match on the normalized street line. ---

  let propertyScanTruncated = false;
  const parsedHints = request.addressHints.map(parseAddressHint).filter((h) => h.streetKey !== "");
  const hintUnitKeys = new Set(
    parsedHints.map((h) => h.unitKey).filter((k): k is string => k !== null && k !== ""),
  );
  for (const hint of request.unitHints) {
    const key = normalizeUnitKey(hint);
    if (key) hintUnitKeys.add(key);
  }

  if (parsedHints.length > 0) {
    const streetNumbers = parsedHints.map((h) => leadingStreetNumber(h.streetKey));
    const everyHintHasNumber = streetNumbers.every((n) => n !== null);

    // Street numbers are stable across formatting, so they narrow the scan without weakening the
    // match. Hints with no leading number fall back to a capped organization-wide scan.
    const scanned = (await db.property.findMany({
      where: everyHintHasNumber
        ? {
            organizationId,
            OR: [...new Set(streetNumbers as string[])].map((n) => ({
              streetLine1: { startsWith: n },
            })),
          }
        : { organizationId },
      select: PROPERTY_SELECT,
      take: MAX_ORG_PROPERTY_SCAN + 1,
    })) as PropertyRow[];

    propertyScanTruncated = scanned.length > MAX_ORG_PROPERTY_SCAN;
    const candidatePool = propertyScanTruncated ? scanned.slice(0, MAX_ORG_PROPERTY_SCAN) : scanned;

    const byStreetKey = new Map<string, PropertyRow[]>();
    for (const row of candidatePool) {
      const key = normalizeStreetLineKey(row.streetLine1);
      if (!key) continue;
      const bucket = byStreetKey.get(key);
      if (bucket) bucket.push(row);
      else byStreetKey.set(key, [row]);
    }

    for (const hint of parsedHints) {
      const matched = byStreetKey.get(hint.streetKey);
      if (!matched || matched.length === 0) continue;
      // One property for this address is unambiguous; several is an ambiguous address.
      const confidence: MatchConfidence = matched.length === 1 ? "high" : "medium";
      for (const row of matched) {
        addProperty(row, confidence, "address_hint_exact_normalized");
        scopedPropertyIds.add(row.id);
      }
    }
  }

  // --- Unit hints: only resolved inside already-authorized properties. ---

  if (hintUnitKeys.size > 0 && scopedPropertyIds.size > 0) {
    const unitRows = await db.unit.findMany({
      where: {
        propertyId: { in: [...scopedPropertyIds] },
        property: { organizationId },
      },
      select: { id: true, propertyId: true, unitNumber: true, isActive: true },
      take: MAX_ORG_PROPERTY_SCAN,
    });

    const matchedUnits = unitRows.filter((row) => hintUnitKeys.has(normalizeUnitKey(row.unitNumber)));
    // Exact property + exact unit resolving to one record is unambiguous; more than one is not.
    const unitConfidence: MatchConfidence = matchedUnits.length === 1 ? "high" : "medium";

    for (const row of matchedUnits) {
      const property = propertyRowById.get(row.propertyId);
      if (!property) continue;
      addUnit(row, property, unitConfidence, "unit_hint_exact_normalized");
    }
  }

  // --- Current tenancies for resolved units, so Communicator knows who occupies the unit now. ---

  if (seenUnitIds.size > 0) {
    const tenancyRows = await db.tenancy.findMany({
      where: {
        unitId: { in: [...seenUnitIds] },
        property: { organizationId },
      },
      select: TENANCY_SELECT,
      take: MAX_CANDIDATES_PER_TYPE * 2,
    });

    for (const row of tenancyRows) {
      if (getTenancyOccupancyCurrency(row.status) !== "current") continue;
      const unit = units.find((u) => u.id === row.unitId);
      addTenancy(row, unit?.confidence ?? "medium", "resolved_unit_current_tenancy");
    }
  }

  return {
    contacts: sortByConfidence(contacts),
    properties: sortByConfidence(properties),
    units: sortByConfidence(units),
    tenancies: sortByConfidence(tenancies),
    ownerContactMatches: sortByConfidence(ownerContactMatches),
    diagnostics: { propertyScanTruncated },
  };
}
