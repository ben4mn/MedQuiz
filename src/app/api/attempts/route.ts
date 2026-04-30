import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  quizAttempts,
  questions as questionsTable,
  studySets,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAttempt } from "@/lib/mastery";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    questionId?: string;
    userAnswer?: string;
    isCorrect?: boolean;
    msToAnswer?: number;
    confidence?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.questionId || typeof body.isCorrect !== "boolean") {
    return Response.json(
      { error: "questionId and isCorrect (boolean) are required" },
      { status: 400 }
    );
  }

  const qRows = db
    .select({
      id: questionsTable.id,
      topic: questionsTable.topic,
      studySetId: questionsTable.studySetId,
      setUserId: studySets.userId,
    })
    .from(questionsTable)
    .innerJoin(studySets, eq(studySets.id, questionsTable.studySetId))
    .where(eq(questionsTable.id, body.questionId))
    .limit(1)
    .all();
  const q = qRows[0];
  if (!q) return Response.json({ error: "Question not found" }, { status: 404 });
  if (q.setUserId !== user.id) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const now = Date.now();
  const attemptId = createId();

  db.insert(quizAttempts)
    .values({
      id: attemptId,
      userId: user.id,
      questionId: body.questionId,
      studySetId: q.studySetId,
      userAnswer: body.userAnswer ?? null,
      isCorrect: body.isCorrect ? 1 : 0,
      confidence: body.confidence ?? null,
      msToAnswer: body.msToAnswer ?? null,
      answeredAt: now,
    })
    .run();

  recordAttempt(user.id, q.topic, body.isCorrect, now);

  return Response.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const studySetId = request.nextUrl.searchParams.get("studySetId");
  const base = db
    .select({
      id: quizAttempts.id,
      questionId: quizAttempts.questionId,
      studySetId: quizAttempts.studySetId,
      isCorrect: quizAttempts.isCorrect,
      answeredAt: quizAttempts.answeredAt,
    })
    .from(quizAttempts)
    .where(
      studySetId
        ? and(
            eq(quizAttempts.userId, user.id),
            eq(quizAttempts.studySetId, studySetId)
          )
        : eq(quizAttempts.userId, user.id)
    )
    .orderBy(desc(quizAttempts.answeredAt))
    .limit(200)
    .all();

  return Response.json({ attempts: base });
}
