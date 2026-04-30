import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, max as sqlMax } from "drizzle-orm";
import {
  db,
  studySets,
  questions as questionsTable,
  documents,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import { drillSystem, drillUser } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

type GeneratedMCQ = {
  type: "mcq";
  stem: string;
  choices: { label: string; text: string }[];
  correctLabel: string;
  rationale: string;
  topic: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id: studySetId } = await params;

  let body: { topics?: string[]; count?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topics = (body.topics ?? []).filter((t) => typeof t === "string" && t.trim());
  if (topics.length === 0) {
    return Response.json({ error: "topics array required" }, { status: 400 });
  }
  const count = Math.min(Math.max(body.count ?? 8, 3), 15);

  const setRows = db
    .select()
    .from(studySets)
    .where(and(eq(studySets.id, studySetId), eq(studySets.userId, user.id)))
    .limit(1)
    .all();
  const set = setRows[0];
  if (!set) return Response.json({ error: "Not found" }, { status: 404 });

  const docRows = db
    .select()
    .from(documents)
    .where(eq(documents.id, set.documentId))
    .limit(1)
    .all();
  const doc = docRows[0];
  if (!doc)
    return Response.json({ error: "Source document missing" }, { status: 404 });

  const client = anthropic();
  let rawJson: string;
  try {
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 8000,
      system: drillSystem(),
      messages: [
        {
          role: "user",
          content: drillUser(doc.sourceText, doc.title, topics, count),
        },
      ],
    });
    const part = response.content.find((c) => c.type === "text");
    if (!part || part.type !== "text") {
      throw new Error("No text from Claude");
    }
    rawJson = part.text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Drill generation failed: ${msg}` }, { status: 502 });
  }

  let parsed: { questions: GeneratedMCQ[] };
  try {
    parsed = JSON.parse(stripCodeFence(rawJson));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Model returned malformed JSON: ${msg}` },
      { status: 502 }
    );
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    return Response.json(
      { error: "Drill returned no questions" },
      { status: 502 }
    );
  }

  const maxRow = db
    .select({ m: sqlMax(questionsTable.orderIndex) })
    .from(questionsTable)
    .where(eq(questionsTable.studySetId, studySetId))
    .all();
  let nextIndex = (maxRow[0]?.m ?? -1) + 1;

  const insertedIds: string[] = [];
  db.transaction((tx) => {
    for (const q of parsed.questions) {
      const qid = createId();
      tx.insert(questionsTable)
        .values({
          id: qid,
          studySetId,
          type: "mcq",
          topic: q.topic ?? topics[0],
          stem: q.stem,
          payloadJson: JSON.stringify(q),
          rationale: q.rationale,
          orderIndex: nextIndex++,
        })
        .run();
      insertedIds.push(qid);
    }
  });

  return Response.json({ addedQuestionIds: insertedIds });
}

function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    const firstNl = trimmed.indexOf("\n");
    const withoutOpen = trimmed.slice(firstNl + 1);
    const endIdx = withoutOpen.lastIndexOf("```");
    return endIdx >= 0 ? withoutOpen.slice(0, endIdx).trim() : withoutOpen.trim();
  }
  return trimmed;
}
