import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type GmailOAuthStatePayload = {
  userId: string;
  organizationId: string;
  nonce: string;
  exp: number;
};

function getSigningSecret(): string {
  const secret =
    process.env.GMAIL_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("GMAIL_OAUTH_STATE_SECRET or NEXTAUTH_SECRET is required to sign Gmail OAuth state.");
  }
  return secret;
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function signGmailOAuthState(payload: Omit<GmailOAuthStatePayload, "nonce" | "exp">): string {
  const full: GmailOAuthStatePayload = {
    ...payload,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + 10 * 60 * 1000,
  };

  const body = encodeBase64Url(JSON.stringify(full));
  const sig = createHmac("sha256", getSigningSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGmailOAuthState(token: string): GmailOAuthStatePayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    throw new Error("Malformed OAuth state.");
  }

  const expected = createHmac("sha256", getSigningSecret()).update(body).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid OAuth state signature.");
  }

  const parsed = JSON.parse(decodeBase64Url(body)) as GmailOAuthStatePayload;
  if (typeof parsed.userId !== "string" || typeof parsed.organizationId !== "string") {
    throw new Error("Invalid OAuth state payload.");
  }
  if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
    throw new Error("OAuth state expired.");
  }
  return parsed;
}
