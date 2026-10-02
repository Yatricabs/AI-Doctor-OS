import type { ClinicalQaTurn } from "./next-best-question.ts";
import { checkIntelligibility } from "./intakeValidation.ts";

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

// The model is allowed to enrich this assessment, but it must never be the
// only protection against a semantic conflict. This conservative fallback is
// intentionally category-based: it extracts a reported anatomy/reproductive
// fact and compares it with the declared structured context. It does not
// diagnose or overwrite SEX, and it only blocks progression when clarification
// is genuinely needed.
function deterministicSemanticAssessment(context: SemanticContext): SemanticAssessment {
  const intell = checkIntelligibility(context.latestAnswer);
  if (!intell.intelligible && context.latestAnswer.trim().length > 0) {
    return {
      status: "NEEDS_CLARIFICATION",
      facts: [],
      explanation: `Latest answer appears unintelligible or nonsensical: ${intell.reason}`,
      question: "Maaf kijiye, hum aapka jawab samajh nahi paaye. Kripya thoda spasht shabdon mein bataiye.",
    };
  }

  const text = context.latestAnswer.toLocaleLowerCase();
  const sex = String(context.answers.sex ?? "").trim().toLocaleLowerCase();
  const facts: SemanticFact[] = [];

  const anatomy = [
    { value: "vagina", pattern: /\bvagina\b|योनि|महिला अंग/ },
    { value: "penis", pattern: /\bpenis\b|लिंग|शिश्न/ },
    { value: "uterus", pattern: /\buterus\b|गर्भाशय/ },
    { value: "prostate", pattern: /\bprostate\b|प्रोस्टेट/ },
    { value: "testicle", pattern: /\btesticle(?:s)?\b|अंडकोष/ },
  ];
  for (const item of anatomy) {
    if (item.pattern.test(text)) facts.push({ kind: "ANATOMY_REFERENCE", value: item.value, polarity: "PRESENT", confidence: "HIGH", evidence: context.latestAnswer.slice(0, 500) });
  }

  if (/period|menstru|menstrual|मासिक|पीरियड|महावारी/.test(text)) {
    facts.push({ kind: "REPRODUCTIVE_CLAIM", value: "menstrual bleeding", polarity: "PRESENT", confidence: "HIGH", evidence: context.latestAnswer.slice(0, 500) });
  }
  if (/discharge|स्राव|डिस्चार्ज|infection|इन्फेक्शन/.test(text)) {
    facts.push({ kind: "SYMPTOM", value: "genital/reproductive symptom", polarity: "PRESENT", confidence: "MEDIUM", evidence: context.latestAnswer.slice(0, 500) });
  }

  const hasVaginalOrReproductiveFact = facts.some((fact) =>
    (fact.kind === "ANATOMY_REFERENCE" && ["vagina", "uterus"].includes(fact.value))
    || fact.kind === "REPRODUCTIVE_CLAIM",
  );
  const declaredMan = /^(man|male|पुरुष)$/.test(sex);
  if (declaredMan && hasVaginalOrReproductiveFact) {
    return {
      status: "NEEDS_CLARIFICATION",
      facts,
      explanation: "The latest anatomy or reproductive statement needs clarification against the declared SEX context.",
      question: "Aapne pehle SEX mein 'Man' select kiya tha, lekin ab aapne reproductive/vaginal symptom bataya hai. Main sahi samajhne ke liye confirm karna chahta hoon—kya aap apna pehle wala SEX answer correct karna chahte hain, ya aap kisi alag type ke symptom ki baat kar rahe hain?",
    };
  }
  return { ...CONSISTENT, facts };
}

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
  const deterministic = deterministicSemanticAssessment(context);
  if (deterministic.status === "NEEDS_CLARIFICATION") return deterministic;
  const generated = await Promise.race([
    askAIForJSON<SemanticAssessment>([
      { role: "system", content: `You extract clinically relevant semantic facts and assess whether the latest answer is consistent with accumulated patient context. Do not diagnose, infer anatomy from declared SEX, or impose binary assumptions. Treat reported anatomy, body sites, reproductive symptoms, medications, diagnoses, treatment, and history as patient statements that may require respectful clarification against declared context. If a statement is materially ambiguous or conflicts with context, return NEEDS_CLARIFICATION and one Hindi/Hinglish question. Do not use special-case rules; assess the meaning of the complete context. Extract only facts relevant to reasoning. Return JSON exactly: {"status":"CONSISTENT|AMBIGUOUS|NEEDS_CLARIFICATION","facts":[{"kind":"ANATOMY_REFERENCE|BODY_LOCATION|SYMPTOM|SYMPTOM_CHARACTERISTIC|MEDICATION_CLAIM|DIAGNOSIS_CLAIM|TREATMENT_CLAIM|HISTORY_CLAIM|REPRODUCTIVE_CLAIM","value":"...","polarity":"PRESENT|DENIED|UNCERTAIN","confidence":"LOW|MEDIUM|HIGH","evidence":"..."}],"explanation":"short reason","question":"question or empty string"}.` },
      { role: "user", content: JSON.stringify(context) },
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);
  return validAssessment(generated) ? { ...generated, facts: [...deterministic.facts, ...generated.facts] } : deterministic;
}
