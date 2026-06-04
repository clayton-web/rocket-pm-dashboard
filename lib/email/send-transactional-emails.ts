import { buildAppPublicUrl } from "@/lib/email/app-public-url";
import { sendEmail } from "@/lib/email/email.service";
import { EmailSendError } from "@/lib/email/email.types";
import { buildLeaseSigningRequestEmail } from "@/lib/email/templates/lease-signing-request";
import { buildTenantOtpEmail } from "@/lib/email/templates/tenant-otp";

export async function sendTenantPortalOtpEmail(email: string, code: string): Promise<void> {
  const content = buildTenantOtpEmail(code);
  try {
    await sendEmail({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch (error) {
    throw new EmailSendError("Could not send tenant portal sign-in code email", { cause: error });
  }
}

export async function sendLeaseSigningRequestEmail(input: {
  to: string;
  tenantName: string;
  propertyName?: string | null;
  unitLabel?: string | null;
  signingPath: string;
  expiresAt?: Date | null;
}): Promise<void> {
  const signingUrl = buildAppPublicUrl(input.signingPath);
  const content = buildLeaseSigningRequestEmail({
    tenantName: input.tenantName,
    propertyName: input.propertyName,
    unitLabel: input.unitLabel,
    signingUrl,
    expiresAt: input.expiresAt,
  });

  try {
    await sendEmail({
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch (error) {
    throw new EmailSendError("Could not send lease signing request email", { cause: error });
  }
}
