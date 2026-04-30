import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  studySets,
  questions as questionsTable,
  documents,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const setRows = db
    .select()
    .from(studySets)
    .where(and(eq(studySets.id, id), eq(studySets.userId, user.id)))
    .limit(1)
    .all();
  const set = setRows[0];
  if (!set) return Response.json({ error: "Not found" }, { status: 404 });

  const docRows = db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(eq(documents.id, set.documentId))
    .limit(1)
    .all();

  const qRows = db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.studySetId, id))
    .orderBy(asc(questionsTable.orderIndex))
    .all();

  return Response.json({
    studySet: {
      id: set.id,
      documentId: set.documentId,
      documentTitle: docRows[0]?.title ?? "Untitled",
      mindMapMarkdown: set.mindMapMarkdown,
      voiceAgentPrompt: set.voiceAgentPrompt,
      createdAt: set.createdAt,
      questions: qRows.map((q) => ({
        id: q.id,
        type: q.type,
        topic: q.topic,
        stem: q.stem,
        payload: JSON.parse(q.payloadJson),
        rationale: q.rationale,
      })),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const result = db
    .delete(studySets)
    .where(and(eq(studySets.id, id), eq(studySets.userId, user.id)))
    .run();
  if (result.changes === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
