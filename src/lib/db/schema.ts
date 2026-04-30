import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

export const magicTokens = sqliteTable("magic_tokens", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceText: text("source_text").notNull(),
    wordCount: integer("word_count").notNull(),
    sourceType: text("source_type").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("documents_user_idx").on(t.userId)]
);

export const studySets = sqliteTable(
  "study_sets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    mindMapMarkdown: text("mind_map_markdown").notNull(),
    voiceAgentPrompt: text("voice_agent_prompt").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("study_sets_user_idx").on(t.userId),
    index("study_sets_document_idx").on(t.documentId),
  ]
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    studySetId: text("study_set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    topic: text("topic").notNull(),
    stem: text("stem").notNull(),
    payloadJson: text("payload_json").notNull(),
    rationale: text("rationale").notNull(),
    orderIndex: integer("order_index").notNull(),
  },
  (t) => [
    index("questions_set_idx").on(t.studySetId),
    index("questions_topic_idx").on(t.topic),
  ]
);

export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    studySetId: text("study_set_id").notNull(),
    userAnswer: text("user_answer"),
    isCorrect: integer("is_correct").notNull(),
    confidence: text("confidence"),
    msToAnswer: integer("ms_to_answer"),
    answeredAt: integer("answered_at").notNull(),
  },
  (t) => [
    index("attempts_user_idx").on(t.userId),
    index("attempts_question_idx").on(t.questionId),
    index("attempts_set_idx").on(t.studySetId),
  ]
);

export const voiceSessions = sqliteTable(
  "voice_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studySetId: text("study_set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    transcriptJson: text("transcript_json").notNull(),
    strugglesJson: text("struggles_json"),
    durationMs: integer("duration_ms"),
    endedAt: integer("ended_at").notNull(),
  },
  (t) => [
    index("voice_user_idx").on(t.userId),
    index("voice_set_idx").on(t.studySetId),
  ]
);

export const topicMastery = sqliteTable(
  "topic_mastery",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    attempts: integer("attempts").notNull(),
    correct: integer("correct").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    masteryScore: real("mastery_score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topic] })]
);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type StudySet = typeof studySets.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type TopicMastery = typeof topicMastery.$inferSelect;
