export type PhotoPreviewUrls = {
  originalUrl?: string | null;
  enhancedUrl?: string | null;
};

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url);
}

export function revokePhotoPreviewUrls(urls: PhotoPreviewUrls): void {
  revokeObjectUrl(urls.originalUrl);
  revokeObjectUrl(urls.enhancedUrl);
}

export function revokePhotoPreviewUrlList(items: readonly PhotoPreviewUrls[]): void {
  for (const item of items) {
    revokePhotoPreviewUrls(item);
  }
}
