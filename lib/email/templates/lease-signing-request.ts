import { LEASE_SIGNING_TOKEN_TTL_MS } from "@/lib/leasing/lease-signing-token";

export type LeaseSigningRequestEmailInput = {
  tenantName: string;
  propertyName?: string | null;
  unitLabel?: string | null;
  signingUrl: string;
  expiresAt?: Date | null;
};

export type LeaseSigningRequestEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function formatPropertyUnitReference(
  propertyName?: string | null,
  unitLabel?: string | null,
): string | null {
  const property = propertyName?.trim();
  const unit = unitLabel?.trim();
  if (property && unit) return `${property}, Unit ${unit}`;
  if (property) return property;
  if (unit) return `Unit ${unit}`;
  return null;
}

function formatExpirationNote(expiresAt?: Date | null): string {
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    const formatted = expiresAt.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `This signing link expires on ${formatted}.`;
  }

  const days = Math.round(LEASE_SIGNING_TOKEN_TTL_MS / (24 * 60 * 60 * 1000));
  return `This signing link expires in about ${days} days.`;
}

export function buildLeaseSigningRequestEmail(
  input: LeaseSigningRequestEmailInput,
): LeaseSigningRequestEmailContent {
  const location = formatPropertyUnitReference(input.propertyName, input.unitLabel);
  const expirationNote = formatExpirationNote(input.expiresAt);
  const subject = "Sign your Rocket PM lease agreement";

  const textLines = [
    `Hello ${input.tenantName},`,
    "",
    "Please review and sign your lease agreement using the secure link below.",
  ];

  if (location) {
    textLines.push("", `Property: ${location}`);
  }

  textLines.push(
    "",
    input.signingUrl,
    "",
    "You do not need to sign in to the tenant portal to complete this signature.",
    expirationNote,
    "",
    "If you were not expecting this email, contact your property manager.",
  );

  const htmlParts = [
    `<p>Hello ${input.tenantName},</p>`,
    "<p>Please review and sign your lease agreement using the secure link below.</p>",
  ];

  if (location) {
    htmlParts.push(`<p><strong>Property:</strong> ${location}</p>`);
  }

  htmlParts.push(
    `<p><a href="${input.signingUrl}">Open secure signing link</a></p>`,
    "<p>You do not need to sign in to the tenant portal to complete this signature.</p>",
    `<p>${expirationNote}</p>`,
    "<p>If you were not expecting this email, contact your property manager.</p>",
  );

  return {
    subject,
    text: textLines.join("\n"),
    html: htmlParts.join("\n"),
  };
}
