"use client";

import {
  clearRentalAdAssistantDraftOutputAction,
  generateRentalAdAssistantDraftAction,
  rentalAdAssistantIdleState,
  saveRentalAdAssistantDraftAction,
} from "@/app/(dashboard)/properties/rental-ad-assistant-actions";
import {
  FormField,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  RENTAL_AD_ASSISTANT_DISCLAIMER,
  RENTAL_AD_ASSISTANT_DRAFT_HELPER_LABEL,
  RENTAL_AD_ASSISTANT_PANEL_TITLE,
  type RentalAdAssistantDraftDto,
} from "@/lib/rental-ad-assistant/draft-dto";
import {
  AGGRESSIVE_RENT_LABEL,
  buildRentalAdOutputFormState,
  CONFIDENCE_HELPER_TEXT,
  CONSERVATIVE_RENT_LABEL,
  coerceReviewFlagsForDisplay,
  formatRentalAdReviewFlagsForDisplay,
  formatUtilitiesForInput,
  hasRenderableRentalAdOutput,
  HISTORICAL_COMPS_HELPER_TEXT,
  parseUtilitiesFromInput,
  RECOMMENDED_RENT_LABEL,
  rentalAdGenerateUnavailableMessage,
  rentalAdHistoricalCompsLabel,
  RENTAL_AD_REVIEW_BANNER_MESSAGE,
  shouldDisableRentalAdGenerate,
  shouldShowRentalAdReviewBanner,
  SUGGESTED_ADVERTISING_RENT_LABEL,
  SUGGESTED_RENT_HELPER_TEXT,
} from "@/lib/rental-ad-assistant/panel-ui";
import {
  RENTAL_AD_FURNISHED_VALUES,
  type RentalAdAssistantInputs,
  type RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";

export type RentalAdAssistantPanelProps = {
  unitId: string;
  unitLabel: string;
  unitFloor: string | null;
  unitBedrooms: number | null;
  addressDisplay: string;
  cityLine: string;
  initialDraft: RentalAdAssistantDraftDto | null;
  aiGenerationConfigured: boolean;
  canEdit: boolean;
};

type FormState = {
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  parking: string;
  utilitiesIncluded: string;
  petPolicy: string;
  furnished: RentalAdAssistantInputs["furnished"];
  availableDate: string;
  notes: string;
  targetRentHint: string;
};

type OutputFormState = ReturnType<typeof buildRentalAdOutputFormState>;

function buildInitialFormState(
  draft: RentalAdAssistantDraftDto | null,
  unitBedrooms: number | null,
): FormState {
  const inputs = draft?.inputs;
  return {
    propertyType: inputs?.propertyType ?? "",
    bedrooms:
      inputs?.bedrooms !== undefined
        ? String(inputs.bedrooms)
        : unitBedrooms != null
          ? String(unitBedrooms)
          : "",
    bathrooms: inputs?.bathrooms !== undefined ? String(inputs.bathrooms) : "",
    sqft: inputs?.sqft !== undefined ? String(inputs.sqft) : "",
    parking: inputs?.parking ?? "",
    utilitiesIncluded: inputs ? formatUtilitiesForInput(inputs.utilitiesIncluded) : "",
    petPolicy: inputs?.petPolicy ?? "",
    furnished: inputs?.furnished ?? "unfurnished",
    availableDate: inputs?.availableDate ?? "",
    notes: inputs?.notes ?? "",
    targetRentHint:
      inputs?.targetRentHint !== undefined ? String(inputs.targetRentHint) : "",
  };
}

function buildInitialOutputState(draft: RentalAdAssistantDraftDto | null): OutputFormState {
  return buildRentalAdOutputFormState(draft?.output);
}

function formToInputs(form: FormState): RentalAdAssistantInputs {
  const inputs: RentalAdAssistantInputs = {
    propertyType: form.propertyType,
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
    sqft: Number(form.sqft),
    parking: form.parking,
    utilitiesIncluded: parseUtilitiesFromInput(form.utilitiesIncluded),
    petPolicy: form.petPolicy,
    furnished: form.furnished,
    availableDate: form.availableDate,
  };
  if (form.notes.trim()) inputs.notes = form.notes.trim();
  if (form.targetRentHint.trim()) inputs.targetRentHint = Number(form.targetRentHint);
  return inputs;
}

function mergeEditedOutput(
  base: RentalAdAssistantOutput | null | undefined,
  edited: OutputFormState,
): RentalAdAssistantOutput | null {
  if (!base) return null;
  return {
    ...base,
    headline: edited.headline,
    fullDescription: edited.fullDescription,
    shortDescription: edited.shortDescription,
    valueAddSuggestions: edited.valueAddSuggestions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

async function copyText(label: string, text: string, setMessage: (msg: string | null) => void) {
  if (!text.trim()) {
    setMessage(`Nothing to copy for ${label}.`);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} copied.`);
  } catch {
    setMessage(`Could not copy ${label}.`);
  }
}

const inputClassName = "w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm";

export function RentalAdAssistantPanel(props: RentalAdAssistantPanelProps) {
  const {
    unitId,
    unitLabel,
    unitFloor,
    unitBedrooms,
    addressDisplay,
    cityLine,
    initialDraft,
    aiGenerationConfigured,
    canEdit,
  } = props;

  const router = useRouter();
  const lastGenerateCompletedAt = useRef(0);

  const [draft, setDraft] = useState(initialDraft);
  const [form, setForm] = useState(() => buildInitialFormState(initialDraft, unitBedrooms));
  const [outputForm, setOutputForm] = useState(() => buildInitialOutputState(initialDraft));
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [saveState, saveAction, savePending] = useActionState(
    saveRentalAdAssistantDraftAction,
    rentalAdAssistantIdleState,
  );
  const [generateState, generateAction, generatePending] = useActionState(
    generateRentalAdAssistantDraftAction,
    rentalAdAssistantIdleState,
  );
  const [clearState, clearAction, clearPending] = useActionState(
    clearRentalAdAssistantDraftOutputAction,
    rentalAdAssistantIdleState,
  );

  useEffect(() => {
    setDraft(initialDraft);
    setForm(buildInitialFormState(initialDraft, unitBedrooms));
    setOutputForm(buildInitialOutputState(initialDraft));
  }, [initialDraft, unitBedrooms]);

  useEffect(() => {
    if (saveState.completedAt > 0 && saveState.ok && saveState.draft) {
      setDraft(saveState.draft);
      setOutputForm(buildInitialOutputState(saveState.draft));
    }
  }, [saveState]);

  useEffect(() => {
    if (generateState.completedAt <= lastGenerateCompletedAt.current) return;
    lastGenerateCompletedAt.current = generateState.completedAt;
    if (generateState.ok) {
      if (generateState.draft) {
        setDraft(generateState.draft);
        setOutputForm(buildInitialOutputState(generateState.draft));
      }
      router.refresh();
    }
  }, [generateState, router]);

  useEffect(() => {
    if (clearState.completedAt > 0 && clearState.ok && clearState.draft) {
      setDraft(clearState.draft);
      setOutputForm(buildInitialOutputState(clearState.draft));
    }
  }, [clearState]);

  const propertyTypeId = useId();
  const bedroomsId = useId();
  const bathroomsId = useId();
  const sqftId = useId();
  const parkingId = useId();
  const utilitiesId = useId();
  const petPolicyId = useId();
  const furnishedId = useId();
  const availableDateId = useId();
  const notesId = useId();
  const targetRentHintId = useId();
  const headlineId = useId();
  const fullDescriptionId = useId();
  const shortDescriptionId = useId();
  const valueAddId = useId();

  const output = hasRenderableRentalAdOutput(draft?.output) ? draft.output : null;
  const reviewFlags = coerceReviewFlagsForDisplay(output?.reviewFlags);
  const comps = draft?.compsSnapshot ?? null;
  const generateDisabled = shouldDisableRentalAdGenerate(aiGenerationConfigured);
  const generateUnavailable = rentalAdGenerateUnavailableMessage(aiGenerationConfigured);
  const actionError =
    (saveState.ok ? null : saveState.error) ??
    (generateState.ok ? null : generateState.error) ??
    (clearState.ok ? null : clearState.error);

  if (!canEdit) {
    return null;
  }

  return (
    <details className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60">
      <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
        {RENTAL_AD_ASSISTANT_PANEL_TITLE}
        <span className="ml-2 text-xs font-normal text-neutral-500">
          · {RENTAL_AD_ASSISTANT_DRAFT_HELPER_LABEL}
        </span>
      </summary>

      <div className={`${SURFACE_PANEL} m-3 mt-0 flex flex-col gap-4 border-neutral-200 px-4 py-4`}>
        <InlineNotice>{RENTAL_AD_ASSISTANT_DISCLAIMER}</InlineNotice>

        <p className="text-sm text-neutral-600">
          <span className="text-neutral-500">Property · </span>
          {addressDisplay}
          <span className="text-neutral-500"> · Unit · </span>
          {unitLabel}
          {unitFloor ? ` · Floor ${unitFloor}` : ""}
          <span className="block text-neutral-500">{cityLine}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Property type" htmlFor={propertyTypeId}>
            <input
              id={propertyTypeId}
              className={inputClassName}
              value={form.propertyType}
              onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
              placeholder="e.g. condo, house, basement suite"
            />
          </FormField>
          <FormField label="Bedrooms" htmlFor={bedroomsId}>
            <input
              id={bedroomsId}
              type="number"
              min={0}
              max={50}
              className={inputClassName}
              value={form.bedrooms}
              onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
            />
          </FormField>
          <FormField label="Bathrooms" htmlFor={bathroomsId}>
            <input
              id={bathroomsId}
              type="number"
              min={0}
              step={0.5}
              className={inputClassName}
              value={form.bathrooms}
              onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
            />
          </FormField>
          <FormField label="Approximate sqft" htmlFor={sqftId}>
            <input
              id={sqftId}
              type="number"
              min={1}
              className={inputClassName}
              value={form.sqft}
              onChange={(e) => setForm((f) => ({ ...f, sqft: e.target.value }))}
            />
          </FormField>
          <FormField label="Parking" htmlFor={parkingId}>
            <input
              id={parkingId}
              className={inputClassName}
              value={form.parking}
              onChange={(e) => setForm((f) => ({ ...f, parking: e.target.value }))}
            />
          </FormField>
          <FormField
            label="Utilities included"
            htmlFor={utilitiesId}
            helper="Comma-separated, e.g. water, heat, internet"
          >
            <input
              id={utilitiesId}
              className={inputClassName}
              value={form.utilitiesIncluded}
              onChange={(e) => setForm((f) => ({ ...f, utilitiesIncluded: e.target.value }))}
            />
          </FormField>
          <FormField label="Pet policy" htmlFor={petPolicyId}>
            <input
              id={petPolicyId}
              className={inputClassName}
              value={form.petPolicy}
              onChange={(e) => setForm((f) => ({ ...f, petPolicy: e.target.value }))}
            />
          </FormField>
          <FormField label="Furnished" htmlFor={furnishedId}>
            <select
              id={furnishedId}
              className={inputClassName}
              value={form.furnished}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  furnished: e.target.value as RentalAdAssistantInputs["furnished"],
                }))
              }
            >
              {RENTAL_AD_FURNISHED_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Available date" htmlFor={availableDateId}>
            <input
              id={availableDateId}
              className={inputClassName}
              value={form.availableDate}
              onChange={(e) => setForm((f) => ({ ...f, availableDate: e.target.value }))}
              placeholder="YYYY-MM-DD or now"
            />
          </FormField>
          <FormField
            label="Optional target advertising hint (CAD)"
            htmlFor={targetRentHintId}
            helper="Your own starting point — not official rent."
          >
            <input
              id={targetRentHintId}
              type="number"
              min={0}
              step={1}
              className={inputClassName}
              value={form.targetRentHint}
              onChange={(e) => setForm((f) => ({ ...f, targetRentHint: e.target.value }))}
            />
          </FormField>
        </div>

        <FormField label="Notes / features" htmlFor={notesId}>
          <textarea
            id={notesId}
            rows={3}
            className={inputClassName}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </FormField>

        {generateUnavailable ? (
          <p className="text-xs text-amber-900">
            Set <code className="rounded bg-amber-50 px-1">OPENAI_API_KEY</code>{" "}
            (optional: <code className="rounded bg-amber-50 px-1">OPENAI_RENTAL_AD_MODEL</code>) to
            generate advertising drafts with AI.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <form action={saveAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="inputs" value={JSON.stringify(formToInputs(form))} />
            {output ? (
              <input
                type="hidden"
                name="output"
                value={JSON.stringify(mergeEditedOutput(output, outputForm))}
              />
            ) : null}
            <PrimaryButton type="submit" disabled={savePending} className="!w-auto px-5">
              {savePending ? "Saving…" : "Save draft"}
            </PrimaryButton>
          </form>

          <form action={generateAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="inputs" value={JSON.stringify(formToInputs(form))} />
            <PrimaryButton
              type="submit"
              disabled={generateDisabled || generatePending}
              className="!w-auto px-5"
            >
              {generatePending ? "Generating…" : "Generate"}
            </PrimaryButton>
          </form>

          {output ? (
            <form action={clearAction}>
              <input type="hidden" name="unitId" value={unitId} />
              <button
                type="submit"
                disabled={clearPending}
                className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                {clearPending ? "Clearing…" : "Clear generated output"}
              </button>
            </form>
          ) : null}
        </div>

        {actionError ? <InlineNotice>{actionError}</InlineNotice> : null}
        {copyMessage ? <p className="text-xs text-neutral-600">{copyMessage}</p> : null}

        {comps && comps.count > 0 ? (
          <section className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700">
            <h3 className="font-semibold text-neutral-900">{rentalAdHistoricalCompsLabel()}</h3>
            <p className="mt-1 text-xs text-neutral-600">{HISTORICAL_COMPS_HELPER_TEXT}</p>
            <p className="mt-2">
              Count {comps.count}
              {comps.median != null ? ` · Median $${comps.median} CAD` : ""}
              {comps.min != null && comps.max != null
                ? ` · Range $${comps.min}–$${comps.max} CAD`
                : ""}
            </p>
          </section>
        ) : null}

        {output ? (
          <div className="flex flex-col gap-4">
            {shouldShowRentalAdReviewBanner(reviewFlags) ? (
              <section
                className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
                role="status"
              >
                <p className="font-semibold">{RENTAL_AD_REVIEW_BANNER_MESSAGE}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {formatRentalAdReviewFlagsForDisplay(reviewFlags).map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold text-neutral-900">
                {SUGGESTED_ADVERTISING_RENT_LABEL}
              </h3>
              <p className="mt-1 text-xs text-neutral-600">{SUGGESTED_RENT_HELPER_TEXT}</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                <li>
                  {CONSERVATIVE_RENT_LABEL} · ${output.suggestedAdvertisingRent.conservative} CAD
                </li>
                <li>
                  {RECOMMENDED_RENT_LABEL} · ${output.suggestedAdvertisingRent.recommended} CAD
                </li>
                <li>
                  {AGGRESSIVE_RENT_LABEL} · ${output.suggestedAdvertisingRent.aggressive} CAD
                </li>
              </ul>
              <p className="mt-2 text-sm text-neutral-600">
                Confidence · {output.confidence} — {output.confidenceReason}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{CONFIDENCE_HELPER_TEXT}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{output.explanation}</p>
            </section>

            <FormField label="Headline" htmlFor={headlineId}>
              <input
                id={headlineId}
                className={inputClassName}
                value={outputForm.headline}
                onChange={(e) => setOutputForm((o) => ({ ...o, headline: e.target.value }))}
              />
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-neutral-700 underline"
                onClick={() => copyText("Headline", outputForm.headline, setCopyMessage)}
              >
                Copy headline
              </button>
            </FormField>

            <FormField label="Full description" htmlFor={fullDescriptionId}>
              <textarea
                id={fullDescriptionId}
                rows={6}
                className={inputClassName}
                value={outputForm.fullDescription}
                onChange={(e) => setOutputForm((o) => ({ ...o, fullDescription: e.target.value }))}
              />
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-neutral-700 underline"
                onClick={() =>
                  copyText("Full description", outputForm.fullDescription, setCopyMessage)
                }
              >
                Copy full description
              </button>
            </FormField>

            <FormField label="Short description" htmlFor={shortDescriptionId}>
              <textarea
                id={shortDescriptionId}
                rows={4}
                className={inputClassName}
                value={outputForm.shortDescription}
                onChange={(e) => setOutputForm((o) => ({ ...o, shortDescription: e.target.value }))}
              />
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-neutral-700 underline"
                onClick={() =>
                  copyText("Short description", outputForm.shortDescription, setCopyMessage)
                }
              >
                Copy short description
              </button>
            </FormField>

            <FormField
              label="Value-add suggestions"
              htmlFor={valueAddId}
              helper="One suggestion per line"
            >
              <textarea
                id={valueAddId}
                rows={4}
                className={inputClassName}
                value={outputForm.valueAddSuggestions}
                onChange={(e) =>
                  setOutputForm((o) => ({ ...o, valueAddSuggestions: e.target.value }))
                }
              />
            </FormField>
          </div>
        ) : null}
      </div>
    </details>
  );
}
