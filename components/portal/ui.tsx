import type { ReactNode } from "react";

export const SURFACE_PANEL = "rounded-xl border border-neutral-200 bg-white";
export const SURFACE_CARD = "rounded-xl border border-neutral-200 bg-white shadow-sm";
export const SURFACE_DASHED =
  "rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80";

export function PortalPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <header className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{description}</p>
    </header>
  );
}

export function FormSection({
  legend,
  helper,
  children,
  groupAriaLabel,
}: {
  legend: string;
  helper?: string;
  children: ReactNode;
  groupAriaLabel?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3" aria-label={groupAriaLabel ?? legend}>
      <legend className="text-sm font-semibold text-neutral-900">{legend}</legend>
      {helper ? <p className="text-sm text-neutral-600">{helper}</p> : null}
      {children}
    </fieldset>
  );
}

export function FormField({
  htmlFor,
  label,
  helper,
  children,
}: {
  htmlFor?: string;
  label: ReactNode;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-neutral-900">
        {label}
      </label>
      {helper ? <p className="text-sm text-neutral-600">{helper}</p> : null}
      {children}
    </div>
  );
}

export function SelectionCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
        selected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  type = "button",
  disabled,
  onClick,
  children,
  className = "",
}: {
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900" role="alert">
      {children}
    </p>
  );
}

export function InlineNotice({ children, className = "", role }: { children: ReactNode; className?: string; role?: string }) {
  return (
    <p
      className={`rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700 ${className}`}
      role={role}
    >
      {children}
    </p>
  );
}

export function StickyFormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-1 border-t border-neutral-200 bg-neutral-50/95 px-1 pb-4 pt-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function toggleTileClasses(active: boolean): string {
  const base = "rounded-lg border px-3 py-1.5 text-sm font-medium";
  return active
    ? `${base} border-neutral-900 bg-neutral-900 text-white`
    : `${base} border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`;
}
