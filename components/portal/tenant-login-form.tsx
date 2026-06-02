"use client";

import { useState } from "react";
import { FormField, PrimaryButton, SURFACE_CARD } from "@/components/portal/ui";

type Step = "email" | "code";

export function TenantLoginForm() {
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
      const res = await fetch("/api/portal/auth/start", {
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
      const res = await fetch("/api/portal/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
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
      window.location.assign(redirectTo);
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
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </FormField>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send sign-in code"}
          </PrimaryButton>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleVerify}>
          <p className="text-sm text-neutral-600">
            Enter the 6-digit code for <span className="font-medium text-neutral-900">{email}</span>.
          </p>
          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
          {devCode ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Dev code: <span className="font-mono font-semibold">{devCode}</span>
            </p>
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
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono tracking-widest"
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Sign in"}
            </PrimaryButton>
            <button
              type="button"
              className="text-sm text-neutral-600 underline underline-offset-2"
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
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
