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

// ─── Auth (User-Pays) ────────────────────────────────────────────────────────
// Each end-user signs into their OWN Puter account (their free AI quota). Puter.js
// persists the session in the browser, so once signed in, AI calls won't prompt
// again for the life of that session.

export type PuterUserInfo = { username?: string; uuid?: string };

/** True if the current browser already has a signed-in Puter session. */
export function isPuterSignedIn(): boolean {
  return typeof window !== "undefined" && Boolean(window.puter?.auth?.isSignedIn?.());
}

/** Opens Puter's sign-in popup and resolves once the user has signed in. */
export async function puterSignIn(): Promise<boolean> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  if (window.puter.auth.isSignedIn()) return true;
  return window.puter.auth.signIn();
}

/** Signs the current user out of their Puter session in this browser. */
export function puterSignOut(): void {
  if (typeof window !== "undefined" && window.puter?.auth?.signOut) {
    window.puter.auth.signOut();
  }
}

/** Basic profile of the signed-in Puter user (username, uuid). */
export async function getPuterUser(): Promise<PuterUserInfo | null> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) return null;
  if (!window.puter.auth.isSignedIn()) return null;
  try {
    const u = await window.puter.auth.getUser();
    return { username: u?.username, uuid: u?.uuid };
  } catch {
    return null;
  }
}

/**
 * Ensures a signed-in Puter session before an AI call. If already signed in
 * (the normal case after the login gate), this is a no-op and never shows a popup.
 * Only prompts if the session is somehow missing.
 */
export async function ensurePuterAuth(): Promise<boolean> {
  const ready = await waitForPuter();
  if (!ready || !window.puter) throw new PuterUnavailableError();
  if (window.puter.auth.isSignedIn()) return true;
  return window.puter.auth.signIn();
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
  await ensurePuterAuth();
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
  await ensurePuterAuth();
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
  await ensurePuterAuth();
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
  await ensurePuterAuth();
  const safe = file.name.replace(/[^\w.-]/g, "_");
  const res = await window.puter.fs.write(`aiupchar_tmp_${Date.now()}_${safe}`, file);
  return res.path;
}
