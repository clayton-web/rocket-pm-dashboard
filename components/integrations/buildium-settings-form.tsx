"use client";

import {
  disconnectBuildiumAction,
  saveBuildiumCredentialsAction,
  testBuildiumConnectionAction,
} from "@/app/(dashboard)/settings/integrations/buildium/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
} from "@/components/portal/ui";
import type { BuildiumSettingsView } from "@/lib/integrations/buildium/buildium-queries";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUS_LABELS: Record<string, string> = {
  DISCONNECTED: "Disconnected",
  CONNECTED: "Connected",
  NEEDS_REAUTH: "Needs re-authentication",
  ERROR: "Error",
};

export function BuildiumSettingsForm({ initialSettings }: { initialSettings: BuildiumSettingsView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [environment, setEnvironment] = useState(initialSettings.connection.environment);
  const [clientId, setClientId] = useState(initialSettings.connection.clientId);
  const [clientSecret, setClientSecret] = useState("");

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none";

  function onSaveCredentials() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveBuildiumCredentialsAction({
        environment,
        clientId,
        clientSecret: clientSecret.length > 0 ? clientSecret : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setClientSecret("");
      setSuccess("Credentials saved. Run a test connection to verify access.");
      router.refresh();
    });
  }

  function onTestConnection() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await testBuildiumConnectionAction({
        clientSecret: clientSecret.length > 0 ? clientSecret : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setClientSecret("");
      setSuccess(
        result.propertyCount === 1
          ? `Connection successful. Found 1 rental property${result.samplePropertyName ? ` (${result.samplePropertyName})` : ""}.`
          : `Connection successful. Found ${result.propertyCount} rental properties.`,
      );
      router.refresh();
    });
  }

  function onDisconnect() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await disconnectBuildiumAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setClientId("");
      setClientSecret("");
      setSuccess("Buildium connection removed.");
      router.refresh();
    });
  }

  const statusLabel = STATUS_LABELS[initialSettings.connection.status] ?? initialSettings.connection.status;

  return (
    <div className="space-y-6">
      {error ? <InlineNotice>{error}</InlineNotice> : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      {!initialSettings.canEdit ? (
        <InlineNotice>Organization admin or owner access is required to manage Buildium settings.</InlineNotice>
      ) : null}

      {!initialSettings.vaultConfigured ? (
        <InlineNotice>
          Set GMAIL_TOKEN_ENCRYPTION_KEY (or ALLOW_INSECURE_GMAIL_TOKEN_STORAGE for local dev) before saving
          Buildium credentials.
        </InlineNotice>
      ) : null}

      <section className={`${SURFACE_CARD} p-5`}>
        <h2 className="text-sm font-semibold text-neutral-900">Connection status</h2>
        <dl className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd className="font-medium text-neutral-900">{statusLabel}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Environment</dt>
            <dd className="font-medium text-neutral-900">
              {initialSettings.connection.environment === "SANDBOX" ? "Sandbox" : "Production"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Last tested</dt>
            <dd className="font-medium text-neutral-900">
              {initialSettings.connection.lastTestedAt
                ? new Date(initialSettings.connection.lastTestedAt).toLocaleString()
                : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Read-only mode</dt>
            <dd className="font-medium text-neutral-900">
              {initialSettings.readOnlyMode ? "Enabled (GET only)" : "Disabled"}
            </dd>
          </div>
        </dl>
        {initialSettings.connection.lastSyncError ? (
          <p className="mt-3 text-sm text-red-700">{initialSettings.connection.lastSyncError}</p>
        ) : null}
      </section>

      <div className={`${SURFACE_CARD} space-y-6 p-5`}>
        <FormSection
          legend="API credentials"
          helper="Create a read-only API key in Buildium under Settings → Developer Tools. Credentials are stored encrypted and never sent to the browser after save."
        >
          <FormField htmlFor="buildium-environment" label="Environment">
            <select
              id="buildium-environment"
              className={inputClass}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "PRODUCTION" | "SANDBOX")}
              disabled={!initialSettings.canEdit || pending}
            >
              <option value="PRODUCTION">Production (api.buildium.com)</option>
              <option value="SANDBOX">Sandbox (apisandbox.buildium.com)</option>
            </select>
          </FormField>

          <FormField htmlFor="buildium-client-id" label="Client ID">
            <input
              id="buildium-client-id"
              type="text"
              className={inputClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              disabled={!initialSettings.canEdit || pending}
            />
          </FormField>

          <FormField
            htmlFor="buildium-client-secret"
            label="Client secret"
            helper={
              initialSettings.connection.hasSecret
                ? "Leave blank to keep the existing secret. Enter a new value to rotate."
                : "Required on first save."
            }
          >
            <input
              id="buildium-client-secret"
              type="password"
              className={inputClass}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="new-password"
              disabled={!initialSettings.canEdit || pending}
            />
          </FormField>
        </FormSection>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton
            type="button"
            onClick={onSaveCredentials}
            disabled={!initialSettings.canEdit || pending || !initialSettings.vaultConfigured}
            className="w-auto"
          >
            Save credentials
          </PrimaryButton>
          <button
            type="button"
            onClick={onTestConnection}
            disabled={
              !initialSettings.canEdit ||
              pending ||
              !initialSettings.vaultConfigured ||
              (!initialSettings.connection.hasSecret && clientSecret.length === 0)
            }
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
          >
            Test connection
          </button>
          {initialSettings.connection.id ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={!initialSettings.canEdit || pending}
              className="inline-flex items-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
