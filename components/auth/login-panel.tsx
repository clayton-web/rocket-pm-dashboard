"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
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
          onClick={() => signIn("google", { callbackUrl: "/inbox" })}
        >
          Continue with Google
        </button>
      ) : null}

      {devLoginEnabled ? (
        <form
          className="mt-6 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            const result = await signIn("credentials", {
              email,
              callbackUrl: "/inbox",
              redirect: false,
            });
            if (result?.error) {
              setError("Unable to sign in. Check the email or seed data.");
              return;
            }
            window.location.assign("/inbox");
          }}
        >
          <label className="block text-xs font-medium text-neutral-700" htmlFor="email">
            Dev email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            placeholder="you@example.com"
            autoComplete="username"
          />
          <button
            type="submit"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Continue (dev credentials)
          </button>
          <p className="text-[11px] text-neutral-500">
            Development only. Set <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN</code>{" "}
            and <code className="rounded bg-neutral-100 px-1">DEV_CREDENTIALS_LOGIN</code> on the server.
          </p>
        </form>
      ) : null}

      {!googleEnabled && !devLoginEnabled ? (
        <p className="mt-6 text-sm text-neutral-600">
          Configure Google OAuth or enable dev credentials via environment variables to sign in.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
