import { NextRequest } from "next/server";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import { generationSystem, generationUser } from "@/lib/prompts";
import { getSession, updateSession } from "@/lib/sessionStore";
import type { GeneratedContent, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (session.generated) {
    return Response.json(session.generated);
  }

  const client = anthropic();

  let rawJson: string;
  try {
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 16000,
      system: generationSystem(),
      messages: [{ role: "user", content: generationUser(session.extracted) }],
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
    quizQuestions: Omit<QuizQuestion, "id">[];
    voiceAgentPrompt: string;
  };
  try {
    const cleaned = stripCodeFence(rawJson);
    parsed = JSON.parse(cleaned);
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

  const quizQuestions: QuizQuestion[] = parsed.quizQuestions.map((q, i) => ({
    ...q,
    id: `q${i + 1}`,
  })) as QuizQuestion[];

  const generated: GeneratedContent = {
    sessionId,
    sources: session.extracted.map((e) => ({
      name: e.name,
      wordCount: e.wordCount,
    })),
    mindMapMarkdown: parsed.mindMapMarkdown,
    quizQuestions,
    voiceAgentPrompt: parsed.voiceAgentPrompt,
    createdAt: Date.now(),
  };

  updateSession(sessionId, { generated });

  return Response.json(generated);
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
