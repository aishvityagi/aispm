import { ChatCompletionRequest } from "@aispm/shared-types";
import { FastifyReply } from "fastify";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export interface GroqStreamResult {
  fullText: string;
  latencyMs: number;
}

export async function forwardToGroq(
  request: ChatCompletionRequest,
  reply: FastifyReply,
  shouldStream: boolean
): Promise<GroqStreamResult> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
  const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to apps/gateway/.env");
  }

  const startTime = Date.now();

  const groqPayload = {
    model: request.model || DEFAULT_MODEL,
    messages: request.messages,
    stream: shouldStream,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens ?? 1024,
  };

  const groqResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(groqPayload),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    throw new Error(`Groq API error ${groqResponse.status}: ${errorText}`);
  }

  // Streaming path
  if (shouldStream) {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let fullText = "";
    const reader = groqResponse.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      reply.raw.write(chunk);

      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch {
            // Non-JSON SSE line — skip
          }
        }
      }
    }

    reply.raw.end();
    return { fullText, latencyMs: Date.now() - startTime };
  }

  // Non-streaming path
  const data = await groqResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const fullText = data?.choices?.[0]?.message?.content || "";
  reply.send(data);

  return { fullText, latencyMs: Date.now() - startTime };
}