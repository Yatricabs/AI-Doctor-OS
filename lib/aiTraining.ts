// Lightweight, best-effort logger that captures AI generations for our future
// model. Never throws and never blocks the UX — training data is a side effect.
"use client";

export type LogAiInput = {
  workflow: string;
  aiOutput: string;
  patientId?: string;
  model?: string;
  inputContext?: unknown;   // prompt/snapshot; serialized server-side
  outputType?: "json" | "text" | "markdown";
  source?: string;
};

/** Fire-and-forget: logs an AI output. Returns the record id (or null). */
export async function logAiTraining(input: LogAiInput): Promise<string | null> {
  try {
    if (!input.aiOutput?.trim()) return null;
    const res = await fetch("/api/ai-training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const jr = (await res.json()) as { ok: boolean; data?: { id: string } };
    return jr.ok ? jr.data?.id ?? null : null;
  } catch {
    return null;
  }
}

/** Attach clinician feedback to a captured record (accepted/edited/rejected). */
export async function sendAiFeedback(id: string, feedback: "accepted" | "edited" | "rejected", correctedOutput?: string, rating?: number): Promise<void> {
  try {
    await fetch("/api/ai-training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, feedback, correctedOutput, rating }),
    });
  } catch {
    /* best effort */
  }
}
