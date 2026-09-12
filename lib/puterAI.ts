// ─────────────────────────────────────────────────────────────────────────────
// Client-side AI via Puter.js (https://developer.puter.com/ai/).
//
// Puter runs entirely in the browser — no API keys, no server. It uses the
// "User-Pays" model, so each end user covers their own AI usage through their
// Puter account. Everything here is therefore browser-only and must not be
// imported into server code (API routes, server components).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

/** Default model. Chosen for a good speed/quality balance for clinical drafting. */
export const DEFAULT_MODEL = "gpt-5-nano";

/** A higher-quality model for longer reasoning tasks (e.g. SOAP note drafting). */
export const REASONING_MODEL = "claude-sonnet-4-6";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

/** True once the Puter.js global is present in the browser. */
export function isPuterReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.puter?.ai?.chat);
}

/**
 * Waits (polling) for the Puter.js script to finish loading. The script is added
 * afterInteractive in the root layout, so on a cold page load a component may call
 * AI before window.puter exists.
 */
export async function waitForPuter(timeoutMs = 8000): Promise<boolean> {
  if (isPuterReady()) return true;
  if (typeof window === "undefined") return false;

  const start = Date.now();
  return new Promise<boolean>((resolve) => {
    const tick = () => {
      if (isPuterReady()) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 150);
    };
    tick();
  });
}

/** Raised when Puter.js is unavailable so callers can fall back gracefully. */
export class PuterUnavailableError extends Error {
  constructor() {
    super("AI service (Puter.js) is not available in this browser session.");
    this.name = "PuterUnavailableError";
  }
}

function extractText(res: PuterChatResponse): string {
  if (typeof res?.message?.content === "string") return res.message.content;
  if (typeof res?.text === "string") return res.text;
  const s = res?.toString?.();
  return typeof s === "string" && s !== "[object Object]" ? s : "";
}

/**
 * Non-streaming chat completion.
 * @throws PuterUnavailableError when the SDK never loaded.
 */
export async function aiChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();

  const res = await window.puter.ai.chat(messages as PuterChatMessage[], {
    model: options.model ?? DEFAULT_MODEL,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  // Non-streaming path returns a response object, not an async iterable.
  return extractText(res as PuterChatResponse).trim();
}

/**
 * Streaming chat completion. Calls onToken for each text delta and returns the
 * full concatenated text at the end.
 * @throws PuterUnavailableError when the SDK never loaded.
 */
export async function aiChatStream(
  messages: ChatMessage[],
  onToken: (delta: string, full: string) => void,
  options: ChatOptions = {}
): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();

  const res = await window.puter.ai.chat(messages as PuterChatMessage[], {
    model: options.model ?? DEFAULT_MODEL,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    stream: true,
  });

  let full = "";
  // When stream:true, the SDK returns an async iterable of chunks.
  for await (const part of res as AsyncIterable<PuterChatChunk>) {
    if (options.signal?.aborted) break;
    const delta = part?.text ?? part?.message?.content ?? "";
    if (delta) {
      full += delta;
      onToken(delta, full);
    }
  }
  return full.trim();
}
