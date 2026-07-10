import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  assertPropertyInPublicPortalOrg,
  assertUnitInPublicPortalProperty,
} from "@/lib/leasing/public-intake";
import { toPublicApplicationPayload } from "@/lib/leasing/public-application";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import { startPublicApplication } from "@/lib/services/application.service";
import { NotFoundError } from "@/lib/services/errors";
import { parsePostStartApplicationBody } from "@/lib/validation/application";

const PUBLIC_APPLICATION_POST_LIMIT = { windowMs: 60_000, max: 8 } as const;

/** Public — start a draft rental application. */
export async function POST(request: Request) {
  const rateKey = getRequestClientKey(request, "POST:/api/leasing/application");
  const limited = checkRateLimit(rateKey, PUBLIC_APPLICATION_POST_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const raw: unknown = await request.json();
    const parsed = parsePostStartApplicationBody(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await assertPropertyInPublicPortalOrg(parsed.propertyId);
    await assertUnitInPublicPortalProperty(parsed.propertyId, parsed.unitId);

    const row = await startPublicApplication(prisma, {
      propertyId: parsed.propertyId,
      unitId: parsed.unitId,
      email: parsed.email,
      prospectId: parsed.prospectId ?? null,
      rentalListingId: parsed.rentalListingId ?? null,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      phone: parsed.phone ?? null,
    });

    return NextResponse.json(toPublicApplicationPayload(row));
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Prospect not found") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Email is required") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[POST /api/leasing/application]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
