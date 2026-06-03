import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  getRequestClientMeta,
  toPublicApplicationPayload,
} from "@/lib/leasing/public-application";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import { submitApplication } from "@/lib/services/application.service";
import { NotFoundError } from "@/lib/services/errors";
import { parsePostSubmitApplicationBody } from "@/lib/validation/application";

const PUBLIC_APPLICATION_SUBMIT_LIMIT = { windowMs: 60_000, max: 8 } as const;

function publicApplicationErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
  if (e instanceof Error) {
    if (
      e.message === "Application is not editable" ||
      e.message.startsWith("Missing required fields:") ||
      e.message === "Credit check consent is required" ||
      e.message === "Consent signature name is required"
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e.message === "Email does not match this application") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
  }
  return null;
}

/** Public — submit draft application (email must match). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rateKey = getRequestClientKey(request, `POST:/api/leasing/application/${id}/submit`);
  const limited = checkRateLimit(rateKey, PUBLIC_APPLICATION_SUBMIT_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const raw: unknown = await request.json();
    const parsed = parsePostSubmitApplicationBody(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { ipAddress, userAgent } = getRequestClientMeta(request);

    const row = await submitApplication(prisma, id, parsed.email, {
      consentCreditCheck: parsed.consentCreditCheck,
      consentSignatureName: parsed.consentSignatureName,
      consentIpAddress: ipAddress,
      consentUserAgent: userAgent,
    });

    return NextResponse.json(toPublicApplicationPayload(row));
  } catch (e) {
    const known = publicApplicationErrorResponse(e);
    if (known) return known;
    console.error("[POST /api/leasing/application/[id]/submit]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
