import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type RequestBody = {
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
};

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function cleanMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const messages = value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const message = item as Record<string, unknown>;
    if (!["system", "user", "assistant"].includes(String(message.role))) return null;
    const content = message.content;
    const validText = typeof content === "string" && content.trim().length > 0 && content.length <= 30_000;
    const validParts = Array.isArray(content) && content.length <= 10 && content.every((part) => {
      if (!part || typeof part !== "object") return false;
      const item = part as Record<string, unknown>;
      if (item.type === "text") return typeof item.text === "string" && item.text.length <= 30_000;
      if (item.type === "image_url") {
        const image = item.image_url as Record<string, unknown> | undefined;
        return typeof image?.url === "string" && image.url.startsWith("data:image/") && image.url.length <= 28_000_000;
      }
      return false;
    });
    if (!validText && !validParts) return null;
    return { role: message.role as ChatMessage["role"], content: content as ChatMessage["content"] };
  });
  return messages.every(Boolean) ? messages as ChatMessage[] : null;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages) return NextResponse.json({ error: "messages must be a non-empty allowlisted chat message array." }, { status: 400 });

  const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature)
    ? Math.min(1, Math.max(0, body.temperature))
    : 0.4;
  const maxTokens = typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
    ? Math.min(4000, Math.max(32, Math.trunc(body.maxTokens)))
    : 800;

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(45_000),
    });

    const data = await upstream.json().catch(() => null) as {
      choices?: { message?: { content?: string | null } }[];
      error?: { message?: string };
    } | null;
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.error?.message || `OpenAI API error ${upstream.status}` }, { status: 502 });
    }

    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!content) return NextResponse.json({ error: "OpenAI returned an empty response." }, { status: 502 });
    return NextResponse.json({ content, model: MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
