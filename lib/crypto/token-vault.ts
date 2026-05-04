import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX_V1 = "v1";
const PREFIX_DEV_PLAIN = "dev-plain:";

function deriveKeyMaterial(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isTokenVaultConfigured(): boolean {
  return Boolean(process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim());
}

export function assertTokenVaultReadyForConnect(): void {
  if (isTokenVaultConfigured()) {
    return;
  }
  if (isProduction()) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is required in production to store Gmail tokens.");
  }
  if (process.env.ALLOW_INSECURE_GMAIL_TOKEN_STORAGE !== "true") {
    throw new Error(
      "Set GMAIL_TOKEN_ENCRYPTION_KEY (recommended) or ALLOW_INSECURE_GMAIL_TOKEN_STORAGE=true for local dev only.",
    );
  }
}

export function encryptSecret(plaintext: string): string {
  if (!isTokenVaultConfigured()) {
    if (isProduction()) {
      throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is required in production.");
    }
    if (process.env.ALLOW_INSECURE_GMAIL_TOKEN_STORAGE === "true") {
      return `${PREFIX_DEV_PLAIN}${Buffer.from(plaintext, "utf8").toString("base64url")}`;
    }
    throw new Error("Missing GMAIL_TOKEN_ENCRYPTION_KEY.");
  }

  const key = deriveKeyMaterial(process.env.GMAIL_TOKEN_ENCRYPTION_KEY!);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX_V1}:${iv.toString("base64url")}:${authTag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  if (payload.startsWith(PREFIX_DEV_PLAIN)) {
    if (isProduction()) {
      throw new Error("Refusing to read insecure dev token storage in production.");
    }
    const b64 = payload.slice(PREFIX_DEV_PLAIN.length);
    return Buffer.from(b64, "base64url").toString("utf8");
  }

  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== PREFIX_V1 || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized ciphertext format.");
  }

  const key = deriveKeyMaterial(process.env.GMAIL_TOKEN_ENCRYPTION_KEY!);
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
