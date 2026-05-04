import type { IntegrationResult } from "@/lib/integrations/types";

/**
 * Typed facade for Rocket PM Core (properties, people, leases).
 * Implement HTTP calls here; inbox/AI code must depend only on this interface.
 */
export type PropertySummary = {
  id: string;
  name: string;
  organizationId: string;
};

export interface RocketCoreClient {
  getPropertySummary(organizationId: string, propertyId: string): Promise<IntegrationResult<PropertySummary>>;
}

export class StubRocketCoreClient implements RocketCoreClient {
  async getPropertySummary(
    organizationId: string,
    propertyId: string,
  ): Promise<IntegrationResult<PropertySummary>> {
    void organizationId;
    void propertyId;
    return { ok: false, error: "Rocket Core client not wired (Phase 0 stub)" };
  }
}

export const rocketCoreClient: RocketCoreClient = new StubRocketCoreClient();
