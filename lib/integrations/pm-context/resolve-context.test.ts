import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PropertyServiceRelationship, TenancyContactType, TenancyStatus } from "@prisma/client";
import type { IntegrationPrincipal } from "./integration-principal";
import { resolveContext, type ContextResolverDb } from "./resolve-context";

const ORG_A = "org_a";
const ORG_B = "org_b";

type PropertyFixture = {
  id: string;
  organizationId: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  isActive: boolean;
  serviceRelationship: PropertyServiceRelationship;
  ownerEmail: string | null;
};

type UnitFixture = { id: string; propertyId: string; unitNumber: string; isActive: boolean };

type TenancyFixture = {
  id: string;
  propertyId: string;
  unitId: string;
  status: TenancyStatus;
};

type ContactFixture = {
  id: string;
  tenancyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  contactType: TenancyContactType;
};

/**
 * Two-organization fixture set. Org B mirrors Org A's address, unit label, tenant email, and
 * owner email so every isolation test exercises a record that *would* match if scoping failed.
 */
const PROPERTIES: PropertyFixture[] = [
  {
    id: "prop_a1",
    organizationId: ORG_A,
    name: "123 Main Street",
    streetLine1: "123 Main St",
    streetLine2: null,
    isActive: true,
    serviceRelationship: "MANAGED",
    ownerEmail: "owner-a@example.com",
  },
  {
    id: "prop_a2",
    organizationId: ORG_A,
    name: "456 Oak Avenue",
    streetLine1: "456 Oak Ave W",
    streetLine2: null,
    isActive: false,
    serviceRelationship: "PLACEMENT_ONLY",
    ownerEmail: null,
  },
  {
    id: "prop_a3",
    organizationId: ORG_A,
    name: "789 Cedar Road",
    streetLine1: "789 Cedar Rd",
    streetLine2: null,
    isActive: true,
    serviceRelationship: "MANAGED",
    ownerEmail: null,
  },
  {
    id: "prop_b1",
    organizationId: ORG_B,
    name: "123 Main Street",
    streetLine1: "123 Main St",
    streetLine2: null,
    isActive: true,
    serviceRelationship: "MANAGED",
    ownerEmail: "owner-a@example.com",
  },
];

const UNITS: UnitFixture[] = [
  { id: "unit_a1_204", propertyId: "prop_a1", unitNumber: "204", isActive: true },
  { id: "unit_a1_305", propertyId: "prop_a1", unitNumber: "305", isActive: true },
  { id: "unit_a2_entire", propertyId: "prop_a2", unitNumber: "Entire Property", isActive: true },
  { id: "unit_a3_204", propertyId: "prop_a3", unitNumber: "204", isActive: true },
  { id: "unit_b1_204", propertyId: "prop_b1", unitNumber: "204", isActive: true },
];

const TENANCIES: TenancyFixture[] = [
  { id: "ten_a_current", propertyId: "prop_a1", unitId: "unit_a1_204", status: "active" },
  { id: "ten_a_past", propertyId: "prop_a1", unitId: "unit_a1_305", status: "ended" },
  { id: "ten_a_pending", propertyId: "prop_a3", unitId: "unit_a3_204", status: "pending_move_in" },
  { id: "ten_b_current", propertyId: "prop_b1", unitId: "unit_b1_204", status: "active" },
];

const CONTACTS: ContactFixture[] = [
  {
    id: "contact_a_current",
    tenancyId: "ten_a_current",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "604-555-0101",
    contactType: "tenant",
  },
  {
    id: "contact_a_past",
    tenancyId: "ten_a_past",
    firstName: "Sam",
    lastName: "Former",
    email: "sam@example.com",
    phone: null,
    contactType: "tenant",
  },
  {
    id: "contact_a_ambiguous_1",
    tenancyId: "ten_a_current",
    firstName: "Pat",
    lastName: "Both",
    email: "pat@example.com",
    phone: null,
    contactType: "co_tenant",
  },
  {
    id: "contact_a_ambiguous_2",
    tenancyId: "ten_a_pending",
    firstName: "Pat",
    lastName: "Both",
    email: "pat@example.com",
    phone: null,
    contactType: "tenant",
  },
  {
    id: "contact_b_current",
    tenancyId: "ten_b_current",
    firstName: "Bee",
    lastName: "Tenant",
    email: "jane@example.com",
    phone: null,
    contactType: "tenant",
  },
];

