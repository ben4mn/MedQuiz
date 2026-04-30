"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

type MCQ = {
  id: string;
  topic: string;
  stem: string;
  choices: { label: string; text: string }[];
  correctLabel: string;
  rationale: string;
};

type StudySet = {
  id: string;
  documentTitle: string;
  questions: {
    id: string;
    type: "mcq" | "short" | "recall";
    topic: string;
    stem: string;
    payload: {
      choices?: { label: string; text: string }[];
      correctLabel?: string;
    };
    rationale: string;
  }[];
};

type Phase = "loading" | "quizzing" | "finished" | "drilling" | "error";

export default function MCQModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [set, setSet] = useState<StudySet | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<
    { questionId: string; topic: string; correct: boolean }[]
  >([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());

  const loadSet = useCallback(async () => {
    const resp = await fetch(`/api/study-sets/${id}`);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed (${resp.status})`);
    }
    const { studySet } = (await resp.json()) as { studySet: StudySet };
    const onlyMcq: MCQ[] = studySet.questions
      .filter((q) => q.type === "mcq")
      .map((q) => ({
        id: q.id,
        topic: q.topic,
        stem: q.stem,
        choices: q.payload.choices ?? [],
        correctLabel: q.payload.correctLabel ?? "A",
        rationale: q.rationale,
      }));
    setSet(studySet);
    setMcqs(onlyMcq);
    return onlyMcq;
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadSet();
        if (loaded.length === 0) {
          setPhase("error");
          setError("This study set has no multiple-choice questions yet.");
        } else {
          setPhase("quizzing");
          startRef.current = Date.now();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
  }, [loadSet]);

  if (phase === "loading") {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-[var(--muted)]">Loading quiz...</p>
        </main>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p className="text-lg mb-2">Couldn&apos;t start the quiz.</p>
            <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
            <button onClick={() => router.push(`/study/${id}`)} className="btn-primary">
              Back to study set
            </button>
          </div>
        </main>
      </>
    );
  }

  const correctCount = results.filter((r) => r.correct).length;

  if (phase === "finished" || phase === "drilling") {
    const missed = results.filter((r) => !r.correct);
    const missedTopics = Array.from(new Set(missed.map((r) => r.topic)));

    const drill = async () => {
      setPhase("drilling");
      setError(null);
      try {
        const resp = await fetch(`/api/study-sets/${id}/drill`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics: missedTopics.length > 0 ? missedTopics : Array.from(new Set(results.map((r) => r.topic))),
            count: Math.max(missedTopics.length * 2, 5),
          }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Drill failed (${resp.status})`);
        }
        const { addedQuestionIds } = (await resp.json()) as {
          addedQuestionIds: string[];
        };
        const fresh = await loadSet();
        const newMcqs = fresh.filter((m) => addedQuestionIds.includes(m.id));
        if (newMcqs.length === 0) {
          throw new Error("No new questions came back.");
        }
        setMcqs(newMcqs);
        setResults([]);
        setIndex(0);
        setAnswer(null);
        setRevealed(false);
        startRef.current = Date.now();
        setPhase("quizzing");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("finished");
      }
    };

    return (
      <>
        <AppHeader />
        <main className="flex-1 px-4 sm:px-8 py-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-4xl mb-2">All done</h1>
            <p className="text-[var(--muted)] mb-8">
              You got {correctCount} out of {results.length} right.
            </p>

            {missed.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 p-6 mb-6">
                <p className="font-medium mb-3">Topics to revisit:</p>
                <ul className="space-y-1 text-sm">
                  {missedTopics.map((t) => (
                    <li key={t} className="text-[var(--muted)]">
                      · {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {missed.length > 0 && (
                <button
                  type="button"
                  onClick={drill}
                  disabled={phase === "drilling"}
                  className="btn-primary"
                >
                  {phase === "drilling"
                    ? "Generating focused drill..."
                    : `Drill just the ${missedTopics.length} missed topic${missedTopics.length === 1 ? "" : "s"}`}
                </button>
              )}
              <Link href={`/study/${id}`} className="btn-secondary">
                Back to study set
              </Link>
              <Link href="/profile" className="btn-secondary">
                See my profile
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const q = mcqs[index];
  const isLast = index === mcqs.length - 1;

  const submit = async () => {
    if (revealed || !answer) return;
    const correct = answer === q.correctLabel;
    setRevealed(true);
    setResults((r) => [...r, { questionId: q.id, topic: q.topic, correct }]);

    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          userAnswer: answer,
          isCorrect: correct,
          msToAnswer: Date.now() - startRef.current,
        }),
      });
    } catch {
      // non-fatal
    }
  };

  const next = () => {
    if (isLast) {
      setPhase("finished");
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setRevealed(false);
    startRef.current = Date.now();
  };

  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <header className="mb-5 flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <p className="font-serif text-xl">{set?.documentTitle}</p>
              <p className="text-xs text-[var(--muted)] mt-1">MCQ-only drill mode</p>
            </div>
            <div className="text-sm text-[var(--muted)]">
              Question {index + 1} of {mcqs.length} · {correctCount}/{results.length} correct
            </div>
          </header>

          <div className="rounded-xl bg-white border border-slate-200 p-6 mb-5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-0.5 text-xs text-[var(--accent)] mb-3">
              {q.topic}
            </span>
            <p className="text-lg mb-5 leading-snug">{q.stem}</p>

            <ul className="space-y-2">
              {q.choices.map((c) => {
                const selected = answer === c.label;
                const isCorrect = revealed && c.label === q.correctLabel;
                const isWrongSelected =
                  revealed && selected && c.label !== q.correctLabel;
                return (
                  <li key={c.label}>
                    <button
                      type="button"
                      disabled={revealed}
                      onClick={() => setAnswer(c.label)}
                      className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                        isCorrect
                          ? "border-emerald-500 bg-emerald-50"
                          : isWrongSelected
                            ? "border-red-400 bg-red-50"
                            : selected
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${revealed ? "cursor-default" : ""}`}
                    >
                      <span className="font-medium mr-2">{c.label}.</span>
                      {c.text}
                    </button>
                  </li>
                );
              })}
            </ul>

            {revealed && (
              <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm mb-2">
                  <span className="font-medium">Correct answer: {q.correctLabel}.</span>{" "}
                  {q.choices.find((c) => c.label === q.correctLabel)?.text}
                </p>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {q.rationale}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            {!revealed ? (
              <button
                type="button"
                className="btn-primary"
                disabled={!answer}
                onClick={submit}
              >
                Check answer
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={next}>
                {isLast ? "See results" : "Next question"}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
