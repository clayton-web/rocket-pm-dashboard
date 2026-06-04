import { OTP_TTL_MS } from "@/lib/portal/tenant-auth";

export type TenantOtpEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function formatOtpExpirationMinutes(): number {
  return Math.round(OTP_TTL_MS / 60_000);
}

export function buildTenantOtpEmail(code: string): TenantOtpEmailContent {
  const expiresMinutes = formatOtpExpirationMinutes();
  const subject = "Your Rocket PM tenant portal sign-in code";

  const text = [
    "Use this one-time code to sign in to the Rocket PM tenant portal:",
    "",
    code,
    "",
    `This code expires in ${expiresMinutes} minutes.`,
    "",
    "If you did not request this code, you can ignore this email.",
  ].join("\n");

  const html = [
    "<p>Use this one-time code to sign in to the Rocket PM tenant portal:</p>",
    `<p style="font-size:24px;font-weight:700;letter-spacing:0.15em;">${code}</p>`,
    `<p>This code expires in ${expiresMinutes} minutes.</p>`,
    "<p>If you did not request this code, you can ignore this email.</p>",
  ].join("\n");

  return { subject, text, html };
}
