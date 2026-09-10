import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient, Property } from "@prisma/client";
import { normalizeStreetLineKey } from "@/lib/integrations/pm-context/normalize-address-hint";
import type { PropertyAddressFormInput } from "@/lib/validation/property-address";
import { parsePropertyAddressFormInput } from "@/lib/validation/property-address";
import {
  findPropertyAddressDuplicates,
  updatePropertyAddress,
} from "./property-address.service";
import { ForbiddenError, NotFoundError } from "./errors";
import type { StaffContext } from "./staff-context";

const ORG_ID = "org_test";
const PROPERTY_ID = "prop_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

function propertyManagerContext(): StaffContext {
  return {
    userId: "user_pm",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "property_manager",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["property_manager"])]]),
  };
}

function fieldAgentContext(): StaffContext {
  return {
    userId: "user_agent",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "field_agent",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
  };
}

function tenantContext(): StaffContext {
  return {
    userId: "user_tenant",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "tenant",
    assignmentRolesByProperty: new Map(),
  };
}

type AuditLogRow = {
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
};

function existingProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: PROPERTY_ID,
    name: "123 Main St",
    streetLine1: "123 Main St",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
    isActive: true,
    serviceRelationship: "MANAGED",
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
    approxSqft: null,
    ownerEmail: null,
    ownerPhone: null,
    strataNotes: null,
    organizationId: ORG_ID,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Property;
}

function createMockPrisma(options: { property?: Property; organizationId?: string; others?: Property[] } = {}) {
  const before = options.property ?? existingProperty();
  const updates: Array<Record<string, unknown>> = [];
  const activityLogs: AuditLogRow[] = [];
  const findManyArgs: Array<Record<string, unknown>> = [];

  const prisma = {
    property: {
      findFirst: async () => ({ organizationId: options.organizationId ?? ORG_ID }),
      count: async () => 1,
      findUnique: async () => before,
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs.push(args);
        return (options.others ?? []).map((row) => ({
          id: row.id,
          streetLine1: row.streetLine1,
          streetLine2: row.streetLine2,
          city: row.city,
          postalCode: row.postalCode,
        }));
      },
      update: async ({ data }: { data: Record<string, unknown> }): Promise<Property> => {
        updates.push(data);
        return existingProperty({ ...before, ...(data as Partial<Property>) });
      },
    },
    activityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        activityLogs.push(data as AuditLogRow);
        return {};
      },
    },
    get updates() {
      return updates;
    },
    get activityLogs() {
      return activityLogs;
    },
    get findManyArgs() {
      return findManyArgs;
    },
  };

  return prisma;
}

function addressInput(overrides: Partial<PropertyAddressFormInput> = {}): PropertyAddressFormInput {
  return {
    streetLine1: "123 Main St",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
    ...overrides,
  };
}

