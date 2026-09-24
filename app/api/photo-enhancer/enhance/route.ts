import { NextResponse } from "next/server";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { PhotoEnhancerError, photoEnhancerErrorJson } from "@/lib/photo-enhancer/errors";
import { enhanceRealEstatePhoto } from "@/lib/photo-enhancer/openai-client";
import { enhancedDownloadFileName } from "@/lib/photo-enhancer/prepare-upload";
import { assertPhotoEnhancerUpload } from "@/lib/photo-enhancer/validate-upload";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = "private, no-store";

function errorResponse(error: PhotoEnhancerError, retryAfterSec?: number): NextResponse {
  const headers: Record<string, string> = { "Cache-Control": NO_STORE };
  if (retryAfterSec) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  return NextResponse.json(photoEnhancerErrorJson(error), {
    status: error.status,
    headers,
  });
}

export async function POST(request: Request) {
  try {
    const ctx = await requireStaffContextFromSession();
    const limited = checkRateLimit(`photo-enhancer:${ctx.userId}`, {
      windowMs: 5 * 60_000,
      max: 8,
    });
    if (!limited.ok) {
      return errorResponse(
        new PhotoEnhancerError(
          "rate_limited",
          "Too many enhancement requests. Wait a moment and try again.",
        ),
        limited.retryAfterSec,
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new PhotoEnhancerError("invalid_file", "A photo file is required.");
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      throw new PhotoEnhancerError("invalid_file", "A photo file is required.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = assertPhotoEnhancerUpload({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      bytes,
    });

    const pngBytes = await enhanceRealEstatePhoto({
      bytes,
      fileName: file.name,
      contentType,
    });

    return new NextResponse(Buffer.from(pngBytes), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${enhancedDownloadFileName(file.name)}"`,
        "Cache-Control": NO_STORE,
      },
    });
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return errorResponse(new PhotoEnhancerError(error.code, error.message));
    }
    if (error instanceof PhotoEnhancerError) {
      return errorResponse(error);
    }
    return errorResponse(
      new PhotoEnhancerError("openai_failed", "The enhancement request failed. Try again."),
    );
  }
}
