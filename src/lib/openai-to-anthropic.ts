import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool" | "developer";
  content:
    | string
    | Array<{ type: string; text?: string; [k: string]: unknown }>
    | null;
  name?: string;
  tool_call_id?: string;
};

export type OpenAIChatRequest = {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
};

export type AnthropicRequestInput = {
  system: string | undefined;
  messages: MessageParam[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
};

function contentToString(
  content: OpenAIMessage["content"]
): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  return content
    .map((c) => (typeof c === "string" ? c : c.text ?? ""))
    .join("");
}

export function translateRequest(
  req: OpenAIChatRequest
): AnthropicRequestInput {
  const systems: string[] = [];
  const msgs: MessageParam[] = [];

  for (const m of req.messages) {
    if (m.role === "system" || m.role === "developer") {
      systems.push(contentToString(m.content));
      continue;
    }
    if (m.role === "tool") {
      const text = contentToString(m.content);
      msgs.push({
        role: "user",
        content: [{ type: "text", text: `[tool result] ${text}` } as TextBlockParam],
      });
      continue;
    }
    const text = contentToString(m.content);
    if (!text) continue;
    msgs.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text", text } as TextBlockParam],
    });
  }

  const merged = mergeConsecutiveSameRole(msgs);

  if (merged.length === 0 || merged[0].role !== "user") {
    merged.unshift({
      role: "user",
      content: [{ type: "text", text: "." } as TextBlockParam],
    });
  }

  return {
    system: systems.length > 0 ? systems.join("\n\n") : undefined,
    messages: merged,
    max_tokens: req.max_tokens && req.max_tokens > 0 ? req.max_tokens : 1024,
    temperature: req.temperature,
    top_p: req.top_p,
    stop_sequences: Array.isArray(req.stop)
      ? req.stop
      : typeof req.stop === "string"
        ? [req.stop]
        : undefined,
  };
}

function mergeConsecutiveSameRole(messages: MessageParam[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      const a = textOf(last.content);
      const b = textOf(m.content);
      out[out.length - 1] = {
        role: last.role,
        content: [{ type: "text", text: `${a}\n${b}` } as TextBlockParam],
      };
    } else {
      out.push(m);
    }
  }
  return out;
}

function textOf(content: MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((c) => ("type" in c && c.type === "text" ? c.text : ""))
    .join("");
}

export async function streamAnthropicAsOpenAI(
  client: Anthropic,
  model: string,
  input: AnthropicRequestInput,
  requestedModelName: string
): Promise<Response> {
  const stream = await client.messages.stream({
    model,
    max_tokens: input.max_tokens,
    system: input.system,
    messages: input.messages,
    temperature: input.temperature,
    top_p: input.top_p,
    stop_sequences: input.stop_sequences,
  });

  const chatId = `chatcmpl-${Math.random().toString(36).slice(2, 12)}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      send({
        id: chatId,
        object: "chat.completion.chunk",
        created,
        model: requestedModelName,
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "" },
            finish_reason: null,
          },
        ],
      });

      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({
              id: chatId,
              object: "chat.completion.chunk",
              created,
              model: requestedModelName,
              choices: [
                {
                  index: 0,
                  delta: { content: event.delta.text },
                  finish_reason: null,
                },
              ],
            });
          }
        }

        const final = await stream.finalMessage();
        const stopReason = final.stop_reason;
        const finishReason =
          stopReason === "end_turn" || stopReason === "stop_sequence"
            ? "stop"
            : stopReason === "max_tokens"
              ? "length"
              : "stop";

        send({
          id: chatId,
          object: "chat.completion.chunk",
          created,
          model: requestedModelName,
          choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({
          id: chatId,
          object: "chat.completion.chunk",
          created,
          model: requestedModelName,
          choices: [
            {
              index: 0,
              delta: { content: `\n[error: ${message}]` },
              finish_reason: "stop",
            },
          ],
        });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function completeAnthropicAsOpenAI(
  client: Anthropic,
  model: string,
  input: AnthropicRequestInput,
  requestedModelName: string
): Promise<Response> {
  const result = await client.messages.create({
    model,
    max_tokens: input.max_tokens,
    system: input.system,
    messages: input.messages,
    temperature: input.temperature,
    top_p: input.top_p,
    stop_sequences: input.stop_sequences,
  });

  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("");

  const finishReason =
    result.stop_reason === "end_turn" || result.stop_reason === "stop_sequence"
      ? "stop"
      : result.stop_reason === "max_tokens"
        ? "length"
        : "stop";

  return Response.json({
    id: `chatcmpl-${Math.random().toString(36).slice(2, 12)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModelName,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: result.usage.input_tokens,
      completion_tokens: result.usage.output_tokens,
      total_tokens:
        result.usage.input_tokens + result.usage.output_tokens,
    },
  });
}
