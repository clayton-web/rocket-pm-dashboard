/** Post-resize server/body cap. Stays under Vercel’s ~4.5 MB function request limit. */
export const PHOTO_ENHANCER_MAX_BYTES = 3 * 1024 * 1024;

/** Longest edge after browser resize. Preserves aspect ratio; does not crop. */
export const PHOTO_ENHANCER_MAX_LONG_EDGE = 2048;

export const PHOTO_ENHANCER_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoEnhancerContentType = (typeof PHOTO_ENHANCER_ALLOWED_CONTENT_TYPES)[number];

export const PHOTO_ENHANCER_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function isPhotoEnhancerContentType(value: string): value is PhotoEnhancerContentType {
  return (PHOTO_ENHANCER_ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

export function targetPhotoDimensions(
  width: number,
  height: number,
  maxLongEdge = PHOTO_ENHANCER_MAX_LONG_EDGE,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function photoNeedsClientCompression(
  sizeBytes: number,
  width: number,
  height: number,
): boolean {
  if (sizeBytes > PHOTO_ENHANCER_MAX_BYTES) return true;
  return Math.max(width, height) > PHOTO_ENHANCER_MAX_LONG_EDGE;
}
