/** Cross-Rocket identifiers — use the same id shape Core exposes over HTTP */
export type RocketEntityKind =
  | "organization"
  | "property"
  | "unit"
  | "tenant"
  | "owner"
  | "lease"
  | "work_order"
  | "inspection";

export type RemoteEntityRef = {
  system: "rocket-core" | "rocket-inspections" | "maintenance" | "documents" | "crm";
  kind: RocketEntityKind;
  id: string;
};

export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };
