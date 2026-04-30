import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, studySets, documents } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listWeakest, formatWeaknessBlock } from "@/lib/mastery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const studySetId = request.nextUrl.searchParams.get("studySetId");
  if (!studySetId) {
    return Response.json({ error: "studySetId required" }, { status: 400 });
  }

  const setRows = db
    .select({
      id: studySets.id,
      documentId: studySets.documentId,
      voiceAgentPrompt: studySets.voiceAgentPrompt,
    })
    .from(studySets)
    .where(and(eq(studySets.id, studySetId), eq(studySets.userId, user.id)))
    .limit(1)
    .all();
  const set = setRows[0];
  if (!set) {
    return Response.json({ error: "Study set not found" }, { status: 404 });
  }

  const docRows = db
    .select({ title: documents.title })
    .from(documents)
    .where(eq(documents.id, set.documentId))
    .limit(1)
    .all();
  const docTitle = docRows[0]?.title ?? "your material";

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured" },
      { status: 500 }
    );
  }
  if (!agentId) {
    return Response.json(
      { error: "ELEVENLABS_AGENT_ID is not configured" },
      { status: 500 }
    );
  }

  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  url.searchParams.set("agent_id", agentId);

  let tokenResp: Response;
  try {
    tokenResp = await fetch(url.toString(), {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Could not reach ElevenLabs: ${msg}` },
      { status: 502 }
    );
  }

  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    return Response.json(
      {
        error: `ElevenLabs token request failed (${tokenResp.status})`,
        details: body.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const tokenJson = (await tokenResp.json()) as { token?: string };
  if (!tokenJson.token) {
    return Response.json(
      { error: "ElevenLabs did not return a token" },
      { status: 502 }
    );
  }

  const weakness = listWeakest(user.id, 6).filter(
    (m) => m.attempts >= 2 && m.masteryScore < 0.7
  );
  const weaknessBlock = formatWeaknessBlock(weakness);
  const systemPromptOverride = weaknessBlock
    ? `${set.voiceAgentPrompt}\n\n---\n${weaknessBlock}`
    : set.voiceAgentPrompt;

  return Response.json({
    conversationToken: tokenJson.token,
    systemPromptOverride,
    firstMessage: buildGreeting(docTitle, weakness.length > 0),
    dynamicVariables: {
      user_id: user.id,
      study_set_id: studySetId,
    },
  });
}

function buildGreeting(topic: string, hasWeakness: boolean): string {
  if (hasWeakness) {
    return `Ready when you are. We're going to work through ${topic} — I'll lean on the topics you've been struggling with. Let me know when you're set.`;
  }
  return `Ready when you are. We're going to work through ${topic}. Let me know when you're set and I'll start with the first question.`;
}
