export function buildTenancyDocumentStorageKey(args: {
  organizationId: string;
  propertyId: string;
  tenancyId: string;
  documentId: string;
  fileName: string;
}): string {
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return [
    "org",
    args.organizationId,
    "property",
    args.propertyId,
    "tenancy",
    args.tenancyId,
    `${args.documentId}-${safeName}`,
  ].join("/");
}

export function buildPropertyDocumentStorageKey(args: {
  organizationId: string;
  propertyId: string;
  documentId: string;
  fileName: string;
}): string {
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return [
    "org",
    args.organizationId,
    "property",
    args.propertyId,
    "documents",
    `${args.documentId}-${safeName}`,
  ].join("/");
}

/** Normalize storage keys for safe local paths and S3 object keys. */
export function normalizeDocumentStorageKey(storageKey: string): string {
  return storageKey.replace(/^\/+/, "").replace(/\.\./g, "");
}
