import { NextRequest } from "next/server";
import { newSessionId, putSession } from "@/lib/sessionStore";
import { wordCount } from "@/lib/parsers";
import type { ExtractedDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_CHARS = 500_000;
const MIN_BODY_CHARS = 200;

export async function POST(request: NextRequest) {
  let body: { text?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const title = (body.title ?? "Pasted notes").trim().slice(0, 120) || "Pasted notes";

  if (text.length < MIN_BODY_CHARS) {
    return Response.json(
      { error: `Please paste at least ${MIN_BODY_CHARS} characters of notes.` },
      { status: 400 }
    );
  }
  if (text.length > MAX_BODY_CHARS) {
    return Response.json(
      { error: `That's over ${MAX_BODY_CHARS.toLocaleString()} characters. Try a smaller chunk.` },
      { status: 400 }
    );
  }

  const extracted: ExtractedDoc[] = [
    { name: title, text, wordCount: wordCount(text) },
  ];

  const sessionId = newSessionId();
  putSession({ sessionId, extracted, createdAt: Date.now() });

  return Response.json({
    sessionId,
    extracted: extracted.map((e) => ({ name: e.name, wordCount: e.wordCount })),
  });
}
