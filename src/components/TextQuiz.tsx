"use client";

import { useRef, useState } from "react";

export type QuizQuestion =
  | {
      id: string;
      type: "mcq";
      topic: string;
      stem: string;
      choices: { label: string; text: string }[];
      correctLabel: string;
      rationale: string;
    }
  | {
      id: string;
      type: "short";
      topic: string;
      stem: string;
      correctAnswer: string;
      rationale: string;
    }
  | {
      id: string;
      type: "recall";
      topic: string;
      stem: string;
      expectedPoints: string[];
      rationale: string;
    };

type Props = {
  studySetId: string;
  questions: QuizQuestion[];
};

export default function TextQuiz({ studySetId, questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const startedAt = useRef<number>(Date.now());

  if (questions.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-slate-200 p-6 text-center text-[var(--muted)]">
        No questions generated yet.
      </div>
    );
  }

  const q = questions[index];
  const isLast = index === questions.length - 1;

  const submit = async () => {
    if (revealed) return;
    let correct = false;
    if (q.type === "mcq") {
      correct = answer === q.correctLabel;
    } else if (q.type === "short") {
      correct =
        answer.trim().length > 0 &&
        normalize(answer).includes(normalize(q.correctAnswer).slice(0, 20));
    } else {
      correct = answer.trim().split(/\s+/).length >= 3;
    }
    setRevealed(true);
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      answered: s.answered + 1,
    }));

    const msToAnswer = Date.now() - startedAt.current;
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          userAnswer: answer,
          isCorrect: correct,
          msToAnswer,
        }),
      });
    } catch {
      // Non-fatal: the UI already advanced
    }
    void studySetId;
  };

  const next = () => {
    setAnswer("");
    setRevealed(false);
    startedAt.current = Date.now();
    if (!isLast) setIndex((i) => i + 1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">
          Question {index + 1} of {questions.length}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-0.5 text-xs text-[var(--accent)]">
          {q.topic}
        </span>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-6">
        <p className="text-lg mb-5 leading-snug">{q.stem}</p>

        {q.type === "mcq" && (
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
        )}

        {q.type === "short" && (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed}
            placeholder="Type your answer..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-[var(--accent)]"
          />
        )}

        {q.type === "recall" && (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed}
            placeholder="Write everything you remember..."
            rows={5}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-[var(--accent)]"
          />
        )}

        {revealed && (
          <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm font-medium mb-2">Answer</p>
            {q.type === "mcq" && (
              <p className="text-sm mb-2">
                <span className="font-medium">{q.correctLabel}.</span>{" "}
                {q.choices.find((c) => c.label === q.correctLabel)?.text}
              </p>
            )}
            {q.type === "short" && (
              <p className="text-sm mb-2">{q.correctAnswer}</p>
            )}
            {q.type === "recall" && (
              <ul className="text-sm mb-2 list-disc pl-5 space-y-1">
                {q.expectedPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {q.rationale}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          Score: {score.correct}/{score.answered}
        </p>
        {!revealed ? (
          <button
            type="button"
            className="btn-primary"
            disabled={answer.trim().length === 0}
            onClick={submit}
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={isLast}
            onClick={next}
          >
            {isLast ? "All done" : "Next question"}
          </button>
        )}
      </div>
    </div>
  );
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
