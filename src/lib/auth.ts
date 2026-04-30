import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, users, sessions, type User } from "@/lib/db";

export const SESSION_COOKIE = "mq_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET is not set or too short (set a 32+ char random value in .env.local)"
    );
  }
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function signSessionCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function verifySessionCookieValue(raw: string): string | null {
  const idx = raw.lastIndexOf(".");
  if (idx < 0) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(id);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return id;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sessionId = verifySessionCookieValue(raw);
  if (!sessionId) return null;

  const rows = db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
    .all();
  const session = rows[0];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  const userRows = db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)
    .all();
  return userRows[0] ?? null;
}

export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
