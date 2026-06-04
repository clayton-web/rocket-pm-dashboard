import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  getTenantSigningContextByToken,
  LeaseSigningError,
  submitTenantLeaseSignature,
} from "@/lib/leasing/lease-signing.service";
import { NotFoundError } from "@/lib/services/errors";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  try {
    const ctx = await getTenantSigningContextByToken(prisma, token.trim());
    return NextResponse.json(ctx);
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load signing context" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const signerName = typeof raw.signerName === "string" ? raw.signerName : "";
  const signatureDataUrl = typeof raw.signatureDataUrl === "string" ? raw.signatureDataUrl : "";
  const acknowledgedReview = raw.acknowledgedReview === true;

  try {
    await submitTenantLeaseSignature(prisma, token.trim(), {
      signerName,
      signatureDataUrl,
      acknowledgedReview,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof LeaseSigningError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Could not submit signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
