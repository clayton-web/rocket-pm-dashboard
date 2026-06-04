import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { PrismaClient, TenantOtpChallenge } from "@prisma/client";
import { hashOtpCode } from "@/lib/portal/tenant-auth";
import {
  deleteExpiredTenantOtps,
  storePendingOtp,
  verifyPendingOtp,
} from "@/lib/portal/tenant-otp-store";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

type OtpRow = TenantOtpChallenge;

function createInMemoryOtpDb() {
  const rows = new Map<string, OtpRow>();

  const db = {
    tenantOtpChallenge: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { email: string };
        create: Omit<OtpRow, "id" | "createdAt"> & { createdAt?: Date };
        update: Partial<Omit<OtpRow, "id" | "email" | "createdAt">>;
      }) => {
        const existing = rows.get(where.email);
        if (existing) {
          const next: OtpRow = {
            ...existing,
            ...update,
          };
          rows.set(where.email, next);
          return next;
        }
        const row: OtpRow = {
          id: `otp-${rows.size + 1}`,
          createdAt: create.createdAt ?? new Date(),
          email: create.email,
          contactId: create.contactId,
          codeHash: create.codeHash,
          expiresAt: create.expiresAt,
        };
        rows.set(where.email, row);
        return row;
      },
      findUnique: async ({ where }: { where: { email: string } }) => rows.get(where.email) ?? null,
      delete: async ({ where }: { where: { email: string } }) => {
        rows.delete(where.email);
      },
      deleteMany: async ({ where }: { where: { expiresAt: { lt: Date } } }) => {
        let count = 0;
        for (const [email, row] of rows.entries()) {
          if (row.expiresAt.getTime() < where.expiresAt.lt.getTime()) {
            rows.delete(email);
            count += 1;
          }
        }
        return { count };
      },
    },
  };

  return { db: db as unknown as Pick<PrismaClient, "tenantOtpChallenge">, rows };
}

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-tenant-otp-secret";
});

afterEach(() => {
  restoreEnv();
});

describe("storePendingOtp", () => {
  it("stores a hashed OTP for normalized lowercase email", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("Tenant@Example.com", "contact-1", "123456", db);

    const row = rows.get("tenant@example.com");
    assert.ok(row);
    assert.equal(row.contactId, "contact-1");
    assert.equal(row.codeHash, hashOtpCode("tenant@example.com", "123456"));
    assert.notEqual(row.codeHash, "123456");
  });

  it("replaces the previous OTP for the same email", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("tenant@example.com", "contact-1", "111111", db);
    await storePendingOtp("TENANT@example.com", "contact-1", "222222", db);

    assert.equal(rows.size, 1);
    const row = rows.get("tenant@example.com");
    assert.equal(row?.codeHash, hashOtpCode("tenant@example.com", "222222"));
  });
});

describe("verifyPendingOtp", () => {
  it("returns contactId for a valid code and deletes the challenge", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("tenant@example.com", "contact-42", "654321", db);

    const contactId = await verifyPendingOtp("tenant@example.com", "654321", db);
    assert.equal(contactId, "contact-42");
    assert.equal(rows.has("tenant@example.com"), false);
  });

  it("rejects an incorrect code without deleting the challenge", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("tenant@example.com", "contact-42", "654321", db);

    const contactId = await verifyPendingOtp("tenant@example.com", "000000", db);
    assert.equal(contactId, null);
    assert.equal(rows.has("tenant@example.com"), true);
  });

  it("rejects expired codes and deletes the challenge", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("tenant@example.com", "contact-42", "654321", db);
    const row = rows.get("tenant@example.com");
    assert.ok(row);
    row.expiresAt = new Date(Date.now() - 60_000);

    const contactId = await verifyPendingOtp("tenant@example.com", "654321", db);
    assert.equal(contactId, null);
    assert.equal(rows.has("tenant@example.com"), false);
  });
});

describe("deleteExpiredTenantOtps", () => {
  it("removes expired rows and returns the count", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("fresh@example.com", "contact-1", "111111", db);
    await storePendingOtp("stale@example.com", "contact-2", "222222", db);
    const stale = rows.get("stale@example.com");
    assert.ok(stale);
    stale.expiresAt = new Date(Date.now() - 60_000);

    const deleted = await deleteExpiredTenantOtps(db);
    assert.equal(deleted, 1);
    assert.equal(rows.has("fresh@example.com"), true);
    assert.equal(rows.has("stale@example.com"), false);
  });

  it("runs opportunistically when storing a new OTP", async () => {
    const { db, rows } = createInMemoryOtpDb();
    await storePendingOtp("stale@example.com", "contact-2", "222222", db);
    const stale = rows.get("stale@example.com");
    assert.ok(stale);
    stale.expiresAt = new Date(Date.now() - 60_000);

    await storePendingOtp("fresh@example.com", "contact-1", "111111", db);

    assert.equal(rows.has("stale@example.com"), false);
    assert.equal(rows.has("fresh@example.com"), true);
  });
});
