"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const errCode = searchParams.get("error");

  const errBanner: Record<string, string> = {
    missing: "That link is missing a token. Try requesting a new one.",
    invalid: "That link is not valid. Try requesting a new one.",
    used: "That link has already been used.",
    expired: "That link has expired. Request a new one below.",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPhase("sending");
    try {
      const resp = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${resp.status})`);
      }
      setPhase("sent");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <header className="text-center mb-8">
          <h1 className="font-serif text-4xl mb-2">MedQuiz</h1>
          <p className="text-sm text-[var(--muted)]">Sign in to access your notes.</p>
        </header>

        {errCode && errBanner[errCode] && phase !== "sent" && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            {errBanner[errCode]}
          </div>
        )}

        {phase === "sent" ? (
          <div className="rounded-xl bg-white border border-slate-200 p-6 text-center">
            <p className="text-base mb-2 font-medium">Check your inbox.</p>
            <p className="text-sm text-[var(--muted)]">
              We sent a sign-in link to <span className="font-medium">{email}</span>.
              The link expires in 15 minutes.
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setEmail("");
              }}
              className="mt-4 text-sm text-[var(--accent)] underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm text-[var(--muted)] mb-1"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={phase === "sending"}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={phase === "sending" || !email}
            >
              {phase === "sending" ? "Sending link..." : "Email me a sign-in link"}
            </button>

            {phase === "error" && errorMsg && (
              <p role="alert" className="text-sm text-red-700">
                {errorMsg}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
