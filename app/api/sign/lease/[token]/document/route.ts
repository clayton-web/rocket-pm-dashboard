import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { LeaseSigningError, readLeaseDraftPdfByToken } from "@/lib/leasing/lease-signing.service";
import { NotFoundError } from "@/lib/services/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const { bytes, fileName, contentType } = await readLeaseDraftPdfByToken(prisma, token.trim());
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof LeaseSigningError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message.includes("ENOENT")) {
      return NextResponse.json({ error: "Document file not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not download document" }, { status: 500 });
  }
}