function propertyOf(id: string): PropertyFixture {
  const row = PROPERTIES.find((p) => p.id === id);
  assert.ok(row, `missing property fixture ${id}`);
  return row;
}

function unitOf(id: string): UnitFixture {
  const row = UNITS.find((u) => u.id === id);
  assert.ok(row, `missing unit fixture ${id}`);
  return row;
}

function tenancyOf(id: string): TenancyFixture {
  const row = TENANCIES.find((t) => t.id === id);
  assert.ok(row, `missing tenancy fixture ${id}`);
  return row;
}

/** Organization of an indirectly scoped record, resolved through Property like the real schema. */
function organizationOfTenancy(tenancyId: string): string {
  return propertyOf(tenancyOf(tenancyId).propertyId).organizationId;
}

type WhereClause = Record<string, unknown>;

function requiredOrganizationId(where: WhereClause): string {
  // Mirrors the real constraint: the resolver must put the org in the query, not filter after.
  const direct = where.organizationId;
  if (typeof direct === "string") return direct;

  const property = where.property as { organizationId?: string } | undefined;
  if (typeof property?.organizationId === "string") return property.organizationId;

  const tenancy = where.tenancy as { property?: { organizationId?: string } } | undefined;
  if (typeof tenancy?.property?.organizationId === "string") {
    return tenancy.property.organizationId;
  }

  throw new Error(`Query is not organization-constrained: ${JSON.stringify(where)}`);
}

function projectProperty(row: PropertyFixture) {
  return {
    id: row.id,
    name: row.name,
    streetLine1: row.streetLine1,
    streetLine2: row.streetLine2,
    isActive: row.isActive,
    serviceRelationship: row.serviceRelationship,
  };
}

function projectTenancy(row: TenancyFixture) {
  const property = propertyOf(row.propertyId);
  const unit = unitOf(row.unitId);
  return {
    id: row.id,
    status: row.status,
    propertyId: row.propertyId,
    unitId: row.unitId,
    property: {
      id: property.id,
      name: property.name,
      streetLine1: property.streetLine1,
      streetLine2: property.streetLine2,
    },
    unit: { id: unit.id, unitNumber: unit.unitNumber },
  };
}

function createDb(): ContextResolverDb & { queries: string[] } {
  const queries: string[] = [];

  return {
    queries,
    tenancyContact: {
      findMany: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("tenancyContact.findMany");

        const emailFilter = where.email as { equals: string; mode: string };
        assert.equal(emailFilter.mode, "insensitive");

        return CONTACTS.filter(
          (contact) =>
            contact.email.toLowerCase() === emailFilter.equals.toLowerCase() &&
            organizationOfTenancy(contact.tenancyId) === organizationId,
        ).map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          contactType: contact.contactType,
          tenancyId: contact.tenancyId,
          tenancy: projectTenancy(tenancyOf(contact.tenancyId)),
        }));
      },
    },
    property: {
      findFirst: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("property.findFirst");
        const row = PROPERTIES.find(
          (p) => p.id === where.id && p.organizationId === organizationId,
        );
        return row ? projectProperty(row) : null;
      },
      findMany: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("property.findMany");

        let rows = PROPERTIES.filter((p) => p.organizationId === organizationId);

        const ownerEmail = where.ownerEmail as { equals: string; mode: string } | undefined;
        if (ownerEmail) {
          assert.equal(ownerEmail.mode, "insensitive");
          rows = rows.filter(
            (p) => (p.ownerEmail ?? "").toLowerCase() === ownerEmail.equals.toLowerCase(),
          );
          return rows.map((p) => ({
            id: p.id,
            name: p.name,
            streetLine1: p.streetLine1,
            streetLine2: p.streetLine2,
          })) as never;
        }

        const or = where.OR as Array<{ streetLine1: { startsWith: string } }> | undefined;
        if (or) {
          rows = rows.filter((p) =>
            or.some((clause) => p.streetLine1.startsWith(clause.streetLine1.startsWith)),
          );
        }
        return rows.map(projectProperty);
      },
    },
    unit: {
      findFirst: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("unit.findFirst");
        const row = UNITS.find(
          (u) => u.id === where.id && propertyOf(u.propertyId).organizationId === organizationId,
        );
        return row ? { ...row, property: projectProperty(propertyOf(row.propertyId)) } : null;
      },
      findMany: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("unit.findMany");
        const ids = (where.propertyId as { in: string[] }).in;
        return UNITS.filter(
          (u) =>
            ids.includes(u.propertyId) &&
            propertyOf(u.propertyId).organizationId === organizationId,
        );
      },
    },
    tenancy: {
      findMany: async (args: unknown) => {
        const where = (args as { where: WhereClause }).where;
        const organizationId = requiredOrganizationId(where);
        queries.push("tenancy.findMany");
        const ids = (where.unitId as { in: string[] }).in;
        return TENANCIES.filter(
          (t) => ids.includes(t.unitId) && propertyOf(t.propertyId).organizationId === organizationId,
        ).map(projectTenancy);
      },
    },
  };
}

