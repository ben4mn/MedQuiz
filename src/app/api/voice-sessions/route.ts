import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { db, voiceSessions, studySets } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import { recordAttempt } from "@/lib/mastery";

export const runtime = "nodejs";
export const maxDuration = 60;

type Turn = { role: "user" | "agent"; text: string; at: number };

type Struggle = { topic: string; note: string };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    studySetId?: string;
    transcript?: Turn[];
    durationMs?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.studySetId || !Array.isArray(body.transcript)) {
    return Response.json(
      { error: "studySetId and transcript array required" },
      { status: 400 }
    );
  }

  const setRows = db
    .select()
    .from(studySets)
    .where(
      and(eq(studySets.id, body.studySetId), eq(studySets.userId, user.id))
    )
    .limit(1)
    .all();
  if (setRows.length === 0) {
    return Response.json({ error: "Study set not found" }, { status: 404 });
  }

  const id = createId();
  const now = Date.now();

  db.insert(voiceSessions)
    .values({
      id,
      userId: user.id,
      studySetId: body.studySetId,
      transcriptJson: JSON.stringify(body.transcript),
      strugglesJson: null,
      durationMs: body.durationMs ?? null,
      endedAt: now,
    })
    .run();

  let struggles: Struggle[] = [];
  if (body.transcript.length >= 2) {
    try {
      struggles = await summarizeStruggles(body.transcript);
    } catch (e) {
      console.error("Failed to summarize voice session:", e);
    }
  }

  if (struggles.length > 0) {
    db.update(voiceSessions)
      .set({ strugglesJson: JSON.stringify(struggles) })
      .where(eq(voiceSessions.id, id))
      .run();

    for (const s of struggles) {
      recordAttempt(user.id, s.topic, false, now);
    }
  }

  return Response.json({ id, struggles });
}

async function summarizeStruggles(transcript: Turn[]): Promise<Struggle[]> {
  const client = anthropic();
  const formatted = transcript
    .map((t) => `${t.role === "user" ? "Student" : "Tutor"}: ${t.text}`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 800,
    system: [
      "You are reviewing a voice quiz transcript between a medical tutor and a student.",
      "Identify up to 5 specific topics where the student struggled, hesitated, got a partial answer, or got something wrong.",
      "Return ONLY valid JSON. No prose, no backticks.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "Transcript follows. Identify the specific topics where the student struggled.",
          "",
          'Return: { "struggles": [{ "topic": "short topic label", "note": "one-sentence description of what they got wrong or couldn\'t answer" }] }',
          "If the student did well overall, return an empty struggles array.",
          "",
          "=== TRANSCRIPT ===",
          formatted,
        ].join("\n"),
      },
    ],
  });

  const part = response.content.find((c) => c.type === "text");
  if (!part || part.type !== "text") return [];
  const raw = part.text.trim();
  const cleaned = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\n?/, "").replace(/```$/, "").trim()
    : raw;

  try {
    const parsed = JSON.parse(cleaned) as { struggles?: Struggle[] };
    return Array.isArray(parsed.struggles) ? parsed.struggles.slice(0, 5) : [];
  } catch {
    return [];
  }
}
