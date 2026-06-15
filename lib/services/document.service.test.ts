import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Document, PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { deleteDocument, updateDocumentMetadata } from "./document.service";

const ctx: StaffContext = {
  userId: "user_1",
  organizationId: "org_1",
  organizationRole: "ADMIN",
  primaryRoleKey: "administrator",
  assignmentRolesByProperty: new Map(),
};

function lockedDocument(): Document {
  return {
    id: "doc_1",
    propertyId: "prop_1",
    unitId: null,
    tenancyId: null,
    applicationId: null,
    documentType: "lease_rtb1_executed",
    title: "Executed lease",
    fileName: "lease.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
    storageKey: "org/org_1/property/prop_1/documents/doc_1-lease.pdf",
    isSigned: true,
    isLocked: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function createMockPrisma(document: Document) {
  return {
    document: {
      findUnique: async () => document,
      update: async () => {
        throw new Error("should not update locked document");
      },
      delete: async () => {
        throw new Error("should not delete locked document");
      },
    },
    property: {
      findFirst: async () => ({ organizationId: "org_1" }),
    },
    organizationMembership: {
      findFirst: async () => ({ role: "ADMIN" }),
    },
    propertyAssignment: {
      findFirst: async () => null,
    },
    activityLog: {
      create: async () => ({}),
    },
  } as unknown as PrismaClient;
}

describe("document.service locked document guards", () => {
  it("blocks metadata updates on locked documents", async () => {
    const prisma = createMockPrisma(lockedDocument());
    await assert.rejects(
      updateDocumentMetadata(prisma, ctx, "doc_1", { title: "New title" }),
      /locked/i,
    );
  });

  it("blocks delete on locked documents", async () => {
    const prisma = createMockPrisma(lockedDocument());
    await assert.rejects(deleteDocument(prisma, ctx, "doc_1"), /locked/i);
  });
});
