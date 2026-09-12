// ─────────────────────────────────────────────────────────────────────────────
// Server-side AI via Puter's OpenAI-compatible endpoint.
//
// We call Puter with a plain fetch() to https://api.puter.com/puterai/openai/v1/
// using a server-held Bearer token (PUTER_API_TOKEN). This avoids Puter's browser
// "User-Pays" flow (no per-user Puter login) and avoids adding any SDK dependency
// — after the better-sqlite3 serverless crash, plain fetch is the safest path.
//
// Get the token from https://puter.com/dashboard -> "Create token", then set it as
// PUTER_API_TOKEN in .env.local and in the Vercel project environment.
// ─────────────────────────────────────────────────────────────────────────────

const PUTER_BASE = "https://api.puter.com/puterai/openai/v1";

// Per-task model choices. One endpoint serves 500+ models across OpenAI, Anthropic
// (Claude), Google (Gemini), xAI (Grok), etc. — switching is just this string.
// Fast/cheap model for short conversational turns; stronger model for reasoning.
export const MODELS = {
  intake: "gpt-5-nano",
  symptom: "gpt-5-nano",
  copilot: "claude-sonnet-4-6",
  scribe: "claude-sonnet-4-6",
} as const;

// If a chosen model id is rejected (e.g. renamed/retired), fall back to this one so
// a stale id never takes a feature down in production.
const FALLBACK_MODEL = "gpt-5-nano";

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

export type AiOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/** Thrown when the server has no Puter token configured. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured on the server (PUTER_API_TOKEN missing).");
    this.name = "AiNotConfiguredError";
  }
}

/** Thrown for upstream (Puter) errors so routes can surface a clean message. */
export class AiUpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AiUpstreamError";
    this.status = status;
  }
}

function token(): string {
  const t = process.env.PUTER_API_TOKEN;
  if (!t) throw new AiNotConfiguredError();
  return t;
}

async function callOnce(
  model: string,
  messages: ChatMessage[],
  opts: AiOptions
): Promise<{ ok: true; content: string } | { ok: false; status: number; message: string }> {
  const res = await fetch(`${PUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
    }),
    // Never hang a serverless function forever.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    let message = `Puter API error ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      /* keep default */
    }
    return { ok: false, status: res.status, message };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return { ok: true, content: content.trim() };
}

/**
 * Non-streaming chat completion. Tries the requested model, and on a 4xx that
 * looks like a bad/unknown model, retries once with the fallback model.
 */
export async function aiComplete(messages: ChatMessage[], opts: AiOptions = {}): Promise<string> {
  const model = opts.model ?? FALLBACK_MODEL;
  const first = await callOnce(model, messages, opts);
  if (first.ok) return first.content;

  const modelLooksBad =
    first.status === 400 || first.status === 404 || /model/i.test(first.message);
  if (modelLooksBad && model !== FALLBACK_MODEL) {
    const retry = await callOnce(FALLBACK_MODEL, messages, opts);
    if (retry.ok) return retry.content;
    throw new AiUpstreamError(retry.status, retry.message);
  }
  throw new AiUpstreamError(first.status, first.message);
}

/** True when a Puter token is present (routes can decide to fall back to stubs). */
export function aiConfigured(): boolean {
  return Boolean(process.env.PUTER_API_TOKEN);
}
