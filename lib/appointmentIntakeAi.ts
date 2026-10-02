"use client";

import { serverAiChat } from "@/lib/serverAiClient";

export type IntakeChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Fallback to AI UPCHAR proprietary clinical reasoning endpoint (/api/clinical/reason).
 * Ensures appointment intake is powered by the fine-tuned clinical model even when
 * third-party OpenAI keys are unconfigured.
 */
async function fallbackToClinicalReasoningBridge<T>(messages: IntakeChatMessage[]): Promise<T | null> {
  if (typeof window === "undefined") return null;

  try {
    const system = messages.find((m) => m.role === "system")?.content || "";
    const user = messages.find((m) => m.role === "user")?.content || "{}";
    let context: Record<string, unknown> = {};
    try {
      context = JSON.parse(user) as Record<string, unknown>;
    } catch {
      context = { latestAnswer: user };
    }

    const answers = (context.answers ?? {}) as Record<string, unknown>;
    const latestAnswer = String(context.latestAnswer || answers.chiefComplaint || "");

    const res = await fetch("/api/clinical/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_context: answers,
        current_answer: latestAnswer || "Clinical intake turn",
        semantic_context: context,
        safety_state: { status: "CLEAR" },
        retrieved_evidence: [],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      recommended_action?: string;
      missing_information?: string[];
      next_best_question?: string;
      confidence?: string;
      semantic_interpretation?: { problems?: string[] };
      clinical_considerations?: string[];
    };

    // Map to NextQuestion format
    if (system.includes("Choose ONE highest-value")) {
      const isSafety = data.recommended_action === "SAFETY_REVIEW";
      const key = isSafety ? "associatedSymptoms" : (data.missing_information?.[0] || "severity");
      const mapped = {
        action: isSafety ? "SAFETY_ESCALATION" : "ASK_QUESTION",
        key,
        question: data.next_best_question || "Is takleef ki teevrata 1 se 10 mein kitni hai?",
        reasonCode: isSafety ? "SAFETY_INFORMATION_HIGH_VALUE" : `${String(key).toUpperCase()}_MISSING`,
        confidence: data.confidence || "MEDIUM",
      };
      return mapped as unknown as T;
    }

    // Map to SemanticAssessment format
    if (system.includes("clinical intake reasoning boundary")) {
      const isSafety = data.recommended_action === "SAFETY_REVIEW";
      const mapped = {
        status: isSafety ? "SAFETY_CONCERN" : "CONSISTENT",
        facts: (data.semantic_interpretation?.problems || []).map((p: string) => ({
          kind: "SYMPTOM",
          value: p,
          polarity: "PRESENT",
          confidence: "HIGH",
          evidence: latestAnswer.slice(0, 200),
        })),
        explanation: data.clinical_considerations?.[0] || "No conflict detected.",
        question: data.next_best_question || "",
        contradictions: [],
        safetyFlags: isSafety ? [{ code: "ACUTE_SYMPTOM", evidence: latestAnswer.slice(0, 200), severity: "HIGH" }] : [],
        reasonCodes: [data.recommended_action || "CONSISTENT"],
      };
      return mapped as unknown as T;
    }

    return null;
  } catch {
    return null;
  }
}

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
    if (match) return JSON.parse(match[0]) as T;
  } catch {
    // Primary endpoint unavailable; fallback to AI UPCHAR Clinical Reasoning bridge
    return await fallbackToClinicalReasoningBridge<T>(messages);
  }
  return await fallbackToClinicalReasoningBridge<T>(messages);
}
