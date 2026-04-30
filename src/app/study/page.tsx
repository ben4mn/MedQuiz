"use client";

import { Suspense, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { GeneratedContent } from "@/lib/types";

const MindMap = dynamic(() => import("@/components/MindMap"), { ssr: false });
const VoiceQuiz = dynamic(() => import("@/components/VoiceQuiz"), {
  ssr: false,
});
import TextQuiz from "@/components/TextQuiz";

type Tab = "mindmap" | "quiz" | "voice";

export default function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <StudyView searchParams={searchParams} />
    </Suspense>
  );
}

function StudyView({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s: sessionId } = use(searchParams);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mindmap");
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${resp.status})`);
        }
        const data = (await resp.json()) as GeneratedContent;
        if (!cancelled) setContent(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-lg mb-2">Couldn&apos;t load your study set.</p>
          <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
          <button onClick={() => router.push("/")} className="btn-primary">
            Start over
          </button>
        </div>
      </main>
    );
  }

  if (!content) return <LoadingPanel />;

  return (
    <main className="flex-1 flex flex-col p-4 sm:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl">Your study set</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {content.sources.map((s) => s.name).join(", ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn-secondary text-sm"
          >
            Upload different notes
          </button>
        </header>

        <nav className="flex border-b border-slate-200 mb-6">
          <TabButton active={tab === "mindmap"} onClick={() => setTab("mindmap")}>
            Mind map
          </TabButton>
          <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")}>
            Text quiz
          </TabButton>
          <TabButton active={tab === "voice"} onClick={() => setTab("voice")}>
            Voice quiz
          </TabButton>
        </nav>

        <section>
          {tab === "mindmap" && <MindMap markdown={content.mindMapMarkdown} />}
          {tab === "quiz" && <TextQuiz questions={content.quizQuestions} />}
          {tab === "voice" && sessionId && <VoiceQuiz sessionId={sessionId} />}
        </section>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--muted)] hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingPanel() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-[var(--muted)]">Loading your study set...</p>
      </div>
    </main>
  );
}