function principal(organizationId: string): IntegrationPrincipal {
  return {
    credentialId: `cred_${organizationId}`,
    organizationId,
    app: "ROCKET_COMMUNICATOR",
    environment: "PRODUCTION",
    scopes: ["PM_CONTEXT_READ"],
  };
}

function emptyRequest() {
  return {
    senderEmail: null,
    addressHints: [] as string[],
    unitHints: [] as string[],
    knownPropertyId: null,
    knownUnitId: null,
  };
}

describe("resolveContext — sender email matching", () => {
  it("returns a high-confidence current tenant for a unique current match", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });

    assert.equal(result.contacts.length, 1);
    const contact = result.contacts[0]!;
    assert.equal(contact.id, "contact_a_current");
    assert.equal(contact.confidence, "high");
    assert.equal(contact.matchReason, "sender_email_exact_current_tenancy_contact");
    assert.equal(contact.occupancy, "current");
    assert.equal(contact.displayLabel, "Jane Doe — 123 Main St – 204");
  });

  it("marks a former tenant historical and never promotes it to high", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "sam@example.com",
    });

    assert.equal(result.contacts.length, 1);
    const contact = result.contacts[0]!;
    assert.equal(contact.occupancy, "historical");
    assert.equal(contact.confidence, "medium");
    assert.equal(contact.matchReason, "sender_email_exact_historical_tenancy_contact");

    const tenancy = result.tenancies.find((t) => t.id === "ten_a_past");
    assert.ok(tenancy);
    assert.equal(tenancy.occupancy, "historical");
    assert.equal(tenancy.status, "ended");
  });

  it("downgrades an ambiguous sender that maps to several current occupancies", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "pat@example.com",
    });

    assert.equal(result.contacts.length, 2);
    for (const contact of result.contacts) {
      assert.equal(contact.confidence, "medium");
      assert.equal(contact.occupancy, "current");
    }
    // pending_move_in counts as current occupancy, so both tenancies come back.
    assert.deepEqual(
      result.tenancies.map((t) => t.id).sort(),
      ["ten_a_current", "ten_a_pending"],
    );
  });

  it("matches email case-insensitively", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });
    assert.equal(result.contacts[0]?.id, "contact_a_current");
  });

  it("returns nothing for an unknown sender", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "nobody@example.com",
    });

    assert.deepEqual(result.contacts, []);
    assert.deepEqual(result.tenancies, []);
    assert.deepEqual(result.ownerContactMatches, []);
  });
});

describe("resolveContext — owner contact matching", () => {
  it("returns an unstructured property-level owner match with no owner id", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "owner-a@example.com",
    });

    assert.equal(result.ownerContactMatches.length, 1);
    const owner = result.ownerContactMatches[0]!;
    assert.equal(owner.propertyId, "prop_a1");
    assert.equal(owner.confidence, "medium");
    assert.equal(owner.ownerContactField, "ownerEmail");
    assert.equal(owner.isFirstClassOwnerEntity, false);
    assert.ok(!("id" in owner), "there is no Owner model, so no owner id may be invented");
    assert.equal(result.contacts.length, 0);
  });
});

