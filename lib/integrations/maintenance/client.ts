import type { IntegrationResult } from "@/lib/integrations/types";

export type MaintenanceWorkOrderSummary = {
  id: string;
  title: string;
  status: string;
};

export interface MaintenanceClient {
  getWorkOrder(organizationId: string, workOrderId: string): Promise<IntegrationResult<MaintenanceWorkOrderSummary>>;
}

export class StubMaintenanceClient implements MaintenanceClient {
  async getWorkOrder(
    organizationId: string,
    workOrderId: string,
  ): Promise<IntegrationResult<MaintenanceWorkOrderSummary>> {
    void organizationId;
    void workOrderId;
    return { ok: false, error: "Maintenance client not wired (Phase 0 stub)" };
  }
}

export const maintenanceClient: MaintenanceClient = new StubMaintenanceClient();
