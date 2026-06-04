/** Production boot checks for document storage — env only (no fs/S3 imports). */

export function isProductionDocumentStorageMisconfigured(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }
  const backend = process.env.DOCUMENT_STORAGE_BACKEND?.trim().toLowerCase();
  return !backend || backend === "local";
}

export function productionDocumentStorageViolationMessage(): string {
  return (
    "DOCUMENT_STORAGE_BACKEND must be set to \"s3\" in production. " +
    "Local filesystem storage (.data/documents) is development-only and does not persist " +
    "executed RTB-1 leases across deploys or instances. Configure S3-compatible object storage " +
    "(AWS S3 or Cloudflare R2) before onboarding real tenants."
  );
}
