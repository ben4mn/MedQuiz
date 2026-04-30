import { NextRequest } from "next/server";
import { anthropic, MODEL_FAST } from "@/lib/anthropic";
import {
  translateRequest,
  streamAnthropicAsOpenAI,
  completeAnthropicAsOpenAI,
  type OpenAIChatRequest,
} from "@/lib/openai-to-anthropic";
import { listWeakest, formatWeaknessBlock } from "@/lib/mastery";

export const runtime = "nodejs";
export const maxDuration = 120;

type VoiceLLMRequest = OpenAIChatRequest & {
  user_id?: string;
  study_set_id?: string;
  elevenlabs_extra_body?: {
    user_id?: string;
    study_set_id?: string;
    dynamic_variables?: { user_id?: string; study_set_id?: string };
  };
};

export async function POST(request: NextRequest) {
  let body: VoiceLLMRequest;
  try {
    body = (await request.json()) as VoiceLLMRequest;
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

  const userId =
    body.user_id ??
    body.elevenlabs_extra_body?.user_id ??
    body.elevenlabs_extra_body?.dynamic_variables?.user_id;

  if (userId) {
    try {
      const weakness = listWeakest(userId, 6).filter(
        (m) => m.attempts >= 2 && m.masteryScore < 0.7
      );
      const block = formatWeaknessBlock(weakness);
      if (block) {
        input.system = input.system
          ? `${input.system}\n\n${block}`
          : block;
      }
    } catch (e) {
      console.error("voice-llm: failed to load weakness context", e);
    }
  }

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
