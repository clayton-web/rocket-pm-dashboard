import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditContextResolved,
  auditIntegrationAuthFailed,
  auditIntegrationRateLimited,
} from "./integration-audit";
import type { IntegrationPrincipal } from "./integration-principal";
import type { ResolvedContext } from "./resolve-context";

const PRINCIPAL: IntegrationPrincipal = {
  credentialId: "cred_a",
  organizationId: "org_a",
  app: "ROCKET_COMMUNICATOR",
  environment: "PRODUCTION",
  scopes: ["PM_CONTEXT_READ"],
};

function mockDb() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return {};
      },
    },
  };
}

function resolvedFixture(): ResolvedContext {
  return {
    contacts: [
      {
        entityType: "tenancy_contact",
        id: "contact_1",
        confidence: "high",
        matchReason: "sender_email_exact_current_tenancy_contact",
        displayLabel: "Jane Doe — 123 Main St – 204",
        contactType: "tenant",
        occupancy: "current",
        tenancyId: "ten_1",
        unitId: "unit_1",
        propertyId: "prop_1",
      },
    ],
    properties: [
      {
        entityType: "property",
        id: "prop_1",
        confidence: "high",
        matchReason: "address_hint_exact_normalized",
        displayLabel: "123 Main St",
        isActive: true,
        serviceRelationship: "MANAGED",
      },
    ],
    units: [],
    tenancies: [
      {
        entityType: "tenancy",
        id: "ten_1",
        confidence: "high",
        matchReason: "sender_email_exact_current_tenancy_contact",
        displayLabel: "123 Main St – 204",
        propertyId: "prop_1",
        unitId: "unit_1",
        status: "active",
        occupancy: "current",
      },
    ],
    ownerContactMatches: [],
    diagnostics: { propertyScanTruncated: false },
  };
}

describe("auditContextResolved", () => {
  it("records the credential, organization, counts, and matched ids", async () => {
    const db = mockDb();
    await auditContextResolved(
      {
        principal: PRINCIPAL,
        requestId: "req_1",
        signals: {
          hasSenderEmail: true,
          addressHintCount: 1,
          unitHintCount: 0,
          hasKnownPropertyId: false,
          hasKnownUnitId: false,
          unsupportedSignals: ["senderPhone"],
        },
        result: resolvedFixture(),
      },
      db,
    );

    const row = db.rows[0]!;
    assert.equal(row.action, "integration.pm_context.resolved");
    assert.equal(row.organizationId, "org_a");
    assert.equal(row.integrationCredentialId, "cred_a");
    assert.equal(row.actorUserId, null, "machine principals have no staff actor");
    assert.equal(row.resourceId, "cred_a");

    const metadata = row.metadata as Record<string, unknown>;
    assert.deepEqual(metadata.counts, {
      contacts: 1,
      properties: 1,
      units: 0,
      tenancies: 1,
      ownerContactMatches: 0,
    });
    assert.deepEqual(metadata.matchedPropertyIds, ["prop_1"]);
    assert.deepEqual(metadata.matchedTenancyIds, ["ten_1"]);
    assert.deepEqual(metadata.matchReasons, {
      sender_email_exact_current_tenancy_contact: 2,
      address_hint_exact_normalized: 1,
    });
  });

  it("records signal presence as booleans and counts, never their values", async () => {
    const db = mockDb();
    await auditContextResolved(
      {
        principal: PRINCIPAL,
        requestId: "req_1",
        signals: {
          hasSenderEmail: true,
          addressHintCount: 2,
          unitHintCount: 1,
          hasKnownPropertyId: true,
          hasKnownUnitId: false,
          unsupportedSignals: [],
        },
        result: resolvedFixture(),
      },
      db,
    );

    const serialized = JSON.stringify(db.rows[0]);
    // Nothing derived from the message or the sender may reach the audit log.
    for (const forbidden of ["@example.com", "Main St", "Jane Doe", "204"]) {
      assert.ok(!serialized.includes(forbidden), `audit must not contain "${forbidden}"`);
    }
    const signals = (db.rows[0]!.metadata as { signals: Record<string, unknown> }).signals;
    assert.equal(signals.hasSenderEmail, true);
    assert.equal(signals.addressHintCount, 2);
  });
});

describe("auditIntegrationAuthFailed", () => {
  it("records the reason and key id without any token material", async () => {
    const db = mockDb();
    await auditIntegrationAuthFailed(
      {
        reason: "revoked",
        credentialId: "cred_a",
        organizationId: "org_a",
        keyId: "0a1b2c3d4e5f60718293a4b5",
        route: "/api/integrations/v1/context/resolve",
      },
      db,
    );

    const row = db.rows[0]!;
    assert.equal(row.action, "integration.auth.failed");
    assert.equal(row.actorUserId, null);
    assert.equal((row.metadata as { reason: string }).reason, "revoked");
    assert.ok(!JSON.stringify(row).toLowerCase().includes("bearer"));
  });

  it("writes an anonymous row when the credential was never identified", async () => {
    const db = mockDb();
    await auditIntegrationAuthFailed(
      {
        reason: "invalid_secret",
        credentialId: null,
        organizationId: null,
        keyId: null,
        route: "/api/integrations/v1/context/resolve",
      },
      db,
    );

    const row = db.rows[0]!;
    assert.equal(row.organizationId, null);
    assert.equal(row.integrationCredentialId, null);
    assert.equal(row.resourceId, null);
  });
});

describe("auditIntegrationRateLimited", () => {
  it("attributes the throttle to the credential", async () => {
    const db = mockDb();
    await auditIntegrationRateLimited(
      {
        credentialId: "cred_a",
        organizationId: "org_a",
        route: "/api/integrations/v1/context/resolve",
      },
      db,
    );

    const row = db.rows[0]!;
    assert.equal(row.action, "integration.rate_limited");
    assert.equal(row.integrationCredentialId, "cred_a");
    assert.equal(row.actorUserId, null);
  });
});
