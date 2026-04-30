"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

type Doc = {
  id: string;
  title: string;
  wordCount: number;
  sourceType: string;
  createdAt: number;
};

type StudySetStub = {
  id: string;
  documentId: string;
  createdAt: number;
};

export default function LibraryPage() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [studySetsByDoc, setStudySetsByDoc] = useState<
    Record<string, StudySetStub[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const [dRes, sRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/study-sets-index"),
        ]);
        if (!dRes.ok) throw new Error((await dRes.json()).error ?? "Failed to load documents");
        const { documents: ds } = await dRes.json();
        setDocs(ds);
        if (sRes.ok) {
          const { studySets } = await sRes.json();
          const grouped: Record<string, StudySetStub[]> = {};
          for (const s of studySets as StudySetStub[]) {
            (grouped[s.documentId] ??= []).push(s);
          }
          setStudySetsByDoc(grouped);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const generateFrom = async (docId: string) => {
    setGenerating(docId);
    setError(null);
    try {
      const resp = await fetch("/api/study-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${resp.status})`);
      }
      const { studySetId } = (await resp.json()) as { studySetId: string };
      router.push(`/study/${studySetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGenerating(null);
    }
  };

  const deleteDoc = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all associated quizzes?`)) return;
    setDeleting(id);
    try {
      const resp = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Delete failed");
      setDocs((current) => (current ? current.filter((d) => d.id !== id) : current));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl">Your library</h1>
            <Link href="/new" className="btn-primary">
              Add new notes
            </Link>
          </div>

          {error && (
            <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {docs === null ? (
            <p className="text-[var(--muted)]">Loading...</p>
          ) : docs.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200 p-10 text-center">
              <p className="text-base mb-3">Nothing here yet.</p>
              <p className="text-sm text-[var(--muted)] mb-6">
                Paste a chapter or upload a file to build your first study set.
              </p>
              <Link href="/new" className="btn-primary">
                Add your first chapter
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {docs.map((d) => {
                const sets = studySetsByDoc[d.id] ?? [];
                const isGenerating = generating === d.id;
                const isDeleting = deleting === d.id;
                return (
                  <li
                    key={d.id}
                    className="rounded-xl bg-white border border-slate-200 p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-serif text-lg sm:text-xl mb-1 truncate">
                          {d.title}
                        </h2>
                        <p className="text-xs text-[var(--muted)]">
                          {d.wordCount.toLocaleString()} words · {d.sourceType} · saved{" "}
                          {formatRelative(d.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sets.length > 0 && (
                          <Link
                            href={`/study/${sets[0].id}`}
                            className="btn-secondary text-sm"
                          >
                            Open study set
                          </Link>
                        )}
                        <button
                          type="button"
                          className="btn-primary text-sm"
                          disabled={isGenerating || isDeleting}
                          onClick={() => generateFrom(d.id)}
                        >
                          {isGenerating
                            ? "Generating..."
                            : sets.length > 0
                              ? "New study set"
                              : "Generate study set"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDoc(d.id, d.title)}
                          disabled={isGenerating || isDeleting}
                          aria-label={`Delete ${d.title}`}
                          className="text-sm text-[var(--muted)] hover:text-red-700 px-2 py-1"
                        >
                          {isDeleting ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    {sets.length > 1 && (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        {sets.length} study sets generated from these notes
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
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