describe("resolveContext — known ids", () => {
  it("accepts a property id inside the credential's organization", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownPropertyId: "prop_a1",
    });

    assert.equal(result.properties.length, 1);
    assert.equal(result.properties[0]?.id, "prop_a1");
    assert.equal(result.properties[0]?.confidence, "high");
    assert.equal(result.properties[0]?.matchReason, "known_property_id_authorized");
  });

  it("resolves a known unit together with its property and current tenancy", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownUnitId: "unit_a1_204",
    });

    assert.equal(result.units[0]?.id, "unit_a1_204");
    assert.equal(result.units[0]?.confidence, "high");
    assert.equal(result.properties[0]?.id, "prop_a1");
    assert.equal(result.tenancies[0]?.id, "ten_a_current");
    assert.equal(result.tenancies[0]?.matchReason, "resolved_unit_current_tenancy");
    assert.equal(result.tenancies[0]?.occupancy, "current");
  });

  it("returns no match for an id that does not exist", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownPropertyId: "prop_missing",
    });
    assert.deepEqual(result.properties, []);
  });
});

describe("resolveContext — address and unit hints", () => {
  it("matches a normalized street line and its unit exactly", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["123 Main Street"],
      unitHints: ["204"],
    });

    assert.equal(result.properties.length, 1);
    assert.equal(result.properties[0]?.id, "prop_a1");
    assert.equal(result.properties[0]?.confidence, "high");
    assert.equal(result.properties[0]?.matchReason, "address_hint_exact_normalized");

    assert.equal(result.units.length, 1);
    assert.equal(result.units[0]?.id, "unit_a1_204");
    assert.equal(result.units[0]?.confidence, "high");
    assert.equal(result.units[0]?.matchReason, "unit_hint_exact_normalized");
  });

  it("reads a unit embedded in the address hint", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["204-123 Main St"],
    });

    assert.equal(result.properties[0]?.id, "prop_a1");
    assert.equal(result.units[0]?.id, "unit_a1_204");
  });

  it("expands directional and street-type abbreviations", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["456 Oak Avenue West"],
    });

    assert.equal(result.properties.length, 1);
    assert.equal(result.properties[0]?.id, "prop_a2");
  });

  it("reports an inactive property rather than hiding or demoting it", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["456 Oak Ave W"],
    });

    const property = result.properties[0]!;
    assert.equal(property.id, "prop_a2");
    assert.equal(property.isActive, false);
    assert.equal(property.serviceRelationship, "PLACEMENT_ONLY");
    // Confidence describes identification certainty; actionability is Communicator's call.
    assert.equal(property.confidence, "high");
  });

  it("downgrades a unit hint that is ambiguous across matched properties", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["123 Main St", "789 Cedar Road"],
      unitHints: ["204"],
    });

    assert.equal(result.units.length, 2);
    for (const unit of result.units) {
      assert.equal(unit.confidence, "medium");
    }
  });

  it("does not resolve a bare unit hint with no property scope", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      unitHints: ["204"],
    });

    assert.deepEqual(result.units, []);
    assert.deepEqual(result.properties, []);
  });

  it("returns nothing for an address that does not exist", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["999 Nowhere Street"],
    });
    assert.deepEqual(result.properties, []);
  });

  it("does not promote a near-miss address to a match", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      addressHints: ["123 Maine Street", "12 Main Street", "123 Main"],
    });
    assert.deepEqual(result.properties, []);
  });
});

