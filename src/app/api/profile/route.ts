import { desc, eq } from "drizzle-orm";
import { db, voiceSessions, studySets, documents } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listMastery } from "@/lib/mastery";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const mastery = listMastery(user.id);

  const voice = db
    .select({
      id: voiceSessions.id,
      studySetId: voiceSessions.studySetId,
      durationMs: voiceSessions.durationMs,
      endedAt: voiceSessions.endedAt,
      strugglesJson: voiceSessions.strugglesJson,
      documentTitle: documents.title,
    })
    .from(voiceSessions)
    .leftJoin(studySets, eq(studySets.id, voiceSessions.studySetId))
    .leftJoin(documents, eq(documents.id, studySets.documentId))
    .where(eq(voiceSessions.userId, user.id))
    .orderBy(desc(voiceSessions.endedAt))
    .limit(10)
    .all();

  return Response.json({
    email: user.email,
    mastery: mastery.map((m) => ({
      topic: m.topic,
      attempts: m.attempts,
      correct: m.correct,
      accuracyPct: Math.round((m.correct / Math.max(m.attempts, 1)) * 100),
      masteryScore: m.masteryScore,
      lastSeenAt: m.lastSeenAt,
    })),
    recentVoice: voice.map((v) => ({
      id: v.id,
      documentTitle: v.documentTitle ?? "(deleted)",
      durationMs: v.durationMs,
      endedAt: v.endedAt,
      struggles: v.strugglesJson ? JSON.parse(v.strugglesJson) : [],
    })),
  });
}
