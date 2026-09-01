import type {
  PropertyServiceRelationship,
  TenancyContactType,
  TenancyStatus,
} from "@prisma/client";
import type { TenancyOccupancyCurrency } from "@/lib/leasing/tenancy-occupancy";

export const CONTEXT_RESOLVE_VERSION = "v1" as const;

/**
 * Lookup signals Rocket Communicator supplies. All fields are optional; at least one usable
 * signal is required.
 *
 * Deliberately excluded from v1:
 * - the communication body (PM Center never receives message content);
 * - `organizationId` (authority comes from the credential, never the request);
 * - `senderPhone` matching (see `unsupportedSignals` below and docs/pm-context-integration.md);
 * - `problemHints` (maintenance resolution is a later slice, so the field would be dead weight).
 */
export type ContextResolveRequest = {
  senderEmail: string | null;
  addressHints: string[];
  unitHints: string[];
  knownPropertyId: string | null;
  knownUnitId: string | null;
};

/**
 * Deterministic evidence categories. Not a probability — no scoring model, no inference.
 * Rocket Communicator decides what to auto-link versus confirm; PM Center only reports evidence.
 */
export type MatchConfidence = "high" | "medium" | "low";

/** Machine-readable reason a candidate was returned. */
export type MatchReason =
  | "sender_email_exact_current_tenancy_contact"
  | "sender_email_exact_historical_tenancy_contact"
  | "sender_email_exact_property_owner_contact"
  | "known_property_id_authorized"
  | "known_unit_id_authorized"
  | "address_hint_exact_normalized"
  | "unit_hint_exact_normalized"
  /** Current tenancy of a unit that was already resolved by id or hint. */
  | "resolved_unit_current_tenancy";

type CandidateBase = {
  confidence: MatchConfidence;
  matchReason: MatchReason;
  /** Concise human-readable label for Communicator's UI. Contains no contact email or phone. */
  displayLabel: string;
};

export type ContactCandidate = CandidateBase & {
  entityType: "tenancy_contact";
  id: string;
  contactType: TenancyContactType;
  occupancy: TenancyOccupancyCurrency;
  tenancyId: string;
  unitId: string;
  propertyId: string;
};

export type PropertyCandidate = CandidateBase & {
  entityType: "property";
  id: string;
  isActive: boolean;
  serviceRelationship: PropertyServiceRelationship;
};

export type UnitCandidate = CandidateBase & {
  entityType: "unit";
  id: string;
  propertyId: string;
  isActive: boolean;
};

export type TenancyCandidate = CandidateBase & {
  entityType: "tenancy";
  id: string;
  propertyId: string;
  unitId: string;
  status: TenancyStatus;
  occupancy: TenancyOccupancyCurrency;
};

/**
 * A match against `Property.ownerEmail`, which is an unstructured property-level contact field.
 *
 * There is no Owner model in PM Center, so there is no owner id to return. The absence of `id`
 * and the explicit `isFirstClassOwnerEntity: false` are the contract: Communicator must not
 * synthesize or persist an owner identity from this.
 */
export type OwnerContactMatch = CandidateBase & {
  entityType: "property_owner_contact";
  propertyId: string;
  ownerContactField: "ownerEmail";
  isFirstClassOwnerEntity: false;
};

export type ContextResolveResponse = {
  version: typeof CONTEXT_RESOLVE_VERSION;
  /** Correlates this response with its audit row. Contains no PII. */
  requestId: string;
  /**
   * Signals the caller sent that this version cannot act on, so they are visibly ignored rather
   * than silently dropped. `senderPhone` is the only current member.
   */
  unsupportedSignals: string[];
  contacts: ContactCandidate[];
  properties: PropertyCandidate[];
  units: UnitCandidate[];
  tenancies: TenancyCandidate[];
  ownerContactMatches: OwnerContactMatch[];
};
