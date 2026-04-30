"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FileDropzone = dynamic(() => import("@/components/FileDropzone"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-[var(--muted)] text-sm">
      Loading upload...
    </div>
  ),
});

type Phase = "idle" | "uploading" | "generating" | "error";
type Mode = "paste" | "upload";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const busy = phase === "uploading" || phase === "generating";

  const start = async () => {
    setErrorMsg(null);
    setPhase("uploading");

    try {
      let sessionId: string;

      if (mode === "paste") {
        if (text.trim().length < 200) {
          throw new Error("Please paste at least a couple paragraphs of notes.");
        }
        const resp = await fetch("/api/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            title: title.trim() || "Pasted notes",
          }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Paste failed (${resp.status})`);
        }
        ({ sessionId } = (await resp.json()) as { sessionId: string });
      } else {
        if (files.length === 0) {
          throw new Error("Pick at least one file first.");
        }
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const resp = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed (${resp.status})`);
        }
        ({ sessionId } = (await resp.json()) as { sessionId: string });
      }

      setPhase("generating");
      const genResp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!genResp.ok) {
        const body = await genResp.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${genResp.status})`);
      }

      router.push(`/study?s=${encodeURIComponent(sessionId)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  const ready =
    mode === "paste"
      ? text.trim().length >= 200
      : files.length > 0;

  const pastedWords = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <main className="flex-1 flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl mt-6 sm:mt-12">
        <header className="text-center mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl mb-3">MedQuiz</h1>
          <p className="text-base sm:text-lg text-[var(--muted)]">
            Paste your chapter notes. Get a mind map, a quiz, and a voice tutor.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Input method"
          className="flex border border-slate-200 rounded-lg p-1 bg-white mb-5"
        >
          <TabOption
            active={mode === "paste"}
            onClick={() => setMode("paste")}
            disabled={busy}
          >
            Paste text
          </TabOption>
          <TabOption
            active={mode === "upload"}
            onClick={() => setMode("upload")}
            disabled={busy}
          >
            Upload files
          </TabOption>
        </div>

        {mode === "paste" ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="mq-title"
                className="block text-sm text-[var(--muted)] mb-1"
              >
                Topic or chapter name (optional)
              </label>
              <input
                id="mq-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                placeholder="e.g. Renal – Hypertension Treatment"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label
                htmlFor="mq-text"
                className="block text-sm text-[var(--muted)] mb-1"
              >
                Paste your notes
              </label>
              <textarea
                id="mq-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
                rows={14}
                placeholder="Select the text in your Word doc (Cmd+A), copy (Cmd+C), and paste here (Cmd+V)."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-relaxed focus:outline-none focus:border-[var(--accent)] font-mono"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                {pastedWords > 0
                  ? `${pastedWords.toLocaleString()} words pasted`
                  : "Minimum ~40 words. More is better — a full chapter is ideal."}
              </p>
            </div>
          </div>
        ) : (
          <FileDropzone onFilesChanged={setFiles} disabled={busy} />
        )}

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={!ready || busy}
            onClick={start}
          >
            {phase === "uploading"
              ? "Reading your notes..."
              : phase === "generating"
                ? "Preparing your study set..."
                : "Start studying"}
          </button>
        </div>

        {phase === "error" && errorMsg && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-medium mb-1">Something went wrong.</p>
            <p>{errorMsg}</p>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="mt-3 text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {phase === "generating" && (
          <p className="mt-6 text-sm text-[var(--muted)] text-center">
            This takes up to a minute. Claude is reading every page.
          </p>
        )}
      </div>
    </main>
  );
}

function TabOption({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--muted)] hover:text-slate-900"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {children}
    </button>
  );
}
