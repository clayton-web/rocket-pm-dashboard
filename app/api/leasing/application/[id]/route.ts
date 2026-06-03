import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { toPublicApplicationPayload } from "@/lib/leasing/public-application";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import { updateDraftApplication } from "@/lib/services/application.service";
import { NotFoundError } from "@/lib/services/errors";
import {
  parsePatchApplicationDraftBody,
  patchBodyToServiceInput,
} from "@/lib/validation/application";

const PUBLIC_APPLICATION_PATCH_LIMIT = { windowMs: 60_000, max: 20 } as const;

function publicApplicationErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
  if (e instanceof Error) {
    if (e.message === "Application is not editable") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e.message === "Email does not match this application") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
  }
  return null;
}

/** Public — update draft application fields (email must match). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rateKey = getRequestClientKey(request, `PATCH:/api/leasing/application/${id}`);
  const limited = checkRateLimit(rateKey, PUBLIC_APPLICATION_PATCH_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const raw: unknown = await request.json();
    const parsed = parsePatchApplicationDraftBody(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const row = await updateDraftApplication(
      prisma,
      id,
      parsed.email,
      patchBodyToServiceInput(parsed),
    );

    return NextResponse.json(toPublicApplicationPayload(row));
  } catch (e) {
    const known = publicApplicationErrorResponse(e);
    if (known) return known;
    console.error("[PATCH /api/leasing/application/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
