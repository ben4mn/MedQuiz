"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import AppHeader from "@/components/AppHeader";
import TextQuiz, { type QuizQuestion } from "@/components/TextQuiz";

const MindMap = dynamic(() => import("@/components/MindMap"), { ssr: false });
const VoiceQuiz = dynamic(() => import("@/components/VoiceQuiz"), {
  ssr: false,
});

type StudySet = {
  id: string;
  documentId: string;
  documentTitle: string;
  mindMapMarkdown: string;
  voiceAgentPrompt: string;
  createdAt: number;
  questions: {
    id: string;
    type: "mcq" | "short" | "recall";
    topic: string;
    stem: string;
    payload: Record<string, unknown>;
    rationale: string;
  }[];
};

type Tab = "mindmap" | "quiz" | "voice";

export default function StudySetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<StudySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mindmap");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`/api/study-sets/${id}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${resp.status})`);
        }
        const { studySet } = (await resp.json()) as { studySet: StudySet };
        setData(studySet);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id]);

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p className="text-lg mb-2">Couldn&apos;t load your study set.</p>
            <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
            <button onClick={() => router.push("/")} className="btn-primary">
              Back to library
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-[var(--muted)]">Loading your study set...</p>
        </main>
      </>
    );
  }

  const quizQuestions: QuizQuestion[] = data.questions.map((q) => ({
    id: q.id,
    type: q.type,
    topic: q.topic,
    stem: q.stem,
    rationale: q.rationale,
    ...(q.payload as object),
  })) as QuizQuestion[];

  const mcqCount = data.questions.filter((q) => q.type === "mcq").length;

  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl">{data.documentTitle}</h1>
              <p className="text-sm text-[var(--muted)] mt-1">
                {data.questions.length} questions · {mcqCount} MCQ
              </p>
            </div>
            {mcqCount > 0 && (
              <Link href={`/quiz/${id}`} className="btn-secondary text-sm">
                Open MCQ-only mode
              </Link>
            )}
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
            {tab === "mindmap" && <MindMap markdown={data.mindMapMarkdown} />}
            {tab === "quiz" && <TextQuiz studySetId={id} questions={quizQuestions} />}
            {tab === "voice" && <VoiceQuiz studySetId={id} />}
          </section>
        </div>
      </main>
    </>
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
