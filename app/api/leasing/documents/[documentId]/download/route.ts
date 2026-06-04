import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { getDocumentById } from "@/lib/services/document.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { readLocalDocument } from "@/lib/storage/local-document-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;

  try {
    const ctx = await requireStaffContextFromSession();
    const document = await getDocumentById(prisma, ctx, documentId.trim());

    const bytes = await readLocalDocument(document.storageKey);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.contentType ?? "application/pdf",
        "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.code === "unauthenticated" ? 401 : 403 });
    }
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof Error && e.message.includes("ENOENT")) {
      return NextResponse.json({ error: "Document file not found in storage" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not download document" }, { status: 500 });
  }
}
