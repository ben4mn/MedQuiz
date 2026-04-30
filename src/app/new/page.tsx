"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

const FileDropzone = dynamic(() => import("@/components/FileDropzone"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-[var(--muted)] text-sm">
      Loading upload...
    </div>
  ),
});

type Phase = "idle" | "saving" | "generating" | "error";
type Mode = "paste" | "upload";

export default function NewDocumentPage() {
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const busy = phase === "saving" || phase === "generating";

  const start = async () => {
    setErrorMsg(null);
    setPhase("saving");
    try {
      let documentId: string;
      if (mode === "paste") {
        if (text.trim().length < 200) {
          throw new Error("Please paste at least a couple paragraphs.");
        }
        const resp = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            title: title.trim() || "Pasted notes",
          }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Save failed (${resp.status})`);
        }
        const { documents: created } = (await resp.json()) as {
          documents: { id: string }[];
        };
        documentId = created[0].id;
      } else {
        if (files.length === 0) throw new Error("Pick at least one file.");
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const resp = await fetch("/api/documents", {
          method: "POST",
          body: fd,
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed (${resp.status})`);
        }
        const { documents: created } = (await resp.json()) as {
          documents: { id: string }[];
        };
        documentId = created[0].id;
      }

      setPhase("generating");
      const genResp = await fetch("/api/study-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!genResp.ok) {
        const body = await genResp.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${genResp.status})`);
      }
      const { studySetId } = (await genResp.json()) as { studySetId: string };
      router.push(`/study/${studySetId}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const ready =
    mode === "paste" ? text.trim().length >= 200 : files.length > 0;
  const pastedWords = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl mb-2">Add new notes</h1>
            <p className="text-sm text-[var(--muted)]">
              Paste a chapter or upload a file. We&apos;ll build your study set.
            </p>
          </header>

          <div role="tablist" className="flex border border-slate-200 rounded-lg p-1 bg-white mb-5">
            <Tab active={mode === "paste"} disabled={busy} onClick={() => setMode("paste")}>
              Paste text
            </Tab>
            <Tab active={mode === "upload"} disabled={busy} onClick={() => setMode("upload")}>
              Upload files
            </Tab>
          </div>

          {mode === "paste" ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="nd-title" className="block text-sm text-[var(--muted)] mb-1">
                  Topic or chapter name (optional)
                </label>
                <input
                  id="nd-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Renal – Hypertension Treatment"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label htmlFor="nd-text" className="block text-sm text-[var(--muted)] mb-1">
                  Paste your notes
                </label>
                <textarea
                  id="nd-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  rows={14}
                  placeholder="Select all (Cmd+A), copy, paste here."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-relaxed focus:outline-none focus:border-[var(--accent)] font-mono"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {pastedWords > 0
                    ? `${pastedWords.toLocaleString()} words pasted`
                    : "A full chapter works best."}
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
              {phase === "saving"
                ? "Saving notes..."
                : phase === "generating"
                  ? "Building study set..."
                  : "Save and generate"}
            </button>
          </div>

          {phase === "error" && errorMsg && (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium mb-1">Something went wrong.</p>
              <p>{errorMsg}</p>
              <button type="button" onClick={() => setPhase("idle")} className="mt-3 text-red-800 underline">
                Try again
              </button>
            </div>
          )}

          {phase === "generating" && (
            <p className="mt-6 text-sm text-[var(--muted)] text-center">
              Claude is reading every page. This usually takes under a minute.
            </p>
          )}
        </div>
      </main>
    </>
  );
}

function Tab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
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
