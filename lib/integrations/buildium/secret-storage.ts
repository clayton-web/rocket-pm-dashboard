import { assertTokenVaultReadyForConnect, decryptSecret, encryptSecret } from "@/lib/crypto/token-vault";

/** Buildium API secrets use the same AES-256-GCM vault as Gmail (see docs/buildium-integration-plan.md). */
export function assertBuildiumVaultReady(): void {
  assertTokenVaultReadyForConnect();
}

export function encryptBuildiumSecret(plaintext: string): string {
  return encryptSecret(plaintext);
}

export function decryptBuildiumSecret(payload: string): string {
  return decryptSecret(payload);
}
