import { NextResponse } from "next/server";
import { getTenantDocumentForSession } from "@/lib/portal/tenant-documents";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { getDocumentStorage } from "@/lib/storage/document-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const session = await getVerifiedTenantSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { documentId } = await context.params;

  try {
    const document = await getTenantDocumentForSession(session, documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const bytes = await getDocumentStorage().readDocument(document.storageKey);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.contentType ?? "application/pdf",
        "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("ENOENT")) {
      return NextResponse.json({ error: "Document file not found in storage" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not download document" }, { status: 500 });
  }
}
