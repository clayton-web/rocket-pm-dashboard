import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createEmailProvider,
  getEmailProviderName,
  isEmailEnabled,
  readEmailServiceConfig,
  resetEmailProviderCache,
  sendEmail,
} from "@/lib/email/email.service";
import { createConsoleEmailProvider } from "@/lib/email/providers/console.provider";
import { createResendEmailProvider } from "@/lib/email/providers/resend.provider";
import { buildLeaseSigningRequestEmail } from "@/lib/email/templates/lease-signing-request";
import { buildTenantOtpEmail } from "@/lib/email/templates/tenant-otp";
import {
  isProductionEmailMisconfigured,
  productionEmailViolationMessages,
} from "@/lib/runtime/email-guards";
import { validateProductionRuntimeConfig } from "@/lib/runtime/production-guards";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
  resetEmailProviderCache();
}

afterEach(() => {
  restoreEnv();
});

describe("email provider selection", () => {
  it("defaults to console in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.EMAIL_PROVIDER;
    assert.equal(getEmailProviderName(), "console");
  });

  it("defaults to resend in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.EMAIL_PROVIDER;
    assert.equal(getEmailProviderName(), "resend");
  });

  it("respects explicit EMAIL_PROVIDER", () => {
    process.env.NODE_ENV = "development";
    process.env.EMAIL_PROVIDER = "resend";
    assert.equal(getEmailProviderName(), "resend");
  });

  it("treats EMAIL_ENABLED=false as disabled", () => {
    process.env.EMAIL_ENABLED = "false";
    assert.equal(isEmailEnabled(), false);
  });
});

describe("console email provider", () => {
  it("logs email payload and returns console provider result", async () => {
    const logs: unknown[] = [];
    const originalInfo = console.info;
    console.info = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      const provider = createConsoleEmailProvider();
      const result = await provider.send({
        to: "tenant@example.com",
        subject: "Test",
        text: "Hello",
      });
      assert.equal(result.provider, "console");
      assert.equal(logs.length, 1);
    } finally {
      console.info = originalInfo;
    }
  });
});

describe("resend email provider", () => {
  it("constructs the Resend API request", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    };

    const provider = createResendEmailProvider({
      apiKey: "re_test_key",
      from: "Rocket PM <noreply@example.com>",
      fetchImpl,
    });

    const result = await provider.send({
      to: "tenant@example.com",
      subject: "Sign in",
      text: "123456",
      html: "<p>123456</p>",
    });

    assert.equal(result.provider, "resend");
    assert.equal(result.id, "email_123");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "https://api.resend.com/emails");
    assert.equal((requests[0]?.init.headers as Record<string, string>).Authorization, "Bearer re_test_key");

    const body = JSON.parse(String(requests[0]?.init.body));
    assert.equal(body.from, "Rocket PM <noreply@example.com>");
    assert.deepEqual(body.to, ["tenant@example.com"]);
    assert.equal(body.subject, "Sign in");
    assert.equal(body.text, "123456");
    assert.equal(body.html, "<p>123456</p>");
  });

  it("throws EmailSendError when Resend responds with an error", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 });

    const provider = createResendEmailProvider({
      apiKey: "bad",
      from: "noreply@example.com",
      fetchImpl,
    });

    await assert.rejects(
      () =>
        provider.send({
          to: "tenant@example.com",
          subject: "Test",
          text: "Hello",
        }),
      /Resend API error \(401\)/,
    );
  });
});

describe("sendEmail", () => {
  it("returns null when email is disabled", async () => {
    process.env.EMAIL_ENABLED = "false";
    const result = await sendEmail({
      to: "tenant@example.com",
      subject: "Test",
      text: "Hello",
    });
    assert.equal(result, null);
  });
});

describe("tenant OTP email template", () => {
  it("includes the code and expiration note", () => {
    const content = buildTenantOtpEmail("654321");
    assert.match(content.subject, /Rocket PM tenant portal/i);
    assert.match(content.text, /654321/);
    assert.match(content.text, /10 minutes/);
    assert.match(content.html, /654321/);
    assert.doesNotMatch(content.text, /tenancy/i);
  });
});

describe("lease signing request email template", () => {
  it("includes tenant name, property reference, signing link, and portal note", () => {
    const content = buildLeaseSigningRequestEmail({
      tenantName: "Alex Tenant",
      propertyName: "Oak Apartments",
      unitLabel: "2B",
      signingUrl: "https://app.example.com/sign/lease/token123",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    });

    assert.match(content.subject, /Sign your Rocket PM lease agreement/i);
    assert.match(content.text, /Alex Tenant/);
    assert.match(content.text, /Oak Apartments, Unit 2B/);
    assert.match(content.text, /https:\/\/app\.example\.com\/sign\/lease\/token123/);
    assert.match(content.text, /do not need to sign in to the tenant portal/i);
    assert.match(content.text, /expires on/i);
  });
});

describe("production email guard", () => {
  it("flags missing production email configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_ENABLED = "false";
    process.env.EMAIL_PROVIDER = "console";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.NEXTAUTH_URL;

    assert.equal(isProductionEmailMisconfigured(), true);
    const messages = productionEmailViolationMessages();
    assert.match(messages.join("\n"), /EMAIL_ENABLED must be "true"/);
    assert.match(messages.join("\n"), /EMAIL_PROVIDER must be "resend"/);
    assert.match(messages.join("\n"), /RESEND_API_KEY is required/);
    assert.match(messages.join("\n"), /EMAIL_FROM is required/);
    assert.match(messages.join("\n"), /APP_PUBLIC_URL/);
  });

  it("flags TENANT_AUTH_DEV_SHOW_CODE in production", () => {
    process.env.NODE_ENV = "production";
    process.env.TENANT_AUTH_DEV_SHOW_CODE = "true";
    process.env.EMAIL_ENABLED = "true";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.APP_PUBLIC_URL = "https://app.example.com";
    process.env.DOCUMENT_STORAGE_BACKEND = "s3";

    assert.throws(
      () => validateProductionRuntimeConfig(),
      /TENANT_AUTH_DEV_SHOW_CODE must not be enabled in production/,
    );
  });

  it("passes when production email configuration is complete", () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_ENABLED = "true";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Rocket PM <noreply@example.com>";
    process.env.APP_PUBLIC_URL = "https://app.example.com";
    process.env.DOCUMENT_STORAGE_BACKEND = "s3";
    process.env.DEV_CREDENTIALS_LOGIN = "false";
    process.env.NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN = "false";

    assert.equal(isProductionEmailMisconfigured(), false);
    assert.doesNotThrow(() => validateProductionRuntimeConfig());
  });
});

describe("createEmailProvider", () => {
  it("requires Resend credentials when provider is resend", () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    assert.throws(() => createEmailProvider(readEmailServiceConfig()), /RESEND_API_KEY is required/);
  });
});
