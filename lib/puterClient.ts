// ─────────────────────────────────────────────────────────────────────────────
// Client-side AI via Puter.js. Runs in the browser on Puter's free "User-Pays"
// model — no server AI cost, no API key on our side. Browser-only; never import
// into server code (API routes / server components).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

// Per-task models. Vision-capable models are used for report/image analysis.
export const MODELS = {
  fast: "gpt-5-nano",
  reasoning: "claude-sonnet-4-6",
  visionGpt: "gpt-4o",
  visionGemini: "gemini-2.5-flash",
} as const;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class PuterUnavailableError extends Error {
  constructor() {
    super("AI (Puter.js) is not available in this browser session.");
    this.name = "PuterUnavailableError";
  }
}

export function isPuterReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.puter?.ai?.chat);
}

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

function extractText(res: PuterChatResponse): string {
  if (typeof res?.message?.content === "string") return res.message.content;
  if (typeof res?.text === "string") return res.text;
  const s = res?.toString?.();
  return typeof s === "string" && s !== "[object Object]" ? s : "";
}

/** Plain text chat completion. */
export async function aiChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  const res = await window.puter.ai.chat(messages as PuterChatMessage[], {
    model: opts.model ?? MODELS.fast,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  });
  return extractText(res as PuterChatResponse).trim();
}

/** Streaming chat completion; calls onToken with the full text so far. */
export async function aiChatStream(
  messages: ChatMessage[],
  onToken: (full: string) => void,
  opts: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  const res = await window.puter.ai.chat(messages as PuterChatMessage[], {
    model: opts.model ?? MODELS.fast,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    stream: true,
  });
  let full = "";
  for await (const part of res as AsyncIterable<PuterChatChunk>) {
    const delta = part?.text ?? part?.message?.content ?? "";
    if (delta) { full += delta; onToken(full); }
  }
  return full.trim();
}

/**
 * Vision analysis of a file already uploaded to Puter's filesystem (puter_path)
 * or reachable by URL. Sends the file + a prompt to a vision-capable model.
 */
export async function aiAnalyzeFile(
  fileUrlOrPuterPath: string,
  prompt: string,
  opts: { model?: string } = {}
): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  const messages: PuterChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "file", puter_path: fileUrlOrPuterPath },
        { type: "text", text: prompt },
      ],
    },
  ];
  const res = await window.puter.ai.chat(messages, { model: opts.model ?? MODELS.visionGpt });
  return extractText(res as PuterChatResponse).trim();
}

/** Upload a File/Blob to Puter's temp storage; returns its puter_path. */
export async function puterUpload(file: File): Promise<string> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  const safe = file.name.replace(/[^\w.-]/g, "_");
  const res = await window.puter.fs.write(`aiupchar_tmp_${Date.now()}_${safe}`, file);
  return res.path;
}
