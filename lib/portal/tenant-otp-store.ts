import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { normalizePortalEmail } from "@/lib/portal/maintenance-tenant-status";
import { hashOtpCode, OTP_TTL_MS } from "@/lib/portal/tenant-auth";

type OtpDb = Pick<PrismaClient, "tenantOtpChallenge">;

export async function deleteExpiredTenantOtps(db: OtpDb = prisma): Promise<number> {
  const result = await db.tenantOtpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export async function storePendingOtp(
  email: string,
  contactId: string,
  code: string,
  db: OtpDb = prisma,
): Promise<void> {
  const normalized = normalizePortalEmail(email);
  await deleteExpiredTenantOtps(db);

  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const codeHash = hashOtpCode(normalized, code);

  await db.tenantOtpChallenge.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      contactId,
      codeHash,
      expiresAt,
    },
    update: {
      contactId,
      codeHash,
      expiresAt,
    },
  });
}

export async function verifyPendingOtp(
  email: string,
  code: string,
  db: OtpDb = prisma,
): Promise<string | null> {
  const normalized = normalizePortalEmail(email);
  const pending = await db.tenantOtpChallenge.findUnique({
    where: { email: normalized },
  });

  if (!pending || Date.now() > pending.expiresAt.getTime()) {
    if (pending) {
      await db.tenantOtpChallenge.delete({ where: { email: normalized } }).catch(() => undefined);
    }
    return null;
  }

  const expected = Buffer.from(pending.codeHash, "base64url");
  const actual = Buffer.from(hashOtpCode(normalized, code.trim()), "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  await db.tenantOtpChallenge.delete({ where: { email: normalized } });
  return pending.contactId;
}
