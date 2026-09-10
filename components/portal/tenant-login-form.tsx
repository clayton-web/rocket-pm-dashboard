"use client";

import { FOCUS_RING } from "@/components/portal/focus";
import { formControlClasses } from "@/components/portal/form-control";
import { withBasePath } from "@/lib/app-path";
import { useState } from "react";
import { FormField, InlineNotice, PrimaryButton, SURFACE_CARD } from "@/components/portal/ui";

type Step = "email" | "code";

export function TenantLoginForm({ next }: { next?: string | null }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStart(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevCode(null);
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/portal/auth/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const err =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Unable to start sign-in";
        setError(err);
        return;
      }
      if (typeof data === "object" && data !== null) {
        const o = data as Record<string, unknown>;
        if (typeof o.message === "string") setMessage(o.message);
        if (typeof o.devCode === "string") setDevCode(o.devCode);
      }
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(withBasePath("/api/portal/auth/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, next: next ?? undefined }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const err =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Unable to verify code";
        setError(err);
        return;
      }
      const redirectTo =
        typeof data === "object" &&
        data !== null &&
        "redirectTo" in data &&
        typeof (data as { redirectTo: unknown }).redirectTo === "string"
          ? (data as { redirectTo: string }).redirectTo
          : "/portal/dashboard";
      window.location.assign(withBasePath(redirectTo));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${SURFACE_CARD} p-5`}>
      {step === "email" ? (
        <form className="flex flex-col gap-4" onSubmit={handleStart}>
          <FormField htmlFor="tenant-email" label="Email">
            <input
              id="tenant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={formControlClasses()}
            />
          </FormField>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send sign-in code"}
          </PrimaryButton>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleVerify}>
          <p className="text-sm text-foreground-muted">
            Enter the 6-digit code for <span className="font-medium text-foreground">{email}</span>.
          </p>
          {message ? <p className="text-sm text-foreground-muted">{message}</p> : null}
          {devCode ? (
            <InlineNotice tone="warning" size="compact">
              Dev code: <span className="font-mono font-semibold">{devCode}</span>
            </InlineNotice>
          ) : null}
          <FormField htmlFor="tenant-code" label="One-time code">
            <input
              id="tenant-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoComplete="one-time-code"
              placeholder="123456"
              className={formControlClasses({ className: "font-mono tracking-widest" })}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Sign in"}
            </PrimaryButton>
            <button
              type="button"
              className={`text-sm text-foreground-muted underline underline-offset-2 ${FOCUS_RING}`}
              onClick={() => {
                setStep("email");
                setCode("");
                setDevCode(null);
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
