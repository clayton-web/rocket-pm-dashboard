import {
  PHOTO_ENHANCER_MAX_BYTES,
  isPhotoEnhancerContentType,
  type PhotoEnhancerContentType,
} from "./image-limits";
import { PhotoEnhancerError } from "./errors";

export type PhotoEnhancerUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bytes?: Uint8Array;
  /** Client preview may skip the post-resize cap so large phone photos can be compressed first. */
  enforceSize?: boolean;
};

export type PhotoEnhancerUploadOk = {
  ok: true;
  contentType: PhotoEnhancerContentType;
};

export type PhotoEnhancerUploadFail = {
  ok: false;
  error: string;
  code: PhotoEnhancerError["code"];
};

const EXTENSION_TYPES: Record<string, PhotoEnhancerContentType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function detectAllowedImageType(bytes: Uint8Array): PhotoEnhancerContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function extensionContentType(fileName: string): PhotoEnhancerContentType | null {
  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  if (!match) return null;
  return EXTENSION_TYPES[match[1]] ?? null;
}

export function validatePhotoEnhancerUpload(
  input: PhotoEnhancerUploadInput,
): PhotoEnhancerUploadOk | PhotoEnhancerUploadFail {
  const fileName = input.fileName.trim();
  if (!fileName) {
    return { ok: false, error: "A photo file is required.", code: "invalid_file" };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "The selected file is empty.", code: "empty_file" };
  }
  if (input.enforceSize !== false && input.sizeBytes > PHOTO_ENHANCER_MAX_BYTES) {
    return {
      ok: false,
      error: "This photo is too large. Use a JPG, PNG, or WebP under 3 MB after resize.",
      code: "file_too_large",
    };
  }

  const claimed = input.contentType.trim().toLowerCase();
  const fromExtension = extensionContentType(fileName);
  const fromBytes = input.bytes ? detectAllowedImageType(input.bytes) : null;

  if (fromBytes) {
    if (claimed && isPhotoEnhancerContentType(claimed) && claimed !== fromBytes) {
      return {
        ok: false,
        error: "The file contents do not match the declared image type.",
        code: "unsupported_type",
      };
    }
    return { ok: true, contentType: fromBytes };
  }

  if (input.bytes) {
    return {
      ok: false,
      error: "File type must be JPG, PNG, or WebP.",
      code: "unsupported_type",
    };
  }

  if (isPhotoEnhancerContentType(claimed)) {
    return { ok: true, contentType: claimed };
  }
  if (fromExtension) {
    return { ok: true, contentType: fromExtension };
  }

  return {
    ok: false,
    error: "File type must be JPG, PNG, or WebP.",
    code: "unsupported_type",
  };
}

export function assertPhotoEnhancerUpload(
  input: PhotoEnhancerUploadInput,
): PhotoEnhancerContentType {
  const result = validatePhotoEnhancerUpload(input);
  if (!result.ok) {
    throw new PhotoEnhancerError(result.code, result.error);
  }
  return result.contentType;
}
