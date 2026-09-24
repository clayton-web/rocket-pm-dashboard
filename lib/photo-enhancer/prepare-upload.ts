import {
  PHOTO_ENHANCER_MAX_BYTES,
  photoNeedsClientCompression,
  targetPhotoDimensions,
} from "./image-limits";
import { validatePhotoEnhancerUpload } from "./validate-upload";

function replaceExtension(fileName: string, extension: string): string {
  const trimmed = fileName.trim() || "photo";
  const withoutExt = trimmed.replace(/\.[^.]+$/, "");
  return `${withoutExt || "photo"}${extension}`;
}

export function enhancedDownloadFileName(originalName: string): string {
  const base = originalName.trim().replace(/\.[^.]+$/, "") || "photo";
  const safe = base.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
  return `${safe}-enhanced.png`;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) {
    throw new Error("Could not compress this photo in the browser.");
  }
  return blob;
}

/**
 * Downscale/compress in the browser when the original would exceed the server cap.
 * Preserves aspect ratio. Does not crop.
 */
export async function preparePhotoForUpload(file: File): Promise<File> {
  const previewCheck = validatePhotoEnhancerUpload({
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (!previewCheck.ok && previewCheck.code !== "file_too_large") {
    throw new Error(previewCheck.error);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read this image. Use a JPG, PNG, or WebP.");
  }

  const { width, height } = targetPhotoDimensions(bitmap.width, bitmap.height);
  const needsCompression = photoNeedsClientCompression(file.size, bitmap.width, bitmap.height);

  if (!needsCompression) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare this photo for upload.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.88;
  let blob = await canvasToJpeg(canvas, quality);
  while (blob.size > PHOTO_ENHANCER_MAX_BYTES && quality > 0.6) {
    quality -= 0.08;
    blob = await canvasToJpeg(canvas, quality);
  }

  if (blob.size > PHOTO_ENHANCER_MAX_BYTES) {
    throw new Error("This photo is still too large after compression. Try a smaller image.");
  }

  return new File([blob], replaceExtension(file.name, ".jpg"), { type: "image/jpeg" });
}