describe("updatePropertyAddress", () => {
  it("lets an organization admin update the address", async () => {
    const prisma = createMockPrisma();

    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ city: "Burnaby" }),
    );

    assert.equal(result.property.city, "Burnaby");
    assert.equal(prisma.updates.length, 1);
  });

  it("lets an assigned property manager update the address", async () => {
    const prisma = createMockPrisma();

    await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      propertyManagerContext(),
      PROPERTY_ID,
      addressInput({ city: "Burnaby" }),
    );

    assert.equal(prisma.updates.length, 1);
  });

  it("refuses a field agent", async () => {
    const prisma = createMockPrisma();

    await assert.rejects(
      () =>
        updatePropertyAddress(
          prisma as unknown as PrismaClient,
          fieldAgentContext(),
          PROPERTY_ID,
          addressInput(),
        ),
      ForbiddenError,
    );
    assert.equal(prisma.updates.length, 0);
  });

  it("refuses a tenant account", async () => {
    const prisma = createMockPrisma();

    await assert.rejects(
      () =>
        updatePropertyAddress(
          prisma as unknown as PrismaClient,
          tenantContext(),
          PROPERTY_ID,
          addressInput(),
        ),
      ForbiddenError,
    );
    assert.equal(prisma.updates.length, 0);
  });

  it("refuses a property in another organization", async () => {
    const prisma = createMockPrisma({ organizationId: "org_other" });

    await assert.rejects(
      () =>
        updatePropertyAddress(
          prisma as unknown as PrismaClient,
          adminContext(),
          PROPERTY_ID,
          addressInput(),
        ),
      ForbiddenError,
    );
    assert.equal(prisma.updates.length, 0);
  });

  it("writes all six address fields on every save", async () => {
    const prisma = createMockPrisma();

    await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine2: "Upper", city: "Burnaby", province: "BC", postalCode: "V5K 0A1" }),
    );

    const data = prisma.updates[0]!;
    for (const field of ["streetLine1", "streetLine2", "city", "province", "postalCode", "country"]) {
      assert.ok(field in data, `${field} was not written`);
    }
  });

  it("synchronizes the property name when the street line changes", async () => {
    const prisma = createMockPrisma({
      property: existingProperty({ streetLine1: "123 Main St", name: "123 Main St" }),
    });

    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine1: "456 Oak Ave" }),
    );

    assert.equal(result.nameSynchronized, true);
    assert.equal(prisma.updates[0]?.name, "456 Oak Ave");
    // One update: name and address cannot land in separate operations.
    assert.equal(prisma.updates.length, 1);
  });

  it("leaves the name untouched when the street line is unchanged", async () => {
    const prisma = createMockPrisma({
      property: existingProperty({ streetLine1: "123 Main St", name: "Legacy label" }),
    });

    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine1: "123 Main St", city: "Burnaby" }),
    );

    assert.equal(result.nameSynchronized, false);
    assert.ok(!("name" in prisma.updates[0]!), "name must not be rewritten by an unrelated edit");
  });

  it("corrects a stored street line that is only badly whitespaced, and syncs the name with it", async () => {
    // The persisted value really does move here, so this is a change, not a formatting no-op —
    // and `name` has to follow it or the two would disagree.
    const prisma = createMockPrisma({
      property: existingProperty({ streetLine1: "  123 Main St  ", name: "  123 Main St  " }),
    });

    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine1: "123 Main St" }),
    );

    assert.equal(result.changed, true);
    assert.equal(result.nameSynchronized, true);
    assert.equal(prisma.updates[0]?.streetLine1, "123 Main St");
    assert.equal(prisma.updates[0]?.name, "123 Main St");
  });

  it("records old and new address values through the existing property audit path", async () => {
    const prisma = createMockPrisma({
      property: existingProperty({ streetLine1: "123 Main St", city: "Vancouver" }),
    });

    await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine1: "456 Oak Ave", city: "Burnaby", postalCode: "V5K 0A1" }),
    );

    assert.equal(prisma.activityLogs.length, 1);
    const log = prisma.activityLogs[0]!;
    assert.equal(log.action, "property.updated");
    assert.equal(log.oldValues?.streetLine1, "123 Main St");
    assert.equal(log.oldValues?.city, "Vancouver");
    assert.equal(log.newValues?.streetLine1, "456 Oak Ave");
    assert.equal(log.newValues?.city, "Burnaby");
    assert.equal(log.newValues?.postalCode, "V5K 0A1");
    assert.equal(log.newValues?.name, "456 Oak Ave");
  });

  it("reports a missing property rather than writing", async () => {
    const prisma = createMockPrisma();
    const missing = {
      ...prisma,
      property: { ...prisma.property, findUnique: async () => null },
    };

    await assert.rejects(
      () =>
        updatePropertyAddress(
          missing as unknown as PrismaClient,
          adminContext(),
          PROPERTY_ID,
          addressInput(),
        ),
      NotFoundError,
    );
  });

  it("stores a street line that normalizes exactly as PM context will read it", async () => {
    // PM context resolves inbound address hints against normalized `streetLine1`. The editor
    // collapses whitespace and trims but must not otherwise reshape the value, or a corrected
    // address would stop matching.
    const prisma = createMockPrisma();
    const parsed = parsePropertyAddressFormInput({
      streetLine1: "  456   Oak   Ave  W ",
      city: "Vancouver",
      postalCode: "v5k0a1",
    });
    assert.ok(!("error" in parsed));

    await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      parsed,
    );

    const stored = prisma.updates[0]?.streetLine1 as string;
    assert.equal(stored, "456 Oak Ave W");
    assert.equal(normalizeStreetLineKey(stored), normalizeStreetLineKey("456 Oak Avenue West"));
    assert.equal(normalizeStreetLineKey(stored), normalizeStreetLineKey("456 oak ave w"));
  });
});

