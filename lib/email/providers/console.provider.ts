import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/lib/email/email.types";

export function createConsoleEmailProvider(): EmailProvider {
  return {
    name: "console",
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      console.info("[email:console]", {
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? null,
      });
      return { provider: "console" };
    },
  };
}
