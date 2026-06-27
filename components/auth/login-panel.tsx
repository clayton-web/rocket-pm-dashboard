"use client";

import { withBasePath } from "@/lib/app-path";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const devLoginEnabled = process.env.NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN === "true";

  return (
    <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-base font-semibold text-neutral-900">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">Rocket PM Dashboard</p>

      {googleEnabled ? (
        <button
          type="button"
          className="mt-6 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
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
        <label className="block text-xs font-medium text-neutral-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          placeholder="admin@axford.test"
          autoComplete="username"
        />
        <label className="block text-xs font-medium text-neutral-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          placeholder={devLoginEnabled ? "Required for seeded staff" : "Password"}
          autoComplete="current-password"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Sign in with email
        </button>
        {devLoginEnabled ? (
          <p className="text-[11px] text-neutral-500">
            Dev: accounts without a password hash can sign in with email only (leave password empty). Seeded{" "}
            <code className="rounded bg-neutral-100 px-1">admin@axford.test</code> /{" "}
            <code className="rounded bg-neutral-100 px-1">pm@axford.test</code> use the seed password — see{" "}
            <code className="rounded bg-neutral-100 px-1">docs/auth.md</code>.
          </p>
        ) : (
          <p className="text-[11px] text-neutral-500">
            Staff accounts with a stored password must enter it. Google sign-in remains available when configured.
          </p>
        )}
      </form>

      {!googleEnabled && !devLoginEnabled ? (
        <p className="mt-4 text-sm text-neutral-600">
          Configure Google OAuth or ensure staff users have a password hash to sign in.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
