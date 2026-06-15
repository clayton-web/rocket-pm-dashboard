import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient, Tenancy, TenancyContact } from "@prisma/client";
import {
  applyTenancyDetailsUpdate,
  mergeTenancyEditLeaseSetupNotes,
} from "@/lib/leasing/apply-tenancy-details-update";
import type { StaffContext } from "@/lib/services/staff-context";
import type { TenancyEditFormInput } from "@/lib/validation/tenancy-edit";
import { parseTenancyOptionalEmail } from "@/lib/validation/tenancy-fields";

const ORG_ID = "org_test";
const PROPERTY_ID = "prop_test";
const TENANCY_ID = "tenancy_test";
const CONTACT_ID = "contact_test";
const APPLICATION_ID = "app_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

type MockState = {
  tenancy: Tenancy;
  contact: TenancyContact;
  contactUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  tenancyUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  applicationUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
};

function createMockPrisma(state: MockState) {
  return {
    property: {
      findFirst: async () => ({ organizationId: ORG_ID }),
    },
    tenancy: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.tenancy.id ? state.tenancy : null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        state.tenancyUpdates.push({ where, data });
        Object.assign(state.tenancy, data);
        return state.tenancy;
      },
    },
    tenancyContact: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === state.contact.id ? state.contact : null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        state.contactUpdates.push({ where, data });
        Object.assign(state.contact, data);
        return state.contact;
      },
    },
    application: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        state.applicationUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    activityLog: {
      create: async () => ({}),
    },
  };
}

const parsedInput: TenancyEditFormInput = {
  contactId: CONTACT_ID,
  firstName: "Audrey",
  lastName: "Angchangco",
  email: "angchangco.audrey@gmail.com",
  phone: "(604) 379-3398",
  portalAccessEnabled: true,
  monthlyRent: 2500,
  securityDeposit: 1250,
  leaseStartDate: "2022-02-15",
  moveInDate: "2022-02-15",
  leaseEndDate: null,
  status: "active",
  parkingDescription: "Stall 12",
  storageDescription: "",
  petDetails: "One cat",
};

describe("applyTenancyDetailsUpdate helpers", () => {
  it("mergeTenancyEditLeaseSetupNotes replaces and clears note fields", () => {
    const merged = mergeTenancyEditLeaseSetupNotes(
      {
        parkingDescription: "Old parking",
        storageDescription: "Locker 3",
        petDetails: "Old pet",
        tenancyType: "month_to_month",
      },
      {
        parkingDescription: "Stall 12",
        storageDescription: "",
        petDetails: "One cat",
      },
    );
    assert.equal(merged.parkingDescription, "Stall 12");
    assert.equal(merged.storageDescription, undefined);
    assert.equal(merged.petDetails, "One cat");
    assert.equal(merged.tenancyType, "month_to_month");
  });

  it("parseTenancyOptionalEmail allows blank legacy email", () => {
    assert.equal(parseTenancyOptionalEmail(""), "");
    assert.equal(parseTenancyOptionalEmail("   "), "");
    assert.equal(parseTenancyOptionalEmail("Tenant@Example.com"), "tenant@example.com");
  });
});

