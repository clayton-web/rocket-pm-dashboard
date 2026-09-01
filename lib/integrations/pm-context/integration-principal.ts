import type {
  IntegrationApp,
  IntegrationCredentialEnvironment,
  IntegrationCredentialScope,
} from "@prisma/client";

/**
 * Authenticated machine principal for server-to-server integration requests.
 *
 * Deliberately not a {@link import("@/lib/services/staff-context").StaffContext}: there is no
 * staff user, no primary role, and no property assignment map behind a machine client.
 * `organizationId` comes from the credential row and is the only organization the request may
 * ever touch — it is never read from the request body, query string, or a client-supplied header.
 */
export type IntegrationPrincipal = {
  credentialId: string;
  organizationId: string;
  app: IntegrationApp;
  environment: IntegrationCredentialEnvironment;
  scopes: readonly IntegrationCredentialScope[];
};

export function hasScope(
  principal: IntegrationPrincipal,
  scope: IntegrationCredentialScope,
): boolean {
  return principal.scopes.includes(scope);
}
