import { askIntakeJson } from "@/lib/appointmentIntakeAi";
import {
  assessAppointmentContext,
  detectAppointmentSafetyFlags,
  extractSemanticFacts,
  explicitSexCorrection,
  extractClinicalContext,
  type AppointmentContext,
  type ContextAssessment,
  type SemanticFact,
} from "@/lib/appointmentContextConsistency";

export type { AppointmentContext, ContextAssessment, SemanticFact } from "@/lib/appointmentContextConsistency";

export type ClinicalKey = "duration" | "severity" | "associatedSymptoms" | "priorConsultation" | "priorReports";
export type NextAction =
  | "ASK_QUESTION" | "CLARIFY_CONTRADICTION" | "SAFETY_ESCALATION" | "REQUEST_DOCUMENT"
  | "CONFIRM_INFORMATION" | "CORRECT_PATIENT_CONTEXT" | "REQUEST_MISSING_CRITICAL_INFORMATION"
  | "CONTINUE_APPOINTMENT" | "COMPLETE_INTAKE" | "PREPARE_DOCTOR_BRIEF";

export type SemanticAssessment = ContextAssessment & { source: "DETERMINISTIC" | "AI" | "DETERMINISTIC_FALLBACK" };

export type QaTurn = { question: string; answer: string; key: string };

const factKinds = new Set(["ANATOMY_REFERENCE", "BODY_LOCATION", "SYMPTOM", "SYMPTOM_CHARACTERISTIC", "MEDICATION_CLAIM", "DIAGNOSIS_CLAIM", "TREATMENT_CLAIM", "HISTORY_CLAIM", "REPRODUCTIVE_CLAIM", "TEMPORAL_REFERENCE", "TRIGGER_REFERENCE", "PROBLEM_REFERENCE"]);
const outcomes = new Set(["CONSISTENT", "NEEDS_CLARIFICATION", "SAFETY_CONCERN"]);

function validSemantic(value: unknown): value is Omit<SemanticAssessment, "source"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SemanticAssessment>;
  return typeof candidate.status === "string" && outcomes.has(candidate.status)
    && Array.isArray(candidate.facts)
    && candidate.facts.every((item) => item && factKinds.has(String(item.kind)) && typeof item.value === "string" && typeof item.evidence === "string" && ["LOW", "MEDIUM", "HIGH"].includes(String(item.confidence)))
    && typeof candidate.question === "string" && typeof candidate.explanation === "string"
    && Array.isArray(candidate.contradictions) && Array.isArray(candidate.safetyFlags) && Array.isArray(candidate.reasonCodes);
}

