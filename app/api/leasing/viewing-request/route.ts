import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  assertPropertyInPublicPortalOrg,
} from "@/lib/leasing/public-intake";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import {
  submitPublicViewingRequest,
  viewingRequestDateFromIso,
} from "@/lib/services/prospect.service";
import { NotFoundError } from "@/lib/services/errors";
import { parsePostViewingRequestBody } from "@/lib/validation/leasing";

const PUBLIC_VIEWING_POST_LIMIT = { windowMs: 60_000, max: 8 } as const;

/** Public viewing request — creates or updates a Prospect (no Showing/Application). */
export async function POST(request: Request) {
  const rateKey = getRequestClientKey(request, "POST:/api/leasing/viewing-request");
  const limited = checkRateLimit(rateKey, PUBLIC_VIEWING_POST_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const raw: unknown = await request.json();
    const parsed = parsePostViewingRequestBody(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await assertPropertyInPublicPortalOrg(parsed.propertyId);

    const row = await submitPublicViewingRequest(prisma, {
      propertyId: parsed.propertyId,
      unitId: parsed.unitId ?? null,
      rentalListingId: parsed.rentalListingId ?? null,
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone ?? null,
      occupantCount: parsed.occupantCount,
      hasPets: parsed.hasPets,
      petDetails: parsed.petDetails ?? null,
      smokerStatus: parsed.smokerStatus,
      householdIncomeRange: parsed.householdIncomeRange,
      desiredMoveInDate: viewingRequestDateFromIso(parsed.desiredMoveInDate),
      preferredViewingNotes: parsed.preferredViewingNotes ?? null,
      message: parsed.message ?? null,
    });

    return NextResponse.json({ id: row.id });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (
      e instanceof Error &&
      (e.message === "Email is required" ||
        e.message.includes("Rental listing") ||
        e.message.includes("rental listing") ||
        e.message.includes("Unit is required when submitting from a rental listing"))
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[POST /api/leasing/viewing-request]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
