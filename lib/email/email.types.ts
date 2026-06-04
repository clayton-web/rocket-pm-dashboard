export type EmailProviderName = "resend" | "console";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  provider: EmailProviderName;
  id?: string;
};

export type EmailProvider = {
  name: EmailProviderName;
  send(input: SendEmailInput): Promise<SendEmailResult>;
};

export class EmailSendError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "EmailSendError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
