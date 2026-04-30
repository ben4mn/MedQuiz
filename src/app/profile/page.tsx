"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

type Profile = {
  email: string;
  mastery: {
    topic: string;
    attempts: number;
    correct: number;
    accuracyPct: number;
    masteryScore: number;
    lastSeenAt: number;
  }[];
  recentVoice: {
    id: string;
    documentTitle: string;
    durationMs: number | null;
    endedAt: number;
    struggles: { topic: string; note: string }[];
  }[];
};

export default function ProfilePage() {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/profile");
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${resp.status})`);
        }
        setData((await resp.json()) as Profile);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-red-700">{error}</p>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-[var(--muted)]">Loading your profile...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl mb-2">Your profile</h1>
            <p className="text-sm text-[var(--muted)]">{data.email}</p>
          </header>

          <section className="mb-10">
            <h2 className="font-serif text-xl mb-4">Topics by mastery</h2>
            {data.mastery.length === 0 ? (
              <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
                <p className="text-[var(--muted)] text-sm mb-3">
                  No quiz data yet.
                </p>
                <Link href="/" className="btn-primary text-sm">
                  Go study something
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[var(--muted)]">
                      <th className="text-left p-3 font-medium">Topic</th>
                      <th className="text-right p-3 font-medium w-24">Score</th>
                      <th className="text-right p-3 font-medium w-24">Attempts</th>
                      <th className="text-right p-3 font-medium w-32">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mastery.map((m) => (
                      <tr key={m.topic} className="border-b border-slate-100 last:border-0">
                        <td className="p-3">{m.topic}</td>
                        <td className="p-3 text-right">
                          <MasteryBadge score={m.masteryScore} accuracyPct={m.accuracyPct} />
                        </td>
                        <td className="p-3 text-right text-[var(--muted)]">
                          {m.correct}/{m.attempts}
                        </td>
                        <td className="p-3 text-right text-[var(--muted)]">
                          {formatRelative(m.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-serif text-xl mb-4">Recent voice sessions</h2>
            {data.recentVoice.length === 0 ? (
              <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-sm text-[var(--muted)]">
                No voice sessions recorded yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.recentVoice.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-xl bg-white border border-slate-200 p-5"
                  >
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                      <p className="font-medium">{v.documentTitle}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatRelative(v.endedAt)}
                        {v.durationMs != null && ` · ${Math.round(v.durationMs / 1000)}s`}
                      </p>
                    </div>
                    {v.struggles.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {v.struggles.map((s, i) => (
                          <li key={i} className="text-[var(--muted)]">
                            <span className="font-medium text-slate-900">{s.topic}:</span>{" "}
                            {s.note}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--muted)] mt-1">
                        No specific struggles logged.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function MasteryBadge({
  score,
  accuracyPct,
}: {
  score: number;
  accuracyPct: number;
}) {
  const color =
    score < 0.4
      ? "bg-red-100 text-red-800"
      : score < 0.7
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {accuracyPct}%
    </span>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}
