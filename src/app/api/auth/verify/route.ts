import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import {
  db,
  magicTokens,
  users,
  sessions as sessionsTable,
} from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signSessionCookieValue,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return redirectTo("/login?error=missing");

  const rows = db
    .select()
    .from(magicTokens)
    .where(eq(magicTokens.token, token))
    .limit(1)
    .all();
  const record = rows[0];
  if (!record) return redirectTo("/login?error=invalid");
  if (record.consumedAt) return redirectTo("/login?error=used");
  if (record.expiresAt < Date.now()) return redirectTo("/login?error=expired");

  const email = record.email;
  const now = Date.now();

  db.update(magicTokens)
    .set({ consumedAt: now })
    .where(eq(magicTokens.token, token))
    .run();

  const existing = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .all();

  let userId: string;
  if (existing.length === 0) {
    userId = createId();
    db.insert(users)
      .values({ id: userId, email, name: null, createdAt: now })
      .run();
  } else {
    userId = existing[0].id;
  }

  const sessionId = randomBytes(24).toString("hex");
  db.insert(sessionsTable)
    .values({
      id: sessionId,
      userId,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
    })
    .run();

  const cookieValue = signSessionCookieValue(sessionId);

  const response = new Response(null, {
    status: 302,
    headers: { Location: "/" },
  });
  response.headers.append(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, cookieValue, SESSION_TTL_MS)
  );
  return response;
}

function redirectTo(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: path },
  });
}

function serializeCookie(
  name: string,
  value: string,
  maxAgeMs: number
): string {
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
