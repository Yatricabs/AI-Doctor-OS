import { askAIForJSON } from "@/lib/puter-ai";
import { detectRedFlags } from "@/lib/red-flag-keywords";
import { checkIntelligibility } from "./intakeValidation";

export type ReasoningOutcome = "CONTINUE" | "NEEDS_CLARIFICATION" | "SAFETY_CONCERN";

export type ReasoningResult = {
  outcome: ReasoningOutcome;
  interpretation: string;
  question: string;
  missingInformation: string[];
};

export type InterviewReasoningContext = {
  currentStep: string;
  latestAnswer: string;
  answers: Record<string, string>;
  previousPatientAnswers: string[];
  followUpAnswers: { question: string; answer: string }[];
  clarificationHistory: { question: string; answer: string }[];
  uploadedFiles: string[];
  urgent: boolean;
};

const CONTINUE_RESULT: ReasoningResult = {
  outcome: "CONTINUE",
  interpretation: "No unresolved contradiction was identified.",
  question: "",
  missingInformation: [],
};

function isValidResult(value: ReasoningResult | null): value is ReasoningResult {
  return Boolean(value
    && ["CONTINUE", "NEEDS_CLARIFICATION", "SAFETY_CONCERN"].includes(value.outcome)
    && typeof value.interpretation === "string"
    && typeof value.question === "string"
    && Array.isArray(value.missingInformation));
}

export async function evaluatePatientAnswer(context: InterviewReasoningContext): Promise<ReasoningResult> {
  const redFlags = detectRedFlags(context.latestAnswer);
  if (redFlags.length > 0) {
    return {
      outcome: "SAFETY_CONCERN",
      interpretation: `Deterministic safety screen matched: ${redFlags.join(", ")}`,
      question: "Yeh turant dhyaan dene wali baat ho sakti hai. Kya aap abhi surakshit jagah par hain aur turant medical madad le sakte hain?",
      missingInformation: ["Immediate safety status"],
    };
  }

  const generated = await Promise.race([
    askAIForJSON<ReasoningResult>([
      {
        role: "system",
        content: `You are the context-aware reasoning layer for a clinical intake interview. Evaluate the latest patient answer against ALL accumulated context. Do not diagnose. Detect semantic contradictions, material ambiguity, clinically important changes, and safety concerns. Distinguish identity/context from anatomy and symptoms; do not apply simplistic Man/Woman rules, especially for transgender patients. If clarification is required, ask one respectful, specific Hindi/Hinglish clarification question and stop progression. If context is consistent, return CONTINUE. If urgent safety attention is needed, return SAFETY_CONCERN. Never mutate structured answers. Return JSON exactly: {"outcome":"CONTINUE|NEEDS_CLARIFICATION|SAFETY_CONCERN","interpretation":"short reason","question":"question or empty string","missingInformation":["..."]}.`,
      },
      { role: "user", content: JSON.stringify(context) },
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);

  if (!isValidResult(generated)) return CONTINUE_RESULT;
  if (generated.outcome !== "CONTINUE" && !generated.question.trim()) return CONTINUE_RESULT;
  return generated;
}
