import type { ClinicalQaTurn } from "@/lib/next-best-question";

export const SEMANTIC_FACT_KINDS = [
  "ANATOMY_REFERENCE", "BODY_LOCATION", "SYMPTOM", "SYMPTOM_CHARACTERISTIC",
  "MEDICATION_CLAIM", "DIAGNOSIS_CLAIM", "TREATMENT_CLAIM", "HISTORY_CLAIM",
  "REPRODUCTIVE_CLAIM",
] as const;

export type SemanticFactKind = typeof SEMANTIC_FACT_KINDS[number];
export type SemanticFact = {
  kind: SemanticFactKind;
  value: string;
  polarity: "PRESENT" | "DENIED" | "UNCERTAIN";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: string;
};

export type SemanticConsistencyStatus = "CONSISTENT" | "AMBIGUOUS" | "NEEDS_CLARIFICATION";
export type SemanticAssessment = {
  status: SemanticConsistencyStatus;
  facts: SemanticFact[];
  explanation: string;
  question: string;
};

export type SemanticContext = {
  currentStep: string;
  latestAnswer: string;
  answers: Record<string, string>;
  semanticFacts: SemanticFact[];
  qaLog: ClinicalQaTurn[];
  clarificationHistory: { question: string; answer: string }[];
  previousPatientAnswers: string[];
};

const CONSISTENT: SemanticAssessment = { status: "CONSISTENT", facts: [], explanation: "No semantic conflict identified.", question: "" };

function validFact(value: unknown): value is SemanticFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as SemanticFact;
  return SEMANTIC_FACT_KINDS.includes(fact.kind)
    && typeof fact.value === "string" && fact.value.length <= 160
    && ["PRESENT", "DENIED", "UNCERTAIN"].includes(fact.polarity)
    && ["LOW", "MEDIUM", "HIGH"].includes(fact.confidence)
    && typeof fact.evidence === "string" && fact.evidence.length <= 500;
}

function validAssessment(value: SemanticAssessment | null): value is SemanticAssessment {
  return Boolean(value
    && ["CONSISTENT", "AMBIGUOUS", "NEEDS_CLARIFICATION"].includes(value.status)
    && Array.isArray(value.facts) && value.facts.every(validFact)
    && typeof value.explanation === "string"
    && typeof value.question === "string"
    && (value.status === "CONSISTENT" || value.question.trim()));
}

export async function assessSemanticContext(context: SemanticContext): Promise<SemanticAssessment> {
  const { askAIForJSON } = await import("@/lib/puter-ai");
  const generated = await Promise.race([
    askAIForJSON<SemanticAssessment>([
      { role: "system", content: `You extract clinically relevant semantic facts and assess whether the latest answer is consistent with accumulated patient context. Do not diagnose, infer anatomy from declared SEX, or impose binary assumptions. Treat reported anatomy, body sites, reproductive symptoms, medications, diagnoses, treatment, and history as patient statements that may require respectful clarification against declared context. If a statement is materially ambiguous or conflicts with context, return NEEDS_CLARIFICATION and one Hindi/Hinglish question. Do not use special-case rules; assess the meaning of the complete context. Extract only facts relevant to reasoning. Return JSON exactly: {"status":"CONSISTENT|AMBIGUOUS|NEEDS_CLARIFICATION","facts":[{"kind":"ANATOMY_REFERENCE|BODY_LOCATION|SYMPTOM|SYMPTOM_CHARACTERISTIC|MEDICATION_CLAIM|DIAGNOSIS_CLAIM|TREATMENT_CLAIM|HISTORY_CLAIM|REPRODUCTIVE_CLAIM","value":"...","polarity":"PRESENT|DENIED|UNCERTAIN","confidence":"LOW|MEDIUM|HIGH","evidence":"..."}],"explanation":"short reason","question":"question or empty string"}.` },
      { role: "user", content: JSON.stringify(context) },
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);
  return validAssessment(generated) ? generated : CONSISTENT;
}
