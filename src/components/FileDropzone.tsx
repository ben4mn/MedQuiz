"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onFilesChanged: (files: File[]) => void;
  maxFiles?: number;
  maxBytes?: number;
  disabled?: boolean;
};

const ACCEPT =
  ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function FileDropzone({
  onFilesChanged,
  maxFiles = 3,
  maxBytes = 10 * 1024 * 1024,
  disabled = false,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      if (arr.length === 0) {
        setError("No files received from the picker.");
        return;
      }

      const rejected: string[] = [];
      const allowed = arr.filter((f) => {
        const lower = f.name.toLowerCase();
        const type = (f.type || "").toLowerCase();
        const okExt = lower.endsWith(".docx") || lower.endsWith(".pdf");
        const okMime =
          type === "application/pdf" ||
          type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (okExt || okMime) return true;
        rejected.push(
          `${f.name || "unnamed"} (${type || "no type"}, ${f.size} bytes)`
        );
        return false;
      });

      if (allowed.length === 0) {
        setError(
          `Couldn't accept: ${rejected.join(
            ", "
          )}. Only .docx and .pdf files are supported.`
        );
        return;
      }

      const oversized = allowed.find((f) => f.size > maxBytes);
      if (oversized) {
        setError(`"${oversized.name}" is larger than 10 MB.`);
        return;
      }
      const byName = new Map<string, File>();
      for (const f of [...files, ...allowed]) byName.set(f.name, f);
      const merged = Array.from(byName.values()).slice(0, maxFiles);
      if (files.length + allowed.length > maxFiles) {
        setError(`Maximum ${maxFiles} files. Keeping the first ${maxFiles}.`);
      } else if (rejected.length > 0) {
        setError(`Skipped unsupported: ${rejected.join(", ")}`);
      } else {
        setError(null);
      }
      setFiles(merged);
      onFilesChanged(merged);
    },
    [files, maxBytes, maxFiles, onFilesChanged]
  );

  const removeFile = (name: string) => {
    const next = files.filter((f) => f.name !== name);
    setFiles(next);
    onFilesChanged(next);
    setError(null);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="medquiz-file-input"
        className={`block rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-slate-300 bg-white hover:bg-slate-50"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          if (e.dataTransfer.files.length > 0) accept(e.dataTransfer.files);
        }}
      >
        <input
          id="medquiz-file-input"
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              accept(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <p className="text-base mb-2">
          Tap to upload up to {maxFiles} chapter files
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">
          .docx or .pdf · 10 MB max each
        </p>
        <span
          className="inline-block btn-secondary pointer-events-none"
          aria-hidden="true"
        >
          Choose files
        </span>
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between rounded-lg bg-white px-4 py-2 border border-slate-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {(f.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => removeFile(f.name)}
                  className="text-sm text-[var(--muted)] hover:text-slate-900 px-2"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-[var(--muted)] shrink-0"
    >
      <path d="M14 3v5h5M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    </svg>
  );
}