function mergeFacts(first: SemanticFact[], second: SemanticFact[]) {
  const seen = new Set<string>();
  return [...first, ...second].filter((item) => {
    const key = `${item.conceptKey ?? item.value}:${item.polarity ?? "PRESENT"}:${item.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deterministicAssessment(context: Record<string, unknown>): ContextAssessment {
  const answers = (context.answers ?? {}) as Record<string, unknown>;
  const deterministic = assessAppointmentContext({
    patientType: typeof answers.patientType === "string" ? answers.patientType : undefined,
    sex: typeof answers.sex === "string" ? answers.sex : undefined,
    complaint: typeof answers.chiefComplaint === "string" ? answers.chiefComplaint : undefined,
    latestAnswer: typeof context.latestAnswer === "string" ? context.latestAnswer : undefined,
    previousAnswers: Array.isArray(context.previousAnswers) ? context.previousAnswers.filter((item): item is string => typeof item === "string") : [],
    semanticFacts: Array.isArray(context.semanticFacts) ? context.semanticFacts as SemanticFact[] : [],
    previousPatientContext: typeof context.previousPatientContext === "string" ? context.previousPatientContext : undefined,
  });
  return deterministic;
}

/**
 * Unified semantic gate. Deterministic safety and consistency are evaluated
 * before the model is called, so an unavailable/invalid model cannot turn a
 * known conflict into a routine duration question.
 */
export async function assessAppointmentAnswer(context: Record<string, unknown>): Promise<SemanticAssessment> {
  const deterministic = deterministicAssessment(context);
  if (deterministic.status !== "CONSISTENT") return { ...deterministic, source: "DETERMINISTIC" };

  const model = await askIntakeJson<Partial<SemanticAssessment>>([
    {
      role: "system",
      content: "You are a clinical intake reasoning boundary, not a diagnostician. Understand any patient statement, not only a fixed disease list. Separate multiple active problems, extract anatomy/body site, symptoms, severity, time/duration, triggers, associated symptoms, medications, patient-reported diagnoses (never confirmed diagnoses), treatments and history. Compare them with SEX, age, previous answers, prior appointment context, documents and already extracted facts. Return exactly one JSON object with status CONSISTENT|NEEDS_CLARIFICATION|SAFETY_CONCERN, facts [{kind: ANATOMY_REFERENCE|BODY_LOCATION|SYMPTOM|SYMPTOM_CHARACTERISTIC|MEDICATION_CLAIM|DIAGNOSIS_CLAIM|TREATMENT_CLAIM|HISTORY_CLAIM|REPRODUCTIVE_CLAIM|TEMPORAL_REFERENCE|TRIGGER_REFERENCE|PROBLEM_REFERENCE,value,conceptKey,normalizedConcept,problemId,polarity:PRESENT|DENIED|UNCERTAIN,confidence:LOW|MEDIUM|HIGH,evidence}], explanation, question, contradictions [{code,current,previous,explanation,confidence}], safetyFlags [{code,evidence,severity}], reasonCodes. Never change structured patient answers. If uncertain, ask respectful clarification. Do not ask a routine question when a material mismatch or safety concern exists.",
    },
    { role: "user", content: JSON.stringify({ ...context, clinicalContextRepresentation: deterministic.representation ?? extractClinicalContext(String(context.latestAnswer ?? "")) }) },
  ]);

  if (!validSemantic(model)) return { ...deterministic, source: "DETERMINISTIC_FALLBACK" };
  const modelAssessment = model as Omit<SemanticAssessment, "source">;
  const modelFacts = modelAssessment.facts.map((item) => ({ ...item, source: "AI" as const }));
  // Safety/consistency is application-owned. The model can strengthen a gate,
  // but it cannot weaken a deterministic gate (which was already clear above).
  return { ...modelAssessment, facts: mergeFacts(deterministic.facts, modelFacts), source: "AI" } as SemanticAssessment;
}

export type NextQuestion = {
  action: NextAction;
  key: ClinicalKey;
  question: string;
  reasonCode: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  candidateActions?: NextAction[];
};

const safeQuestions: Record<ClinicalKey, string> = {
  duration: "Yeh takleef aapko kab se hai?",
  severity: "Is takleef ki teevrata 1 se 10 mein kitni hai?",
  associatedSymptoms: "Is takleef ke saath aur kaun se lakshan ho rahe hain? Koi safety warning to nahi?",
  priorConsultation: "Kya aapne is takleef ke liye pehle kisi doctor ko dikhaya ya koi ilaaj liya hai?",
  priorReports: "Kya koi prescription, test report ya scan available hai?",
};

const actionKeys = new Set<ClinicalKey>(Object.keys(safeQuestions) as ClinicalKey[]);
const actionTypes = new Set<NextAction>([
  "ASK_QUESTION", "CLARIFY_CONTRADICTION", "SAFETY_ESCALATION", "REQUEST_DOCUMENT", "CONFIRM_INFORMATION",
  "CORRECT_PATIENT_CONTEXT", "REQUEST_MISSING_CRITICAL_INFORMATION", "CONTINUE_APPOINTMENT", "COMPLETE_INTAKE", "PREPARE_DOCTOR_BRIEF",
]);

function textFrom(context: Record<string, unknown>) {
  const answers = (context.answers ?? {}) as Record<string, unknown>;
  const qa = Array.isArray(context.qaLog) ? context.qaLog : [];
  const prior = Array.isArray(context.previousAnswers) ? context.previousAnswers : [];
  return [
    ...Object.values(answers).filter((item): item is string => typeof item === "string"),
    ...qa.flatMap((item) => (item && typeof item === "object" ? [String((item as { answer?: unknown }).answer ?? "")] : [])),
    ...prior.filter((item): item is string => typeof item === "string"),
  ].join(" ");
}

export function coveredClinicalInformation(context: Record<string, unknown>, supplied: string[] = []): ClinicalKey[] {
  const answers = (context.answers ?? {}) as Record<string, unknown>;
  const qa = Array.isArray(context.qaLog) ? context.qaLog : [];
  const text = textFrom(context);
  const covered = new Set<ClinicalKey>(supplied.filter((item): item is ClinicalKey => actionKeys.has(item as ClinicalKey)));
  if (typeof answers.duration === "string" && answers.duration.trim()) covered.add("duration");
  if (/\b(1\s*(to|-|से)\s*10|[0-9]+\s*(\/10|out of 10)|mild|moderate|severe|bahut tez|बहुत तेज)\b/i.test(text) || typeof answers.severity === "string") covered.add("severity");
  if (qa.some((item) => item && typeof item === "object" && (item as { key?: unknown }).key === "associatedSymptoms") || /\b(with|saath|also|aur|associated|lakshan|symptoms|ulti|vomit|fever|bukhar)\b/i.test(text)) covered.add("associatedSymptoms");
  if (qa.some((item) => item && typeof item === "object" && (item as { key?: unknown }).key === "priorConsultation") || typeof answers.priorConsultation === "string" || /\b(doctor|treatment|इलाज|दवा|prescription)\b/i.test(text)) covered.add("priorConsultation");
  if (qa.some((item) => item && typeof item === "object" && (item as { key?: unknown }).key === "priorReports") || typeof answers.priorReports === "string" || /\b(report|scan|test|prescription|parchi)\b/i.test(text)) covered.add("priorReports");
  if (/\b(\d+\s*(day|days|din|hafte|week|weeks|mahine|month)|since|kab se|pehle)\b/i.test(text)) covered.add("duration");
  return [...covered];
}

function fallbackDecision(context: Record<string, unknown>, covered: ClinicalKey[]): NextQuestion {
  const text = textFrom(context);
  const complaint = String((context.answers as Record<string, unknown> | undefined)?.chiefComplaint ?? "");
  const missing = (Object.keys(safeQuestions) as ClinicalKey[]).filter((key) => !covered.includes(key));
  if (!missing.length) return { action: "REQUEST_DOCUMENT", key: "priorReports", question: safeQuestions.priorReports, reasonCode: "DOCUMENT_OR_COMPLETION_CHECK", confidence: "MEDIUM" };
  // A complaint that can carry immediate risk gets a safety-oriented question
  // before routine onset. This is category/context scoring, not a phrase queue.
  if (missing.includes("associatedSymptoms") && /\b(chest|seene|pressure|breath|saans|bleeding|khoon|behosh|faint|neurolog|weakness)\b/i.test(`${complaint} ${text}`)) {
    return { action: "SAFETY_ESCALATION", key: "associatedSymptoms", question: safeQuestions.associatedSymptoms, reasonCode: "SAFETY_INFORMATION_HIGH_VALUE", confidence: "HIGH" };
  }
  if (missing.includes("severity") && /\b(pain|dard|discharge|bleeding|fever|bukhar|problem|takleef)\b/i.test(complaint)) return { action: "REQUEST_MISSING_CRITICAL_INFORMATION", key: "severity", question: safeQuestions.severity, reasonCode: "SEVERITY_MISSING", confidence: "MEDIUM" };
  const key = missing[0];
  return { action: "ASK_QUESTION", key, question: safeQuestions[key], reasonCode: `${key.toUpperCase()}_MISSING`, confidence: "LOW" };
}

function validNext(value: unknown, covered: ClinicalKey[]): value is NextQuestion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NextQuestion>;
  return typeof candidate.action === "string" && actionTypes.has(candidate.action as NextAction)
    && typeof candidate.key === "string" && actionKeys.has(candidate.key as ClinicalKey)
    && typeof candidate.question === "string" && candidate.question.trim().length > 0
    && typeof candidate.reasonCode === "string"
    && !covered.includes(candidate.key as ClinicalKey);
}

/** One allowlisted next action is selected after every accepted clinical answer. */
export async function nextAppointmentQuestion(context: Record<string, unknown>, suppliedCovered: string[] = []): Promise<NextQuestion> {
  const covered = coveredClinicalInformation(context, suppliedCovered);
  const fallback = fallbackDecision(context, covered);
  const result = await askIntakeJson<Partial<NextQuestion>>([
    { role: "system", content: "Choose ONE highest-value next clinical action from the allowlist. Use all patient answers, SEX, previous context, documents, semantic facts, safety flags, contradictions and covered dimensions. Never ask a covered dimension. Do not diagnose. Return only JSON: {action:'ASK_QUESTION|CLARIFY_CONTRADICTION|SAFETY_ESCALATION|REQUEST_DOCUMENT|CONFIRM_INFORMATION|CORRECT_PATIENT_CONTEXT|REQUEST_MISSING_CRITICAL_INFORMATION|CONTINUE_APPOINTMENT|COMPLETE_INTAKE|PREPARE_DOCTOR_BRIEF',key:'duration|severity|associatedSymptoms|priorConsultation|priorReports',question:'one short Hindi/Hinglish question',reasonCode:'allowlisted short code',confidence:'LOW|MEDIUM|HIGH'}. The application validates it." },
    { role: "user", content: JSON.stringify({ ...context, coveredClinicalInformation: covered }) },
  ]);
  if (validNext(result, covered)) return { ...result, candidateActions: [result.action as NextAction] } as NextQuestion;
  return { ...fallback, candidateActions: [fallback.action] };
}

export { assessAppointmentContext, detectAppointmentSafetyFlags, extractSemanticFacts, explicitSexCorrection };
