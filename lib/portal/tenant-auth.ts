import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { normalizePortalEmail } from "@/lib/portal/maintenance-tenant-status";
import { getPublicPortalOrgSlug } from "@/lib/portal/public-org";

export const TENANT_SESSION_COOKIE = "rocket_pm_tenant_session";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const OTP_TTL_MS = 10 * 60 * 1000;

export type TenantSessionPayload = {
  contactId: string;
  tenancyId: string;
  organizationId: string;
  email: string;
  exp: number;
};

type PendingOtp = {
  contactId: string;
  codeHash: string;
  expiresAt: number;
};

const pendingOtpByEmail = new Map<string, PendingOtp>();

function getSigningSecret(): string {
  const secret =
    process.env.TENANT_PORTAL_SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("TENANT_PORTAL_SESSION_SECRET or NEXTAUTH_SECRET is required for tenant portal sessions.");
  }
  return secret;
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function hashOtpCode(email: string, code: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${email}:${code}`).digest("base64url");
}

export function shouldExposeTenantAuthDevCode(): boolean {
  if (process.env.TENANT_AUTH_DEV_SHOW_CODE === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/**
 * Active tenancy contact with portal access in the public portal org.
 * Returns null when no match (caller should use a generic response).
 */
export async function findPortalEligibleContact(normalizedEmail: string) {
  const orgSlug = getPublicPortalOrgSlug();

  return prisma.tenancyContact.findFirst({
    where: {
      email: normalizedEmail,
      portalAccessEnabled: true,
      tenancy: {
        status: "active",
        property: {
          organization: { slug: orgSlug },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      tenancyId: true,
      tenancy: {
        select: {
          property: { select: { organizationId: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function storePendingOtp(email: string, contactId: string, code: string): void {
  const normalized = normalizePortalEmail(email);
  pendingOtpByEmail.set(normalized, {
    contactId,
    codeHash: hashOtpCode(normalized, code),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function verifyPendingOtp(email: string, code: string): string | null {
  const normalized = normalizePortalEmail(email);
  const pending = pendingOtpByEmail.get(normalized);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingOtpByEmail.delete(normalized);
    return null;
  }

  const expected = Buffer.from(pending.codeHash, "base64url");
  const actual = Buffer.from(hashOtpCode(normalized, code.trim()), "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  pendingOtpByEmail.delete(normalized);
  return pending.contactId;
}

export function signTenantSession(payload: Omit<TenantSessionPayload, "exp">): string {
  const full: TenantSessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = encodeBase64Url(JSON.stringify(full));
  const sig = createHmac("sha256", getSigningSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyTenantSessionToken(token: string): TenantSessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSigningSecret()).update(body).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as TenantSessionPayload;
    if (
      !payload.contactId ||
      !payload.tenancyId ||
      !payload.organizationId ||
      !payload.email ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getTenantSession(): Promise<TenantSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(TENANT_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyTenantSessionToken(token);
}

export async function setTenantSessionCookie(payload: Omit<TenantSessionPayload, "exp">): Promise<void> {
  const jar = await cookies();
  jar.set(TENANT_SESSION_COOKIE, signTenantSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearTenantSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(TENANT_SESSION_COOKIE);
}

/** Re-load contact and confirm portal access still valid for the signed session. */
export async function getVerifiedTenantSession(): Promise<
  (TenantSessionPayload & { firstName: string; lastName: string }) | null
> {
  const session = await getTenantSession();
  if (!session) return null;

  const contact = await findPortalEligibleContact(normalizePortalEmail(session.email));
  if (!contact || contact.id !== session.contactId) {
    await clearTenantSessionCookie();
    return null;
  }

  return {
    ...session,
    firstName: contact.firstName,
    lastName: contact.lastName,
  };
}