describe("applyTenancyDetailsUpdate", () => {
  it("updates contact, tenancy, and linked application data", async () => {
    const state: MockState = {
      tenancy: {
        id: TENANCY_ID,
        propertyId: PROPERTY_ID,
        applicationId: APPLICATION_ID,
        status: "active",
        leaseStartDate: new Date("2020-03-03T12:00:00.000Z"),
        moveInDate: new Date("2020-03-03T12:00:00.000Z"),
        leaseEndDate: null,
        moveOutDate: null,
        rentDueDay: 3,
        monthlyRent: 0,
        securityDeposit: 0,
        petDeposit: null,
        leaseSetupJson: { parkingDescription: "Old parking" },
        buildiumResidentCenterUrl: null,
        archivedAt: null,
        retentionReviewDueAt: null,
        retentionStatus: null,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contact: {
        id: CONTACT_ID,
        tenancyId: TENANCY_ID,
        firstName: "MEZGHAN",
        lastName: "Alemy",
        email: "",
        phone: null,
        contactType: "tenant",
        portalAccessEnabled: false,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contactUpdates: [],
      tenancyUpdates: [],
      applicationUpdates: [],
    };
    const prisma = createMockPrisma(state);

    const result = await applyTenancyDetailsUpdate(
      prisma as unknown as PrismaClient,
      adminContext(),
      TENANCY_ID,
      parsedInput,
    );

    assert.equal(result.propertyId, PROPERTY_ID);
    assert.equal(state.contactUpdates.length, 1);
    assert.deepEqual(state.contactUpdates[0]?.data, {
      firstName: "Audrey",
      lastName: "Angchangco",
      email: "angchangco.audrey@gmail.com",
      phone: "(604) 379-3398",
      portalAccessEnabled: true,
    });
    assert.equal(state.applicationUpdates.length, 1);
    assert.equal(state.applicationUpdates[0]?.where.id, APPLICATION_ID);
    assert.deepEqual(state.applicationUpdates[0]?.data, {
      firstName: "Audrey",
      lastName: "Angchangco",
      email: "angchangco.audrey@gmail.com",
      phone: "(604) 379-3398",
    });
    assert.equal(state.tenancyUpdates.length, 1);
    const tenancyUpdate = state.tenancyUpdates[0]?.data;
    assert.equal(tenancyUpdate?.status, "active");
    assert.equal(tenancyUpdate?.monthlyRent, 2500);
    assert.equal(tenancyUpdate?.securityDeposit, 1250);
    assert.equal(tenancyUpdate?.rentDueDay, 15);
    assert.deepEqual(tenancyUpdate?.leaseSetupJson, {
      parkingDescription: "Stall 12",
      storageDescription: undefined,
      petDetails: "One cat",
    });
  });

  it("supports legacy tenant with blank email and phone without syncing invalid contact data", async () => {
    const state: MockState = {
      tenancy: {
        id: TENANCY_ID,
        propertyId: PROPERTY_ID,
        applicationId: null,
        status: "active",
        leaseStartDate: new Date("2020-03-03T12:00:00.000Z"),
        moveInDate: new Date("2020-03-03T12:00:00.000Z"),
        leaseEndDate: null,
        moveOutDate: null,
        rentDueDay: 3,
        monthlyRent: 0,
        securityDeposit: 0,
        petDeposit: null,
        leaseSetupJson: null,
        buildiumResidentCenterUrl: null,
        archivedAt: null,
        retentionReviewDueAt: null,
        retentionStatus: null,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contact: {
        id: CONTACT_ID,
        tenancyId: TENANCY_ID,
        firstName: "MEZGHAN",
        lastName: "Alemy",
        email: "",
        phone: null,
        contactType: "tenant",
        portalAccessEnabled: false,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contactUpdates: [],
      tenancyUpdates: [],
      applicationUpdates: [],
    };
    const prisma = createMockPrisma(state);

    await applyTenancyDetailsUpdate(
      prisma as unknown as PrismaClient,
      adminContext(),
      TENANCY_ID,
      {
        ...parsedInput,
        email: "",
        phone: null,
        portalAccessEnabled: false,
        monthlyRent: 0,
        securityDeposit: 0,
        leaseStartDate: "2020-03-03",
        moveInDate: "2020-03-03",
        firstName: "MEZGHAN",
        lastName: "Alemy",
        parkingDescription: "",
        storageDescription: "",
        petDetails: "",
      },
    );

    assert.equal(state.applicationUpdates.length, 0);
    assert.deepEqual(state.contactUpdates[0]?.data, {
      firstName: "MEZGHAN",
      lastName: "Alemy",
      email: "",
      phone: null,
      portalAccessEnabled: false,
    });
  });

  it("rejects contact ids that do not belong to the tenancy", async () => {
    const state: MockState = {
      tenancy: {
        id: TENANCY_ID,
        propertyId: PROPERTY_ID,
        applicationId: null,
        status: "active",
        leaseStartDate: new Date("2020-03-03T12:00:00.000Z"),
        moveInDate: new Date("2020-03-03T12:00:00.000Z"),
        leaseEndDate: null,
        moveOutDate: null,
        rentDueDay: 3,
        monthlyRent: 0,
        securityDeposit: 0,
        petDeposit: null,
        leaseSetupJson: null,
        buildiumResidentCenterUrl: null,
        archivedAt: null,
        retentionReviewDueAt: null,
        retentionStatus: null,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contact: {
        id: CONTACT_ID,
        tenancyId: "other_tenancy",
        firstName: "MEZGHAN",
        lastName: "Alemy",
        email: "",
        phone: null,
        contactType: "tenant",
        portalAccessEnabled: false,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      },
      contactUpdates: [],
      tenancyUpdates: [],
      applicationUpdates: [],
    };
    const prisma = createMockPrisma(state);

    await assert.rejects(
      () =>
        applyTenancyDetailsUpdate(
          prisma as unknown as PrismaClient,
          adminContext(),
          TENANCY_ID,
          parsedInput,
        ),
      /Tenant contact does not belong to this tenancy/,
    );
  });
});
