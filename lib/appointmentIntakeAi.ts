"use client";

import { serverAiChat } from "@/lib/serverAiClient";

export type IntakeChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * The intake UI never lets model output mutate patient fields directly. This
 * helper only returns parsed candidate data for an allowlisted UI transition.
 */
export async function askIntakeJson<T>(messages: IntakeChatMessage[]): Promise<T | null> {
  try {
    const raw = await serverAiChat([
      { role: "system", content: "Return exactly one valid JSON object. Do not include markdown or prose." },
      ...messages,
    ], { temperature: 0.2, maxTokens: 500 });
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) as T : null;
  } catch {
    return null;
  }
}
