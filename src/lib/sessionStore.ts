import type { SessionData } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __medquizSessions: Map<string, SessionData> | undefined;
}

const store = globalThis.__medquizSessions ?? new Map<string, SessionData>();
globalThis.__medquizSessions = store;

const MAX_AGE_MS = 1000 * 60 * 60 * 6;

function gc() {
  const now = Date.now();
  for (const [id, s] of store.entries()) {
    if (now - s.createdAt > MAX_AGE_MS) store.delete(id);
  }
}

export function putSession(session: SessionData): void {
  gc();
  store.set(session.sessionId, session);
}

export function getSession(id: string): SessionData | undefined {
  return store.get(id);
}

export function updateSession(
  id: string,
  patch: Partial<SessionData>
): SessionData | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  return updated;
}

export function newSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
