import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPropertyTenancyUnitRows,
  pickPrimaryTenancyForUnit,
  type PropertyTenancyContactInput,
  type PropertyTenancyRecordInput,
  type PropertyTenancyUnitInput,
} from "@/lib/property/property-tenancies-staff";

const createdAt = new Date("2026-01-01T12:00:00.000Z");

function unit(overrides: Partial<PropertyTenancyUnitInput> = {}): PropertyTenancyUnitInput {
  return {
    id: "unit_default",
    unitNumber: "Entire Property",
    floor: null,
    bedrooms: null,
    isActive: true,
    ...overrides,
  };
}

function tenancy(overrides: Partial<PropertyTenancyRecordInput> = {}): PropertyTenancyRecordInput {
  return {
    id: "tenancy_default",
    unitId: "unit_default",
    status: "active",
    leaseStartDate: new Date("2022-02-15T12:00:00.000Z"),
    moveInDate: new Date("2022-02-15T12:00:00.000Z"),
    monthlyRent: 2500,
    securityDeposit: 1250,
    createdAt,
    ...overrides,
  };
}

function contact(overrides: Partial<PropertyTenancyContactInput> = {}): PropertyTenancyContactInput {
  return {
    tenancyId: "tenancy_default",
    contactType: "tenant",
    firstName: "Audrey",
    lastName: "Angchangco",
    email: "angchangco.audrey@gmail.com",
    phone: "(604) 379-3398",
    ...overrides,
  };
}

describe("pickPrimaryTenancyForUnit", () => {
  it("prefers active tenancy over pending move-in on the same unit", () => {
    const picked = pickPrimaryTenancyForUnit("unit_upper", [
      tenancy({
        id: "tenancy_pending",
        unitId: "unit_upper",
        status: "pending_move_in",
        createdAt: new Date("2026-02-01T12:00:00.000Z"),
      }),
      tenancy({
        id: "tenancy_active",
        unitId: "unit_upper",
        status: "active",
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
    ]);
    assert.equal(picked?.id, "tenancy_active");
  });
});

describe("buildPropertyTenancyUnitRows", () => {
  it("shows each unit separately for multi-unit properties", () => {
    const rows = buildPropertyTenancyUnitRows(
      [
        unit({ id: "unit_upper", unitNumber: "Upper" }),
        unit({ id: "unit_lower", unitNumber: "Lower" }),
      ],
      [
        tenancy({
          id: "tenancy_upper",
          unitId: "unit_upper",
          monthlyRent: 1800,
        }),
      ],
      [
        contact({
          tenancyId: "tenancy_upper",
          firstName: "Upper",
          lastName: "Tenant",
        }),
      ],
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.unitLabel, "Upper");
    assert.equal(rows[0]?.occupancyStatus, "occupied");
    assert.equal(rows[0]?.tenancyId, "tenancy_upper");
    assert.equal(rows[1]?.unitLabel, "Lower");
    assert.equal(rows[1]?.occupancyStatus, "vacant");
    assert.equal(rows[1]?.tenancyId, null);
  });

  it("includes entire property and additional units without collapsing them", () => {
    const rows = buildPropertyTenancyUnitRows(
      [
        unit({ id: "unit_entire", unitNumber: "Entire Property" }),
        unit({ id: "unit_front", unitNumber: "Front" }),
        unit({ id: "unit_back", unitNumber: "Back" }),
      ],
      [
        tenancy({ id: "tenancy_entire", unitId: "unit_entire" }),
        tenancy({ id: "tenancy_front", unitId: "unit_front", monthlyRent: 2100 }),
      ],
      [
        contact({ tenancyId: "tenancy_entire", firstName: "Whole", lastName: "House" }),
        contact({ tenancyId: "tenancy_front", firstName: "Front", lastName: "Suite" }),
      ],
    );

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => [row.unitLabel, row.occupancyStatus]),
      [
        ["Entire Property", "occupied"],
        ["Front", "occupied"],
        ["Back", "vacant"],
      ],
    );
  });

  it("maps tenant contact and lease fields for occupied units", () => {
    const rows = buildPropertyTenancyUnitRows(
      [unit({ id: "unit_1" })],
      [tenancy({ id: "tenancy_1", unitId: "unit_1", monthlyRent: 2500 })],
      [contact({ tenancyId: "tenancy_1" })],
    );

    const row = rows[0];
    assert.equal(row?.tenantName, "Audrey Angchangco");
    assert.equal(row?.tenantEmail, "angchangco.audrey@gmail.com");
    assert.equal(row?.tenantPhone, "(604) 379-3398");
    assert.equal(row?.monthlyRent, "$2,500");
    assert.equal(row?.leaseStartDate, "2022-02-15");
    assert.equal(row?.tenancyStatus, "active");
    assert.equal(row?.tenancyStatusLabel, "Active");
  });

  it("supports legacy imported tenants with name only and blank email or phone", () => {
    const rows = buildPropertyTenancyUnitRows(
      [unit({ id: "unit_1" })],
      [tenancy({ id: "tenancy_1", unitId: "unit_1", monthlyRent: 0 })],
      [
        contact({
          tenancyId: "tenancy_1",
          firstName: "MEZGHAN",
          lastName: "Alemy",
          email: "",
          phone: null,
        }),
      ],
    );

    const row = rows[0];
    assert.equal(row?.tenantName, "MEZGHAN Alemy");
    assert.equal(row?.tenantEmail, null);
    assert.equal(row?.tenantPhone, null);
  });
});
