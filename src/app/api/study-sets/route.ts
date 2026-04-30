import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import {
  db,
  documents,
  studySets,
  questions as questionsTable,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import { generationSystem, generationUser } from "@/lib/prompts";
import { listWeakest } from "@/lib/mastery";
import type { ExtractedDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

type GeneratedQuestion =
  | {
      type: "mcq";
      stem: string;
      choices: { label: string; text: string }[];
      correctLabel: string;
      rationale: string;
      topic: string;
    }
  | {
      type: "short";
      stem: string;
      correctAnswer: string;
      rationale: string;
      topic: string;
    }
  | {
      type: "recall";
      stem: string;
      expectedPoints: string[];
      rationale: string;
      topic: string;
    };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: { documentId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = body.documentId;
  if (!documentId) {
    return Response.json({ error: "documentId required" }, { status: 400 });
  }

  const docRows = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .limit(1)
    .all();
  const doc = docRows[0];
  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const weakness = listWeakest(user.id, 8)
    .filter((m) => m.attempts >= 2 && m.masteryScore < 0.7)
    .map((m) => ({
      topic: m.topic,
      accuracyPct: Math.round((m.correct / Math.max(m.attempts, 1)) * 100),
      attempts: m.attempts,
    }));

  const extractedDoc: ExtractedDoc = {
    name: doc.title,
    text: doc.sourceText,
    wordCount: doc.wordCount,
  };

  const client = anthropic();
  let rawJson: string;
  try {
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 16000,
      system: generationSystem(),
      messages: [
        {
          role: "user",
          content: generationUser([extractedDoc], weakness),
        },
      ],
    });
    const part = response.content.find((c) => c.type === "text");
    if (!part || part.type !== "text") {
      throw new Error("No text content returned from Claude");
    }
    rawJson = part.text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Generation failed: ${msg}` },
      { status: 502 }
    );
  }

  let parsed: {
    mindMapMarkdown: string;
    quizQuestions: GeneratedQuestion[];
    voiceAgentPrompt: string;
  };
  try {
    parsed = JSON.parse(stripCodeFence(rawJson));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        error: `Model returned malformed JSON: ${msg}`,
        rawSample: rawJson.slice(0, 500),
      },
      { status: 502 }
    );
  }

  if (
    !parsed.mindMapMarkdown ||
    !Array.isArray(parsed.quizQuestions) ||
    parsed.quizQuestions.length === 0 ||
    !parsed.voiceAgentPrompt
  ) {
    return Response.json(
      { error: "Generation returned incomplete content" },
      { status: 502 }
    );
  }

  const studySetId = createId();
  const now = Date.now();

  db.transaction((tx) => {
    tx.insert(studySets)
      .values({
        id: studySetId,
        userId: user.id,
        documentId,
        mindMapMarkdown: parsed.mindMapMarkdown,
        voiceAgentPrompt: parsed.voiceAgentPrompt,
        createdAt: now,
      })
      .run();
    parsed.quizQuestions.forEach((q, i) => {
      const qid = createId();
      tx.insert(questionsTable)
        .values({
          id: qid,
          studySetId,
          type: q.type,
          topic: q.topic ?? "General",
          stem: q.stem,
          payloadJson: JSON.stringify(stripTopicAndStem(q)),
          rationale: q.rationale,
          orderIndex: i,
        })
        .run();
    });
  });

  return Response.json({ studySetId });
}

function stripTopicAndStem(q: GeneratedQuestion): unknown {
  const { ...rest } = q;
  return rest;
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