describe("resolveContext — organization isolation", () => {
  it("resolves only the calling organization's contact for a shared email", async () => {
    const a = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });
    const b = await resolveContext(createDb(), principal(ORG_B), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });

    assert.deepEqual(a.contacts.map((c) => c.id), ["contact_a_current"]);
    assert.deepEqual(b.contacts.map((c) => c.id), ["contact_b_current"]);
  });

  it("cannot resolve another organization's property by id", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownPropertyId: "prop_b1",
    });
    assert.deepEqual(result.properties, []);
  });

  it("cannot resolve another organization's unit by id", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownUnitId: "unit_b1_204",
    });
    assert.deepEqual(result.units, []);
    assert.deepEqual(result.properties, []);
    assert.deepEqual(result.tenancies, []);
  });

  it("cannot reach another organization's indirectly scoped tenancy or contact", async () => {
    // Tenancy and TenancyContact carry no organizationId — they scope through Property.
    const result = await resolveContext(createDb(), principal(ORG_B), {
      ...emptyRequest(),
      senderEmail: "sam@example.com",
    });

    assert.deepEqual(result.contacts, []);
    assert.deepEqual(result.tenancies, []);
  });

  it("cannot match another organization's owner email", async () => {
    const result = await resolveContext(createDb(), principal(ORG_B), {
      ...emptyRequest(),
      senderEmail: "owner-a@example.com",
    });

    // Org B's own property carries the same owner email; Org A's must not appear.
    assert.deepEqual(result.ownerContactMatches.map((o) => o.propertyId), ["prop_b1"]);
  });

  it("returns an identical empty shape for cross-org and nonexistent records", async () => {
    const crossOrg = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownPropertyId: "prop_b1",
    });
    const nonexistent = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      knownPropertyId: "prop_does_not_exist",
    });

    assert.deepEqual(crossOrg, nonexistent);
  });

  it("does not leak another organization's address into hint matching", async () => {
    const result = await resolveContext(createDb(), principal(ORG_B), {
      ...emptyRequest(),
      addressHints: ["123 Main Street"],
    });

    assert.deepEqual(result.properties.map((p) => p.id), ["prop_b1"]);
    // A single match within the caller's org stays high even though Org A shares the address.
    assert.equal(result.properties[0]?.confidence, "high");
  });

  it("constrains every query in the database layer rather than filtering afterwards", async () => {
    // createDb() throws from requiredOrganizationId when a where clause omits the org constraint.
    const db = createDb();
    await resolveContext(db, principal(ORG_A), {
      senderEmail: "jane@example.com",
      addressHints: ["123 Main St"],
      unitHints: ["204"],
      knownPropertyId: "prop_a1",
      knownUnitId: "unit_a1_204",
    });

    assert.ok(db.queries.includes("tenancyContact.findMany"));
    assert.ok(db.queries.includes("property.findFirst"));
    assert.ok(db.queries.includes("unit.findFirst"));
    assert.ok(db.queries.includes("unit.findMany"));
    assert.ok(db.queries.includes("tenancy.findMany"));
  });
});

describe("resolveContext — field minimization", () => {
  const FORBIDDEN_KEYS = [
    "email",
    "phone",
    "monthlyIncome",
    "employerName",
    "jobTitle",
    "employmentNotes",
    "consentCreditCheck",
    "consentSignatureName",
    "consentIpAddress",
    "consentUserAgent",
    "securityDeposit",
    "petDeposit",
    "monthlyRent",
    "leaseSetupJson",
    "emergencyContactFirstName",
    "emergencyContactPhone",
    "emergencyContactEmail",
    "signatureImageStorageKey",
    "storageKey",
    "documents",
    "strataNotes",
    "ownerEmail",
    "ownerPhone",
    "buildiumResidentCenterUrl",
    "secretHash",
    "notes",
    "internalNotes",
  ];

  it("omits application, lease, deposit, document, and staff fields from every candidate", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      senderEmail: "jane@example.com",
      addressHints: ["123 Main St"],
      unitHints: ["204"],
      knownPropertyId: "prop_a1",
      knownUnitId: "unit_a1_204",
    });

    const candidates = [
      ...result.contacts,
      ...result.properties,
      ...result.units,
      ...result.tenancies,
      ...result.ownerContactMatches,
    ];
    assert.ok(candidates.length > 0, "fixture should produce candidates to inspect");

    for (const candidate of candidates) {
      for (const key of FORBIDDEN_KEYS) {
        assert.ok(
          !(key in candidate),
          `${candidate.entityType} candidate must not expose "${key}"`,
        );
      }
    }
  });

  it("keeps the sender's own email and phone out of the serialized response", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("jane@example.com"));
    assert.ok(!serialized.includes("604-555-0101"));
  });

  it("exposes only the documented keys on a contact candidate", async () => {
    const result = await resolveContext(createDb(), principal(ORG_A), {
      ...emptyRequest(),
      senderEmail: "jane@example.com",
    });

    assert.deepEqual(Object.keys(result.contacts[0]!).sort(), [
      "confidence",
      "contactType",
      "displayLabel",
      "entityType",
      "id",
      "matchReason",
      "occupancy",
      "propertyId",
      "tenancyId",
      "unitId",
    ]);
  });
});
