import {
  EmailSendError,
  type EmailProvider,
  type SendEmailInput,
  type SendEmailResult,
} from "@/lib/email/email.types";

export type ResendEmailProviderConfig = {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
};

type ResendApiResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export function createResendEmailProvider(config: ResendEmailProviderConfig): EmailProvider {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    name: "resend",
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      let response: Response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            html: input.html,
          }),
        });
      } catch (error) {
        throw new EmailSendError("Failed to reach Resend API", { cause: error });
      }

      const bodyText = await response.text();
      let body: ResendApiResponse | null = null;
      if (bodyText) {
        try {
          body = JSON.parse(bodyText) as ResendApiResponse;
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        const detail = body?.message ?? (bodyText || response.statusText);
        throw new EmailSendError(`Resend API error (${response.status}): ${detail}`);
      }

      return {
        provider: "resend",
        id: body?.id,
      };
    },
  };
}
