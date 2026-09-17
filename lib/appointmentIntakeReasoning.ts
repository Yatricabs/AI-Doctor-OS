import { askIntakeJson } from "@/lib/appointmentIntakeAi";

export type SemanticFact = {
  kind: "ANATOMY_REFERENCE" | "BODY_LOCATION" | "SYMPTOM" | "MEDICATION_CLAIM" | "DIAGNOSIS_CLAIM" | "TREATMENT_CLAIM" | "HISTORY_CLAIM" | "REPRODUCTIVE_CLAIM";
  value: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: string;
};

export type SemanticAssessment = {
  outcome: "CONTINUE" | "NEEDS_CLARIFICATION" | "SAFETY_CONCERN";
  facts: SemanticFact[];
  question: string;
  rationale: string;
};

const fallback: SemanticAssessment = { outcome: "CONTINUE", facts: [], question: "", rationale: "No semantic conflict was identified." };
const factKinds = new Set<SemanticFact["kind"]>(["ANATOMY_REFERENCE", "BODY_LOCATION", "SYMPTOM", "MEDICATION_CLAIM", "DIAGNOSIS_CLAIM", "TREATMENT_CLAIM", "HISTORY_CLAIM", "REPRODUCTIVE_CLAIM"]);

function valid(value: unknown): value is SemanticAssessment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SemanticAssessment;
  return ["CONTINUE", "NEEDS_CLARIFICATION", "SAFETY_CONCERN"].includes(candidate.outcome)
    && Array.isArray(candidate.facts)
    && candidate.facts.every((fact) => fact && factKinds.has(fact.kind) && typeof fact.value === "string" && typeof fact.evidence === "string" && ["LOW", "MEDIUM", "HIGH"].includes(fact.confidence))
    && typeof candidate.question === "string"
    && typeof candidate.rationale === "string"
    && (candidate.outcome === "CONTINUE" || candidate.question.trim().length > 0);
}

export async function assessAppointmentAnswer(context: Record<string, unknown>): Promise<SemanticAssessment> {
  const assessment = await askIntakeJson<SemanticAssessment>([
    {
      role: "system",
      content: "You are a medical appointment intake reasoning boundary. Extract only clinically meaningful facts from the latest patient answer: anatomy/body site, symptoms, medications, diagnoses, treatments, history and explicit reproductive claims. Compare the facts to all accumulated context including declared SEX and prior answers. Do not diagnose, silently alter structured answers, or use a fixed special-case rule list. If information is materially inconsistent or ambiguous, return NEEDS_CLARIFICATION and one respectful Hindi/Hinglish question. If there is a credible immediate safety concern, return SAFETY_CONCERN. Otherwise return CONTINUE. Schema: {outcome:'CONTINUE|NEEDS_CLARIFICATION|SAFETY_CONCERN',facts:[{kind:'ANATOMY_REFERENCE|BODY_LOCATION|SYMPTOM|MEDICATION_CLAIM|DIAGNOSIS_CLAIM|TREATMENT_CLAIM|HISTORY_CLAIM|REPRODUCTIVE_CLAIM',value:'...',confidence:'LOW|MEDIUM|HIGH',evidence:'...'}],question:'...',rationale:'...'}.",
    },
    { role: "user", content: JSON.stringify(context) },
  ]);
  return valid(assessment) ? assessment : fallback;
}

export type NextQuestion = { key: "duration" | "severity" | "associatedSymptoms" | "priorConsultation" | "priorReports"; question: string };

const safeFallback: NextQuestion[] = [
  { key: "duration", question: "Yeh takleef aapko kab se hai?" },
  { key: "severity", question: "Is takleef ki teevrata 1 se 10 mein kitni hai?" },
  { key: "associatedSymptoms", question: "Is takleef ke saath aur kaun se lakshan ho rahe hain?" },
  { key: "priorConsultation", question: "Kya aapne is takleef ke liye pehle kisi doctor ko dikhaya hai?" },
  { key: "priorReports", question: "Kya koi prescription, test report ya scan available hai?" },
];

export async function nextAppointmentQuestion(context: Record<string, unknown>, covered: string[]): Promise<NextQuestion> {
  const result = await askIntakeJson<NextQuestion>([
    { role: "system", content: "Choose exactly one highest-value missing clinical question. Use all accumulated patient context and covered dimensions. Do not diagnose or ask about a covered dimension. Return only {key:'duration|severity|associatedSymptoms|priorConsultation|priorReports',question:'short Hindi/Hinglish question'}." },
    { role: "user", content: JSON.stringify({ context, covered }) },
  ]);
  if (result && safeFallback.some((item) => item.key === result.key) && typeof result.question === "string" && result.question.trim() && !covered.includes(result.key)) return result;
  return safeFallback.find((item) => !covered.includes(item.key)) ?? safeFallback[safeFallback.length - 1];
}