describe("updatePropertyAddress with no persisted difference", () => {
  /** Saves the address exactly as it is stored, optionally reformatting the raw input first. */
  async function resaveStored(
    stored: Partial<Property>,
    rawForm: Record<string, unknown> | null = null,
  ) {
    const property = existingProperty(stored);
    const prisma = createMockPrisma({ property });

    let input: PropertyAddressFormInput;
    if (rawForm) {
      const parsed = parsePropertyAddressFormInput(rawForm);
      assert.ok(!("error" in parsed), `form did not parse: ${JSON.stringify(parsed)}`);
      input = parsed;
    } else {
      input = addressInput({
        streetLine1: property.streetLine1,
        streetLine2: property.streetLine2,
        city: property.city,
        province: property.province,
        postalCode: property.postalCode,
        country: property.country,
      });
    }

    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      input,
    );
    return { prisma, result, property };
  }

  it("does not update the row", async () => {
    const { prisma, result } = await resaveStored({});
    assert.equal(result.changed, false);
    assert.equal(prisma.updates.length, 0);
  });

  it("does not write an ActivityLog entry", async () => {
    const { prisma } = await resaveStored({});
    assert.equal(prisma.activityLogs.length, 0);
  });

  it("does not bump updatedAt through the update path", async () => {
    // `updatedAt` is Prisma's `@updatedAt`, so the only way it moves is an update call. Proving no
    // update happened proves the timestamp is untouched, and the returned row still carries the
    // original value.
    const updatedAt = new Date("2026-01-01");
    const { prisma, result } = await resaveStored({ updatedAt });
    assert.equal(prisma.updates.length, 0);
    assert.equal(result.property.updatedAt.getTime(), updatedAt.getTime());
  });

  it("reports success so the editor closes as it always did", async () => {
    const { result, property } = await resaveStored({});
    assert.equal(result.changed, false);
    assert.equal(result.nameSynchronized, false);
    assert.equal(result.property.id, property.id);
  });

  it("treats an empty street line 2 and a stored null as equal", async () => {
    const { prisma, result } = await resaveStored({ streetLine2: null }, {
      streetLine1: "123 Main St",
      streetLine2: "",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6B 1A1",
      country: "CA",
    });
    assert.equal(result.changed, false);
    assert.equal(prisma.updates.length, 0);
  });

  it("treats raw input that normalizes onto the stored values as a no-op", async () => {
    const { prisma, result } = await resaveStored(
      { streetLine1: "123 Main St", city: "Vancouver", postalCode: "V3H 1A1", province: "BC" },
      {
        // Unspaced postal, doubled internal whitespace, padded city, long-form province, lower case.
        streetLine1: "123   Main  St  ",
        streetLine2: "   ",
        city: "  Vancouver",
        province: "british columbia",
        postalCode: "v3h1a1",
        country: "canada",
      },
    );
    assert.equal(result.changed, false);
    assert.equal(prisma.updates.length, 0);
    assert.equal(prisma.activityLogs.length, 0);
  });

  it("treats omitted province and country as a no-op against their defaults", async () => {
    const { prisma, result } = await resaveStored({ province: "BC", country: "CA" }, {
      streetLine1: "123 Main St",
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
    assert.equal(result.changed, false);
    assert.equal(prisma.updates.length, 0);
  });

  it("still corrects a stored postal code that is not itself normalized", async () => {
    // Stored `V3H1A1`, submitted `v3h1a1` → both normalize to `V3H 1A1`, which differs from what
    // is stored, so this must write rather than being mistaken for a formatting no-op.
    const { prisma, result } = await resaveStored({ postalCode: "V3H1A1" }, {
      streetLine1: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postalCode: "v3h1a1",
      country: "CA",
    });
    assert.equal(result.changed, true);
    assert.equal(prisma.updates.length, 1);
    assert.equal(prisma.updates[0]?.postalCode, "V3H 1A1");
    // Only the postal code moved, so the name must not be rewritten.
    assert.equal(result.nameSynchronized, false);
    assert.ok(!("name" in prisma.updates[0]!));
  });

  it("still corrects a stored province stored in long form", async () => {
    const { prisma, result } = await resaveStored({ province: "British Columbia" }, {
      streetLine1: "123 Main St",
      city: "Vancouver",
      province: "British Columbia",
      postalCode: "V6B 1A1",
      country: "CA",
    });
    assert.equal(result.changed, true);
    assert.equal(prisma.updates[0]?.province, "BC");
  });

  it("still synchronizes the name on a real street change", async () => {
    const prisma = createMockPrisma();
    const result = await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ streetLine1: "456 Oak Ave" }),
    );
    assert.equal(result.changed, true);
    assert.equal(result.nameSynchronized, true);
    assert.equal(prisma.updates[0]?.name, "456 Oak Ave");
  });

  it("still writes the normal audit entry on a real address change", async () => {
    const prisma = createMockPrisma();
    await updatePropertyAddress(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      addressInput({ city: "Burnaby" }),
    );
    assert.equal(prisma.activityLogs.length, 1);
    assert.equal(prisma.activityLogs[0]?.action, "property.updated");
    assert.equal(prisma.activityLogs[0]?.oldValues?.city, "Vancouver");
    assert.equal(prisma.activityLogs[0]?.newValues?.city, "Burnaby");
  });

  it("checks authorization before deciding there is nothing to do", async () => {
    // A no-op must not become a way for an unauthorized viewer to probe stored addresses.
    const prisma = createMockPrisma();
    await assert.rejects(
      () =>
        updatePropertyAddress(
          prisma as unknown as PrismaClient,
          fieldAgentContext(),
          PROPERTY_ID,
          addressInput(),
        ),
      ForbiddenError,
    );
  });
});

