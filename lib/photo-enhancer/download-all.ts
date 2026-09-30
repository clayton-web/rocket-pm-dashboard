import { zipSync } from "fflate";
import { revokeObjectUrl } from "./preview-urls";

export const ENHANCED_PHOTOS_ZIP_NAME = "enhanced-photos.zip";

export type EnhancedZipPhotoStatus = "waiting" | "enhancing" | "complete" | "failed";

export type EnhancedZipPhoto = {
  status: EnhancedZipPhotoStatus;
  downloadName: string;
  pngBytes: Uint8Array | null;
};

export type EnhancedZipFile = {
  name: string;
  data: Uint8Array;
};

export type EnhancedPhotosZip = {
  fileName: string;
  bytes: Uint8Array;
  entryNames: string[];
};

function isCompletedEnhancedPhoto(photo: EnhancedZipPhoto): photo is EnhancedZipPhoto & {
  pngBytes: Uint8Array;
} {
  return photo.status === "complete" && photo.pngBytes !== null && photo.pngBytes.byteLength > 0;
}

export function canDownloadAllEnhancedPhotos(photos: readonly EnhancedZipPhoto[]): boolean {
  return photos.some((photo) => isCompletedEnhancedPhoto(photo));
}

/** Keep the individual enhanced filename, then add -2, -3, … if that name is already used. */
export function uniqueEnhancedZipName(downloadName: string, used: Set<string>): string {
  const base = downloadName.trim() || "photo-enhanced.png";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  let candidate = `${stem}-${index}${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${extension}`;
  }
  used.add(candidate);
  return candidate;
}

export function collectEnhancedZipFiles(photos: readonly EnhancedZipPhoto[]): EnhancedZipFile[] {
  const used = new Set<string>();
  const files: EnhancedZipFile[] = [];
  for (const photo of photos) {
    if (!isCompletedEnhancedPhoto(photo)) continue;
    files.push({
      name: uniqueEnhancedZipName(photo.downloadName, used),
      data: photo.pngBytes,
    });
  }
  return files;
}

export function buildEnhancedPhotosZip(files: readonly EnhancedZipFile[]): Uint8Array {
  const archive: Record<string, Uint8Array> = {};
  for (const file of files) {
    archive[file.name] = file.data;
  }
  return zipSync(archive, { level: 0 });
}

export function createEnhancedPhotosZip(photos: readonly EnhancedZipPhoto[]): EnhancedPhotosZip | null {
  const files = collectEnhancedZipFiles(photos);
  if (files.length === 0) return null;
  return {
    fileName: ENHANCED_PHOTOS_ZIP_NAME,
    bytes: buildEnhancedPhotosZip(files),
    entryNames: files.map((file) => file.name),
  };
}

export type ZipDownloadEnvironment = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  save: (url: string, fileName: string) => void;
};

export function downloadEnhancedPhotosZip(
  zipBytes: Uint8Array,
  env: ZipDownloadEnvironment,
  fileName = ENHANCED_PHOTOS_ZIP_NAME,
): void {
  const copy = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(copy).set(zipBytes);
  const blob = new Blob([copy], { type: "application/zip" });
  const url = env.createObjectURL(blob);
  try {
    env.save(url, fileName);
  } finally {
    env.revokeObjectURL(url);
  }
}

export function browserZipDownloadEnvironment(): ZipDownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => revokeObjectUrl(url),
    save: (url, fileName) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = "noopener";
      anchor.click();
    },
  };
}
