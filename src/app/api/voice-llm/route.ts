import { NextRequest } from "next/server";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import {
  translateRequest,
  streamAnthropicAsOpenAI,
  completeAnthropicAsOpenAI,
  type OpenAIChatRequest,
} from "@/lib/openai-to-anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: OpenAIChatRequest;
  try {
    body = (await request.json()) as OpenAIChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  const input = translateRequest(body);
  const client = anthropic();
  const requestedModelName = body.model || "medquiz-claude";

  try {
    if (body.stream === false) {
      return await completeAnthropicAsOpenAI(
        client,
        MODEL_FAST,
        input,
        requestedModelName
      );
    }
    return await streamAnthropicAsOpenAI(
      client,
      MODEL_FAST,
      input,
      requestedModelName
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Upstream LLM failure: ${msg}` },
      { status: 502 }
    );
  }
}
