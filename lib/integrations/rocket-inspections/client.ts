import type { IntegrationResult } from "@/lib/integrations/types";

export type InspectionSummary = {
  id: string;
  status: string;
  scheduledFor?: string;
};

export interface RocketInspectionsClient {
  getInspection(organizationId: string, inspectionId: string): Promise<IntegrationResult<InspectionSummary>>;
}

export class StubRocketInspectionsClient implements RocketInspectionsClient {
  async getInspection(
    organizationId: string,
    inspectionId: string,
  ): Promise<IntegrationResult<InspectionSummary>> {
    void organizationId;
    void inspectionId;
    return { ok: false, error: "Inspections client not wired (Phase 0 stub)" };
  }
}

export const rocketInspectionsClient: RocketInspectionsClient = new StubRocketInspectionsClient();
