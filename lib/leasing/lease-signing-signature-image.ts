const SIGNATURE_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/i;

export function parseSignaturePngDataUrl(dataUrl: string): Uint8Array {
  const trimmed = dataUrl.trim();
  const match = SIGNATURE_DATA_URL_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error("Signature must be a PNG image");
  }
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0) {
    throw new Error("Signature image is empty");
  }
  return new Uint8Array(bytes);
}

export function buildSignatureImageStorageKey(args: {
  organizationId: string;
  propertyId: string;
  tenancyId: string;
  signatureRequestId: string;
  signerRole: string;
}): string {
  const safeRole = args.signerRole.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return [
    "org",
    args.organizationId,
    "property",
    args.propertyId,
    "tenancy",
    args.tenancyId,
    "signatures",
    args.signatureRequestId,
    `${safeRole}.png`,
  ].join("/");
}
