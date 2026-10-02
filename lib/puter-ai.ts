// Client-side AI helper using Puter.js's browser SDK (window.puter).
//
// This runs in the visitor's own browser and uses Puter's "User-Pays" model:
// the first AI call prompts the visitor to sign into their own free Puter
// account, and THEIR account is billed for usage — never this app's backend.
// That's a deliberate trade-off: zero AI cost to run this app, in exchange
// for each user needing a Puter account and a one-time sign-in prompt.
//
// Always resolves to null instead of throwing — every caller must already
// have a canned fallback ready (Puter script not loaded yet, user declined
// sign-in, network error, etc. all resolve to null, never an exception).

import { serverAiChat } from "./serverAiClient";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_PUTER_MODEL || "gpt-5-nano";

export function puterAvailable(): boolean {
  return true;
}

export async function askAI(messages: ChatMessage[]): Promise<string | null> {
  if (typeof window !== "undefined" && window.__AI_DOCTOR_TEST_RESPONDER__) {
    const testResponse = await window.__AI_DOCTOR_TEST_RESPONDER__(messages);
    return testResponse?.trim() || null;
  }
  try {
    return (await serverAiChat(messages, { model: DEFAULT_MODEL, temperature: 0.2, maxTokens: 500 })).trim() || null;
  } catch (err) {
    console.error("[server-ai] request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Same as askAI, but nudges the model to return JSON and defensively parses
 * the first {...} block out of the reply (models sometimes wrap JSON in
 * prose or a markdown fence). Returns null on any failure so the caller can
 * fall back to a canned response.
 */
export async function askAIForJSON<T>(messages: ChatMessage[]): Promise<T | null> {
  const raw = await askAI([
    { role: "system", content: "Respond with ONLY a single valid JSON object. No prose, no markdown code fences, no explanation before or after." },
    ...messages,
  ]);
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
