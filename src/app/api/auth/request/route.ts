import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db, magicTokens } from "@/lib/db";
import { isEmailAllowed } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

export const runtime = "nodejs";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    // Don't reveal whether the email is on the allowlist.
    return Response.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.insert(magicTokens)
    .values({
      token,
      email,
      expiresAt: now + TOKEN_TTL_MS,
      consumedAt: null,
    })
    .run();

  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLink(email, verifyUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Could not send email: ${msg}` },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