describe("findPropertyAddressDuplicates", () => {
  it("scopes candidates to the active organization, excludes self, and narrows by city", async () => {
    const prisma = createMockPrisma();

    await findPropertyAddressDuplicates(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      { streetLine1: "123 Main St", streetLine2: null, city: "Vancouver", postalCode: "V6B 1A1" },
    );

    const where = prisma.findManyArgs[0]?.where as Record<string, unknown>;
    assert.equal(where.organizationId, ORG_ID);
    assert.deepEqual(where.id, { not: PROPERTY_ID });
    assert.deepEqual(where.city, { equals: "Vancouver", mode: "insensitive" });
  });

  it("reports a same-organization collision", async () => {
    const prisma = createMockPrisma({
      others: [existingProperty({ id: "prop_other", streetLine1: "123 main street" })],
    });

    const matches = await findPropertyAddressDuplicates(
      prisma as unknown as PrismaClient,
      adminContext(),
      PROPERTY_ID,
      { streetLine1: "123 Main St", streetLine2: null, city: "Vancouver", postalCode: "V6B 1A1" },
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.propertyId, "prop_other");
  });

  it("refuses a viewer who could not save the address anyway", async () => {
    const prisma = createMockPrisma();

    await assert.rejects(
      () =>
        findPropertyAddressDuplicates(
          prisma as unknown as PrismaClient,
          fieldAgentContext(),
          PROPERTY_ID,
          { streetLine1: "123 Main St", streetLine2: null, city: "Vancouver", postalCode: "V6B 1A1" },
        ),
      ForbiddenError,
    );
  });
});
