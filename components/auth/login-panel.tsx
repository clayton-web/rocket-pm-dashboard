"use client";

import { buttonClasses } from "@/components/portal/button";
import { formControlClasses } from "@/components/portal/form-control";
import { withBasePath } from "@/lib/app-path";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const devLoginEnabled = process.env.NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN === "true";

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-base font-semibold text-foreground">Sign in</h1>
      <p className="mt-1 text-sm text-foreground-muted">Rocket PM Dashboard</p>

      {googleEnabled ? (
        <button
          type="button"
          className={buttonClasses({ variant: "primary", block: true, className: "mt-6" })}
          onClick={() => signIn("google", { callbackUrl: withBasePath("/inbox") })}
        >
          Continue with Google
        </button>
      ) : null}

      <form
        className="mt-6 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const result = await signIn("credentials", {
            email,
            password: password || undefined,
            callbackUrl: withBasePath("/inbox"),
            redirect: false,
          });
          if (result?.error) {
            setError("Unable to sign in. Check email, password, and that the account is active.");
            return;
          }
          window.location.assign(withBasePath("/inbox"));
        }}
      >
        <label className="block text-xs font-medium text-foreground-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className={formControlClasses()}
          placeholder="admin@axford.test"
          autoComplete="username"
        />
        <label className="block text-xs font-medium text-foreground-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={formControlClasses()}
          placeholder={devLoginEnabled ? "Required for seeded staff" : "Password"}
          autoComplete="current-password"
        />
        <button type="submit" className={buttonClasses({ variant: "secondary", block: true })}>
          Sign in with email
        </button>
        {devLoginEnabled ? (
          <p className="text-[11px] text-foreground-subtle">
            Dev: accounts without a password hash can sign in with email only (leave password empty). Seeded{" "}
            <code className="rounded bg-selected px-1">admin@axford.test</code> /{" "}
            <code className="rounded bg-selected px-1">pm@axford.test</code> use the seed password — see{" "}
            <code className="rounded bg-selected px-1">docs/auth.md</code>.
          </p>
        ) : (
          <p className="text-[11px] text-foreground-subtle">
            Staff accounts with a stored password must enter it. Google sign-in remains available when configured.
          </p>
        )}
      </form>

      {!googleEnabled && !devLoginEnabled ? (
        <p className="mt-4 text-sm text-foreground-muted">
          Configure Google OAuth or ensure staff users have a password hash to sign in.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
