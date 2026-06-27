"use client";

import { updateBriefingSettingsAction } from "@/app/(dashboard)/briefing/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
} from "@/components/portal/ui";
import {
  BRIEFING_FUTURE_FINANCIAL_SOURCE_TYPES,
  BRIEFING_FUTURE_OPERATIONAL_SOURCE_TYPES,
  BRIEFING_MVP_ACTIVE_SOURCE_TYPES,
} from "@/lib/briefing/briefing-sources";
import type { BriefingSettingsView } from "@/lib/briefing/briefing-queries";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BriefingSettingsForm({ initialSettings }: { initialSettings: BriefingSettingsView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [morningEnabled, setMorningEnabled] = useState(initialSettings.morningEnabled);
  const [afternoonEnabled, setAfternoonEnabled] = useState(initialSettings.afternoonEnabled);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [morningLocalTime, setMorningLocalTime] = useState(initialSettings.morningLocalTime);
  const [afternoonLocalTime, setAfternoonLocalTime] = useState(initialSettings.afternoonLocalTime);
  const [emailRecipients, setEmailRecipients] = useState(
    initialSettings.emailRecipients.join(", "),
  );
  const [autoSyncBeforeBriefing, setAutoSyncBeforeBriefing] = useState(
    initialSettings.autoSyncBeforeBriefing,
  );
  const [lookbackHours, setLookbackHours] = useState(String(initialSettings.lookbackHours));
  const [autoBriefingEnabled, setAutoBriefingEnabled] = useState(
    initialSettings.autoBriefingEnabled,
  );

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updateBriefingSettingsAction({
        enabled,
        morningEnabled,
        afternoonEnabled,
        timezone,
        morningLocalTime,
        afternoonLocalTime,
        emailRecipients,
        autoSyncBeforeBriefing,
        lookbackHours: Number(lookbackHours),
        autoBriefingEnabled,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {!initialSettings.autoBriefingEnabled ? (
        <InlineNotice>
          Organization AI policy has auto-briefing disabled. Scheduled automation will not run until
          auto-briefing is enabled below.
        </InlineNotice>
      ) : null}

      {error ? <InlineNotice>{error}</InlineNotice> : null}

      {!initialSettings.canEdit ? (
        <InlineNotice>Organization admin access is required to edit Daily Briefing settings.</InlineNotice>
      ) : null}

      <FormSection legend="Daily Briefing">
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={!initialSettings.canEdit || pending}
          />
          Enable Daily Briefing for {initialSettings.organizationName}
        </label>
      </FormSection>

      <FormSection legend="Schedule">
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={morningEnabled}
            onChange={(event) => setMorningEnabled(event.target.checked)}
            disabled={!initialSettings.canEdit || pending}
          />
          Morning slot enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={afternoonEnabled}
            onChange={(event) => setAfternoonEnabled(event.target.checked)}
            disabled={!initialSettings.canEdit || pending}
          />
          Afternoon slot enabled
        </label>

        <FormField htmlFor="briefing-timezone" label="Timezone">
          <input
            id="briefing-timezone"
            className={inputClass}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            disabled={!initialSettings.canEdit || pending}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="briefing-morning-time" label="Morning local time">
            <input
              id="briefing-morning-time"
              className={inputClass}
              value={morningLocalTime}
              onChange={(event) => setMorningLocalTime(event.target.value)}
              disabled={!initialSettings.canEdit || pending}
              placeholder="07:00"
            />
          </FormField>
          <FormField htmlFor="briefing-afternoon-time" label="Afternoon local time">
            <input
              id="briefing-afternoon-time"
              className={inputClass}
              value={afternoonLocalTime}
              onChange={(event) => setAfternoonLocalTime(event.target.value)}
              disabled={!initialSettings.canEdit || pending}
              placeholder="14:00"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection legend="Email delivery (future)">
        <FormField
          htmlFor="briefing-recipients"
          label="Email recipients"
          helper="Comma-separated staff addresses that receive completed briefing emails when EMAIL_ENABLED is true."
        >
          <textarea
            id="briefing-recipients"
            className={`${inputClass} min-h-20`}
            value={emailRecipients}
            onChange={(event) => setEmailRecipients(event.target.value)}
            disabled={!initialSettings.canEdit || pending}
          />
        </FormField>
      </FormSection>

      <FormSection legend="Generation">
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={autoSyncBeforeBriefing}
            onChange={(event) => setAutoSyncBeforeBriefing(event.target.checked)}
            disabled={!initialSettings.canEdit || pending}
          />
          Sync Gmail before scheduled briefing runs
        </label>

        <FormField htmlFor="briefing-lookback" label="Lookback hours">
          <input
            id="briefing-lookback"
            type="number"
            min={1}
            max={48}
            className={inputClass}
            value={lookbackHours}
            onChange={(event) => setLookbackHours(event.target.value)}
            disabled={!initialSettings.canEdit || pending}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={autoBriefingEnabled}
            onChange={(event) => setAutoBriefingEnabled(event.target.checked)}
            disabled={!initialSettings.canEdit || pending}
          />
          Enable auto-briefing in organization AI policy
        </label>
      </FormSection>

      <FormSection legend="Active sources">
        <ul className="space-y-2 text-sm text-neutral-700">
          {BRIEFING_MVP_ACTIVE_SOURCE_TYPES.map((sourceType) => (
            <li key={sourceType} className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Active
              </span>
              {sourceType}
            </li>
          ))}
          {[...BRIEFING_FUTURE_FINANCIAL_SOURCE_TYPES, ...BRIEFING_FUTURE_OPERATIONAL_SOURCE_TYPES].map(
            (sourceType) => (
              <li key={sourceType} className="flex items-center gap-2 text-neutral-500">
                <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  Coming later
                </span>
                {sourceType}
                <span className="text-xs">(Buildium / future integrations)</span>
              </li>
            ),
          )}
        </ul>
      </FormSection>

      {initialSettings.canEdit ? (
        <PrimaryButton type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
