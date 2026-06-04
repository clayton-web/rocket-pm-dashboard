import { isProductionRuntime } from "@/lib/runtime/production-guards";
import type { EmailProvider, EmailProviderName, SendEmailInput, SendEmailResult } from "@/lib/email/email.types";
import { createConsoleEmailProvider } from "@/lib/email/providers/console.provider";
import { createResendEmailProvider } from "@/lib/email/providers/resend.provider";

export type EmailServiceConfig = {
  enabled: boolean;
  provider: EmailProviderName;
  from: string;
  resendApiKey?: string;
};

let cachedProvider: EmailProvider | null = null;

export function resetEmailProviderCache(): void {
  cachedProvider = null;
}

export function isEmailEnabled(): boolean {
  const raw = process.env.EMAIL_ENABLED?.trim().toLowerCase();
  if (raw === "false") return false;
  if (raw === "true") return true;
  return true;
}

export function getEmailProviderName(): EmailProviderName {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "resend" || configured === "console") {
    return configured;
  }
  return isProductionRuntime() ? "resend" : "console";
}

export function readEmailServiceConfig(): EmailServiceConfig {
  const enabled = isEmailEnabled();
  const provider = getEmailProviderName();
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  return {
    enabled,
    provider,
    from,
    resendApiKey,
  };
}

export function createEmailProvider(config: EmailServiceConfig = readEmailServiceConfig()): EmailProvider {
  if (!config.enabled) {
    return createConsoleEmailProvider();
  }

  if (config.provider === "console") {
    return createConsoleEmailProvider();
  }

  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
  }
  if (!config.from) {
    throw new Error("EMAIL_FROM is required when EMAIL_PROVIDER=resend");
  }

  return createResendEmailProvider({
    apiKey: config.resendApiKey,
    from: config.from,
  });
}

export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) {
    cachedProvider = createEmailProvider();
  }
  return cachedProvider;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult | null> {
  const config = readEmailServiceConfig();
  if (!config.enabled) {
    return null;
  }

  const provider = getEmailProvider();
  return provider.send(input);
}
