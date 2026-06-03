import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  assertPropertyInPublicPortalOrg,
  assertUnitInPublicPortalProperty,
} from "@/lib/leasing/public-intake";
import { lookupProspectPrefillForApplication } from "@/lib/services/prospect-prefill.service";
import { NotFoundError } from "@/lib/services/errors";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import { parseProspectPrefillQuery } from "@/lib/validation/prospect-prefill";

const PUBLIC_PROSPECT_PREFILL_LIMIT = { windowMs: 60_000, max: 12 } as const;

/** Public — safe Prospect prefill for rental application (Prospect rows only). */
export async function GET(request: Request) {
  const rateKey = getRequestClientKey(request, "GET:/api/leasing/prospect-prefill");
  const limited = checkRateLimit(rateKey, PUBLIC_PROSPECT_PREFILL_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const parsed = parseProspectPrefillQuery(new URL(request.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await assertPropertyInPublicPortalOrg(parsed.propertyId);
    await assertUnitInPublicPortalProperty(parsed.propertyId, parsed.unitId);

    const result = await lookupProspectPrefillForApplication(prisma, parsed);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[GET /api/leasing/prospect-prefill]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
