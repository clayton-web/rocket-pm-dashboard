import { NextResponse } from "next/server";
import { normalizePortalEmail } from "@/lib/portal/maintenance-tenant-status";
import {
  findPortalEligibleContact,
  setTenantSessionCookie,
  verifyPendingOtp,
} from "@/lib/portal/tenant-auth";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";

const VERIFY_LIMIT = { windowMs: 60_000, max: 10 } as const;

/** Verify OTP and set tenant session cookie. */
export async function POST(request: Request) {
  const rateKey = getRequestClientKey(request, "POST:/api/portal/auth/verify");
  const limited = checkRateLimit(rateKey, VERIFY_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const email = typeof o.email === "string" ? normalizePortalEmail(o.email) : "";
    const code = typeof o.code === "string" ? o.code.trim() : "";

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const contactId = verifyPendingOtp(email, code);
    if (!contactId) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    const contact = await findPortalEligibleContact(email);
    if (!contact || contact.id !== contactId) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    await setTenantSessionCookie({
      contactId: contact.id,
      tenancyId: contact.tenancyId,
      organizationId: contact.tenancy.property.organizationId,
      email: normalizePortalEmail(contact.email),
    });

    return NextResponse.json({
      ok: true,
      redirectTo: "/portal/dashboard",
    });
  } catch (e) {
    console.error("[POST /api/portal/auth/verify]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
