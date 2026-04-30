import { NextRequest } from "next/server";
import { getSession } from "@/lib/sessionStore";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = getSession(sessionId);
  if (!session || !session.generated) {
    return Response.json(
      { error: "Session not found or content not generated yet" },
      { status: 404 }
    );
  }

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

  const url = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/token"
  );
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

  return Response.json({
    conversationToken: tokenJson.token,
    systemPromptOverride: session.generated.voiceAgentPrompt,
    firstMessage: buildGreeting(session.generated.sources.map((s) => s.name)),
  });
}

function buildGreeting(sourceNames: string[]): string {
  if (sourceNames.length === 0) {
    return "Ready when you are. Let's start with a question.";
  }
  const topic = guessTopic(sourceNames);
  return `Ready when you are. We're going to work through ${topic}. Let me know when you're set and I'll start with the first question.`;
}

function guessTopic(names: string[]): string {
  const stripped = names
    .map((n) => n.replace(/\.(docx|pdf)$/i, "").replace(/^\d+[\s._-]*/, ""))
    .join(", ");
  return stripped || "your material";
}
