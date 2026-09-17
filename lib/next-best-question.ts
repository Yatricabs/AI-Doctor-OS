import { askAIForJSON } from "@/lib/puter-ai";

export const CLINICAL_COVERAGE_KEYS = [
  "duration", "severity", "character", "symptom_location", "associated_symptoms",
  "red_flags", "medical_history", "treatment_history", "medications", "reports", "functional_impact",
] as const;

export type ClinicalCoverageKey = typeof CLINICAL_COVERAGE_KEYS[number];

export const NEXT_CLINICAL_ACTIONS = [
  "CONTINUE_WITH_QUESTION", "ASK_CLARIFICATION", "ASK_SAFETY_QUESTION",
  "REQUEST_DURATION", "REQUEST_SEVERITY", "REQUEST_ASSOCIATED_SYMPTOMS",
  "REQUEST_RELEVANT_HISTORY", "REQUEST_TREATMENT_HISTORY", "REQUEST_MEDICATION_HISTORY",
  "REQUEST_REPORT", "READY_TO_FINALIZE",
] as const;

export type NextClinicalAction = typeof NEXT_CLINICAL_ACTIONS[number];

export type ClinicalQaTurn = {
  question: string;
  answer: string;
  coverageTarget?: ClinicalCoverageKey;
};

export type NextBestDecision = {
  action: NextClinicalAction;
  question: string;
  coverageTarget: ClinicalCoverageKey | null;
  rationale: string;
  missingInformation: ClinicalCoverageKey[];
  safetyConcern: boolean;
  readyToFinalize: boolean;
};

export type NextBestContext = {
  answers: Record<string, string>;
  qaLog: ClinicalQaTurn[];
  semanticFacts: { kind: string; value: string; polarity: string; confidence: string; evidence: string }[];
  clarificationHistory: { question: string; answer: string }[];
  previousPatientAnswers: string[];
  urgent: boolean;
};

export function coveredClinicalInformation(context: NextBestContext): ClinicalCoverageKey[] {
  const covered = new Set<ClinicalCoverageKey>();
  if (context.answers.duration) covered.add("duration");
  if (context.answers.priorConsultation) covered.add("treatment_history");
  if (context.answers.priorReports) covered.add("reports");
  context.qaLog.forEach((turn) => { if (turn.coverageTarget) covered.add(turn.coverageTarget); });
  return [...covered];
}

function fallbackDecision(covered: ClinicalCoverageKey[]): NextBestDecision {
  const fallback: { target: ClinicalCoverageKey; action: NextClinicalAction; question: string }[] = [
    { target: "duration", action: "REQUEST_DURATION", question: "Yeh takleef aapko kab se hai?" },
    { target: "severity", action: "REQUEST_SEVERITY", question: "Is takleef ki teevrata 1 se 10 mein kitni hai?" },
    { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Iske saath aur kaun se lakshan ho rahe hain?" },
    { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya iske saath behoshi, saans lene mein dikkat, bahut zyada bleeding ya achanak bahut tez takleef hai?" },
    { target: "medical_history", action: "REQUEST_RELEVANT_HISTORY", question: "Kya aapko koi purani bimari ya isi tarah ki takleef pehle bhi hui hai?" },
    { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne is takleef ke liye pehle koi ilaaj ya doctor ki salah li hai?" },
    { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Kya aap abhi koi dawa niyamit roop se le rahe hain?" },
    { target: "reports", action: "REQUEST_REPORT", question: "Kya is takleef se judi koi report, scan ya prescription available hai?" },
    { target: "functional_impact", action: "CONTINUE_WITH_QUESTION", question: "Is takleef se aapki rozmarra ki activities par kitna asar pad raha hai?" },
  ];
  const next = fallback.find((item) => !covered.includes(item.target));
  if (next) return { action: next.action, question: next.question, coverageTarget: next.target, rationale: "Safe fallback selected an uncovered clinical dimension.", missingInformation: fallback.filter((item) => !covered.includes(item.target)).map((item) => item.target), safetyConcern: next.action === "ASK_SAFETY_QUESTION", readyToFinalize: false };
  return { action: "READY_TO_FINALIZE", question: "", coverageTarget: null, rationale: "Minimum clinical coverage is complete.", missingInformation: [], safetyConcern: false, readyToFinalize: true };
}

function validateDecision(raw: NextBestDecision | null, covered: ClinicalCoverageKey[], qaCount: number): NextBestDecision | null {
  if (!raw || !NEXT_CLINICAL_ACTIONS.includes(raw.action) || typeof raw.question !== "string" || typeof raw.rationale !== "string" || !Array.isArray(raw.missingInformation)) return null;
  if (raw.coverageTarget !== null && !CLINICAL_COVERAGE_KEYS.includes(raw.coverageTarget)) return null;
  if (raw.missingInformation.some((item) => !CLINICAL_COVERAGE_KEYS.includes(item))) return null;
  if (raw.action === "READY_TO_FINALIZE") {
    if (!covered.includes("duration") || !covered.includes("red_flags") || qaCount < 3) return null;
    return { ...raw, question: "", coverageTarget: null, readyToFinalize: true };
  }
  if (!raw.question.trim() || raw.question.length > 500 || !raw.coverageTarget || covered.includes(raw.coverageTarget)) return null;
  return { ...raw, readyToFinalize: false };
}

export async function decideNextBestQuestion(context: NextBestContext): Promise<NextBestDecision> {
  const covered = coveredClinicalInformation(context);
  const generated = await Promise.race([
    askAIForJSON<NextBestDecision>([
      { role: "system", content: `You select exactly ONE next-best action for a clinical intake. Use the complete context, semantic facts, and already-covered dimensions. Prioritize immediate safety gaps, then the highest-value complaint-specific missing information. Do not diagnose. Do not repeat covered information. Return only an allowlisted action and coverage key. Actions: ${NEXT_CLINICAL_ACTIONS.join(", ")}. Coverage keys: ${CLINICAL_COVERAGE_KEYS.join(", ")}. Return JSON exactly: {"action":"...","question":"one short Hindi/Hinglish question or empty for finalize","coverageTarget":"allowed key or null","rationale":"short reason","missingInformation":["allowed keys"],"safetyConcern":false,"readyToFinalize":false}.` },
      { role: "user", content: JSON.stringify({ ...context, coveredInformation: covered }) },
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);
  return validateDecision(generated, covered, context.qaLog.length) ?? fallbackDecision(covered);
}
