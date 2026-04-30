import { and, asc, eq, inArray } from "drizzle-orm";
import { db, topicMastery, type TopicMastery } from "@/lib/db";

const ALPHA = 0.3;

export function recordAttempt(
  userId: string,
  topic: string,
  isCorrect: boolean,
  now: number = Date.now()
): void {
  const existing = db
    .select()
    .from(topicMastery)
    .where(and(eq(topicMastery.userId, userId), eq(topicMastery.topic, topic)))
    .limit(1)
    .all();

  const result = isCorrect ? 1 : 0;
  if (existing.length === 0) {
    db.insert(topicMastery)
      .values({
        userId,
        topic,
        attempts: 1,
        correct: result,
        lastSeenAt: now,
        masteryScore: result,
      })
      .run();
    return;
  }

  const prev = existing[0];
  const newScore = (1 - ALPHA) * prev.masteryScore + ALPHA * result;
  db.update(topicMastery)
    .set({
      attempts: prev.attempts + 1,
      correct: prev.correct + result,
      lastSeenAt: now,
      masteryScore: newScore,
    })
    .where(and(eq(topicMastery.userId, userId), eq(topicMastery.topic, topic)))
    .run();
}

export function listMastery(userId: string): TopicMastery[] {
  return db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, userId))
    .orderBy(asc(topicMastery.masteryScore))
    .all();
}

export function listWeakest(userId: string, limit = 8): TopicMastery[] {
  return db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, userId))
    .orderBy(asc(topicMastery.masteryScore))
    .limit(limit)
    .all();
}

export function masteryByTopics(
  userId: string,
  topics: string[]
): Map<string, TopicMastery> {
  if (topics.length === 0) return new Map();
  const rows = db
    .select()
    .from(topicMastery)
    .where(
      and(eq(topicMastery.userId, userId), inArray(topicMastery.topic, topics))
    )
    .all();
  return new Map(rows.map((r) => [r.topic, r]));
}

export function formatWeaknessBlock(mastery: TopicMastery[]): string {
  if (mastery.length === 0) return "";
  const lines = mastery.map((m) => {
    const pct = Math.round((m.correct / Math.max(m.attempts, 1)) * 100);
    return `- ${m.topic}: ${pct}% correct across ${m.attempts} attempt${m.attempts === 1 ? "" : "s"} (mastery score ${m.masteryScore.toFixed(2)})`;
  });
  return [
    "Past struggles for this student — recent topic mastery (lower score = weaker):",
    ...lines,
    "",
    "Prioritize probing the weaker topics above. Generate follow-ups that target these gaps. Skim over already-strong topics.",
  ].join("\n");
}
