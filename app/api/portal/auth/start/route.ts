import { NextResponse } from "next/server";
import { normalizePortalEmail } from "@/lib/portal/maintenance-tenant-status";
import {
  findPortalEligibleContact,
  generateOtpCode,
  shouldExposeTenantAuthDevCode,
} from "@/lib/portal/tenant-auth";
import { storePendingOtp } from "@/lib/portal/tenant-otp-store";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";

const START_LIMIT = { windowMs: 60_000, max: 5 } as const;

const GENERIC_OK = {
  ok: true,
  message: "If this email has portal access, a one-time sign-in code has been issued.",
} as const;

/** Start tenant sign-in — issues OTP (email delivery deferred; dev may return code). */
export async function POST(request: Request) {
  const rateKey = getRequestClientKey(request, "POST:/api/portal/auth/start");
  const limited = checkRateLimit(rateKey, START_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const emailRaw = (body as Record<string, unknown>).email;
    const email = typeof emailRaw === "string" ? normalizePortalEmail(emailRaw) : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const contact = await findPortalEligibleContact(email);
    if (!contact) {
      return NextResponse.json(GENERIC_OK);
    }

    const code = generateOtpCode();
    await storePendingOtp(email, contact.id, code);

    const response: Record<string, unknown> = { ...GENERIC_OK };
    if (shouldExposeTenantAuthDevCode()) {
      response.devCode = code;
      response.devNote =
        "Email delivery is not wired yet. Use this code on the login page (dev/staging only).";
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[POST /api/portal/auth/start]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
