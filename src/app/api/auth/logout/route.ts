import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, sessions as sessionsTable } from "@/lib/db";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    const sessionId = verifySessionCookieValue(raw);
    if (sessionId) {
      db.delete(sessionsTable)
        .where(eq(sessionsTable.id, sessionId))
        .run();
    }
  }
  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
