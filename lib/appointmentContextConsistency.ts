/**
 * Deterministic evidence extraction and context validation for patient intake.
 * This is a consistency/safety boundary, not a diagnosis engine. Model output
 * may add evidence, but it cannot bypass these checks or mutate answers.
 */

import { checkIntelligibility } from "./intakeValidation.ts";

export type FactKind =
  | "ANATOMY_REFERENCE" | "BODY_LOCATION" | "SYMPTOM" | "SYMPTOM_CHARACTERISTIC"
  | "MEDICATION_CLAIM" | "DIAGNOSIS_CLAIM" | "TREATMENT_CLAIM" | "HISTORY_CLAIM" | "REPRODUCTIVE_CLAIM";
export type FactPolarity = "PRESENT" | "DENIED" | "UNCERTAIN";
export type FactSource = "PATIENT" | "PREVIOUS_APPOINTMENT" | "DOCUMENT" | "DOCTOR" | "AI";

export type SemanticFact = {
  kind: FactKind;
  value: string;
  conceptKey?: string;
  polarity?: FactPolarity;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: string;
  source?: FactSource;
};

export type ContextContradiction = {
  code: "DEMOGRAPHIC_ANATOMY_MISMATCH" | "OPPOSING_CLAIMS" | "CHANGED_BODY_SITE" | "HISTORY_MISMATCH";
  current: string;
  previous: string;
  explanation: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type SafetyFlag = {
  code: "CHEST_OR_BREATHING" | "SEVERE_BLEEDING" | "NEUROLOGICAL" | "SEVERE_SYSTEMIC";
  evidence: string;
  severity: "URGENT_REVIEW" | "SAFETY_REVIEW";
};

export type ContextAssessment = {
  status: "CONSISTENT" | "NEEDS_CLARIFICATION" | "SAFETY_CONCERN";
  needsClarification: boolean;
  explanation: string;
  question: string;
  facts: SemanticFact[];
  contradictions: ContextContradiction[];
  safetyFlags: SafetyFlag[];
  reasonCodes: string[];
};

export type AppointmentContext = {
  patientType?: string;
  sex?: string;
  complaint?: string;
  latestAnswer?: string;
  previousAnswers?: string[];
  semanticFacts?: SemanticFact[];
  previousPatientContext?: string;
};

const anatomyPatterns: Array<[RegExp, string, string]> = [
  [/\b(vagina|vaginal|योनि|योनी)\b/i, "vaginal anatomy", "anatomy:vaginal"],
  [/\b(uterus|womb|गर्भाशय)\b/i, "uterine anatomy", "anatomy:uterine"],
  [/\b(penis|penile|लिंग)\b/i, "penile anatomy", "anatomy:penile"],
  [/\b(testicle|testis|अंडकोष)\b/i, "testicular anatomy", "anatomy:testicular"],
  [/\b(prostate|प्रोस्टेट)\b/i, "prostate anatomy", "anatomy:prostate"],
];

const locationPatterns: Array<[RegExp, string, string]> = [
  [/\b(left|baaye|बाएं)\b/i, "left side", "site:left"],
  [/\b(right|daaye|दाएं)\b/i, "right side", "site:right"],
  [/\b(chest|seene|सीने|heart|दिल)\b/i, "chest", "site:chest"],
  [/\b(abdomen|abdominal|pet|पेट)\b/i, "abdomen", "site:abdomen"],
  [/\b(back|kamar|पीठ|कमर)\b/i, "back", "site:back"],
  [/\b(head|sir|सिर)\b/i, "head", "site:head"],
  [/\b(urine|peshab|मूत्र|पेशाब)\b/i, "urinary system", "site:urinary"],
];

const symptomPatterns: Array<[RegExp, string, string]> = [
  [/\b(discharge|safed pani|white fluid|सफेद पानी)\b/i, "discharge", "symptom:discharge"],
  [/\b(pain|dard|दर्द|ache|pressure|dabav|दबाव)\b/i, "pain or pressure", "symptom:pain"],
  [/\b(period|periods|menstrual|menstruation|मासिक|पीरियड)\b/i, "menstrual bleeding", "symptom:menstrual"],
  [/\b(blood|bleeding|khoon|खून|रक्तस्राव)\b/i, "bleeding", "symptom:bleeding"],
  [/\b(fever|bukhar|बुखार)\b/i, "fever", "symptom:fever"],
  [/\b(vomit|vomiting|ulti|उल्टी)\b/i, "vomiting", "symptom:vomiting"],
  [/\b(breathless|breathing|saans|सांस|दम)\b/i, "breathing difficulty", "symptom:breathing"],
];

const negativeClaim = /\b(no|not|never|none|without|nahi|nahin|nahi hai|nahi leta|nahi leti|nahi li|नहीं|नही)\b/i;

function polarityFor(text: string): FactPolarity {
  if (negativeClaim.test(text)) return "DENIED";
  if (/\b(maybe|shayad|lagta hai|possibly|ho sakta)\b/i.test(text)) return "UNCERTAIN";
  return "PRESENT";
}

function fact(kind: FactKind, value: string, conceptKey: string, evidence: string, polarity: FactPolarity, confidence: SemanticFact["confidence"] = "MEDIUM"): SemanticFact {
  return { kind, value, conceptKey, evidence, polarity, confidence, source: "PATIENT" };
}

/** Extract only concepts that can change consistency, safety, or question choice. */
export function extractSemanticFacts(text: string, source: FactSource = "PATIENT"): SemanticFact[] {
  const value = text.trim();
  if (!value) return [];
  const polarity = polarityFor(value);
  const result: SemanticFact[] = [];
  anatomyPatterns.forEach(([pattern, label, key]) => { if (pattern.test(value)) result.push(fact("ANATOMY_REFERENCE", label, key, value, polarity, "HIGH")); });
  locationPatterns.forEach(([pattern, label, key]) => { if (pattern.test(value)) result.push(fact("BODY_LOCATION", label, key, value, polarity)); });
  symptomPatterns.forEach(([pattern, label, key]) => { if (pattern.test(value)) result.push(fact(key === "symptom:menstrual" ? "REPRODUCTIVE_CLAIM" : "SYMPTOM", label, key, value, polarity, "HIGH")); });
  if (/\b(1\s*(to|-|से)\s*10|[0-9]+\s*(\/10|out of 10)|mild|moderate|severe|bahut tez|बहुत तेज)\b/i.test(value)) result.push(fact("SYMPTOM_CHARACTERISTIC", "severity described", "character:severity", value, polarity));
  if (/\b(antibiotic|antibiotics|medicine|medicines|medication|dawa|दवा|tablet|capsule|syrup)\b/i.test(value)) result.push(fact("MEDICATION_CLAIM", polarity === "DENIED" ? "no current medication" : "medication use", "history:medication", value, polarity, "HIGH"));
  if (/\b(diabetes|bp|blood pressure|asthma|allergy|allergic|मधुमेह|एलर्जी)\b/i.test(value)) result.push(fact("DIAGNOSIS_CLAIM", "medical condition or allergy mentioned", "history:diagnosis", value, polarity));
  if (/\b(doctor|treatment|treated|operation|surgery|prescription|antibiotic|antibiotics|dawa li|medicine li|ilaaj li|doctor ko dikhaya|इलाज|डॉक्टर)\b/i.test(value)) result.push(fact("TREATMENT_CLAIM", "prior consultation or treatment mentioned", "history:treatment", value, polarity));
  if (/\b(previous|pehle|earlier|past|history|पहले|पुराना)\b/i.test(value)) result.push(fact("HISTORY_CLAIM", "relevant prior history mentioned", "history:prior", value, polarity));
  return result.map((item) => ({ ...item, source }));
}

function hasSex(sex: string | undefined, value: string) { return new RegExp(`\\b${value}\\b`, "i").test(sex ?? ""); }

function safetyFlags(text: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  if (/\b(chest pain|seene? mein (dard|pressure)|pressure.*chest|saans.*(nahi|problem|phool|dikkat)|breathless|बेहोश|behosh|faint)\b/i.test(text)) flags.push({ code: "CHEST_OR_BREATHING", evidence: text, severity: "URGENT_REVIEW" });
  if (/\b(heavy bleeding|severe bleeding|bahut khoon|khun bahut|uncontrolled bleeding|बहुत ज्यादा खून)\b/i.test(text)) flags.push({ code: "SEVERE_BLEEDING", evidence: text, severity: "URGENT_REVIEW" });
  if (/\b(stroke|one side weak|face droop|seizure|fits|convulsion|अचानक कमजोरी)\b/i.test(text)) flags.push({ code: "NEUROLOGICAL", evidence: text, severity: "URGENT_REVIEW" });
  if (/\b(unconscious|बेहोशी|blue lips|high fever.*stiff|बहुत तेज बुखार)\b/i.test(text)) flags.push({ code: "SEVERE_SYSTEMIC", evidence: text, severity: "SAFETY_REVIEW" });
  return flags;
}

function uniqueFacts(facts: SemanticFact[]) {
  const seen = new Set<string>();
  return facts.filter((item) => { const key = `${item.conceptKey ?? item.value}:${item.polarity ?? "PRESENT"}:${item.evidence}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function contradictionQuestion(contradiction: ContextContradiction, facts: SemanticFact[]) {
  if (contradiction.code === "DEMOGRAPHIC_ANATOMY_MISMATCH") {
    const reported = facts.some((item) => item.conceptKey === "symptom:menstrual") ? "periods/menstrual symptom" : "vaginal or reproductive symptom";
    return `Aapne sex mein “${contradiction.previous}” select kiya tha, lekin ab aap ${reported} bata rahe hain. Main galat assumption nahi karna chahta. Kya pehle diya gaya sex answer galat tha, ya aap kisi aur vyakti/anya symptom ki baat kar rahe hain?`;
  }
  if (contradiction.code === "CHANGED_BODY_SITE") return "Aapne pehle ek jagah batayi thi aur ab doosri jagah. Kripya confirm karein ki takleef kis jagah par hai, ya dono jagah hai?";
  return "Aapke abhi ke answer aur pehle di hui jaankari mein antar dikh raha hai. Kripya batayein ki inmein se kaunsi jaankari sahi hai, taaki main sahi agla sawaal pooch sakun.";
}

/** General cross-turn consistency check; it deliberately does not diagnose. */
export function assessAppointmentContext(context: AppointmentContext): ContextAssessment {
  const latest = context.latestAnswer ?? context.complaint ?? "";
  const currentFacts = extractSemanticFacts(latest);
  const earlierFacts = uniqueFacts([
    ...(context.semanticFacts ?? []),
    ...(context.previousAnswers ?? []).flatMap((answer) => extractSemanticFacts(answer)),
    ...extractSemanticFacts(context.previousPatientContext ?? "", "PREVIOUS_APPOINTMENT"),
  ]);
  const flags = safetyFlags([latest, context.complaint ?? ""].join(" "));
  if (flags.length) return { status: "SAFETY_CONCERN", needsClarification: false, explanation: "A safety-relevant symptom was reported and must be reviewed before routine questioning.", question: "Yeh symptom safety ke liye important ho sakta hai. Kripya batayein: abhi saans ki dikkat, behoshi, bahut tez dard ya zyada bleeding to nahi hai? Agar hai, to turant emergency medical help lein.", facts: currentFacts, contradictions: [], safetyFlags: flags, reasonCodes: ["SAFETY_GATE"] };

  const intell = checkIntelligibility(latest);
  if (!intell.intelligible && latest.trim().length > 0) {
    return {
      status: "NEEDS_CLARIFICATION",
      needsClarification: true,
      explanation: `Unintelligible or nonsensical patient answer: ${intell.reason}`,
      question: "Kripya apni takleef ya jaankari thoda spasht shabdon mein likhiye taaki hum use samajh sakein.",
      facts: [],
      contradictions: [],
      safetyFlags: [],
      reasonCodes: ["UNINTELLIGIBLE_INPUT"],
    };
  }

  const contradictions: ContextContradiction[] = [];
  if (hasSex(context.sex, "man")) {
    const reproductive = currentFacts.find((item) => item.conceptKey === "anatomy:vaginal" || item.conceptKey === "anatomy:uterine" || item.conceptKey === "symptom:menstrual");
    if (reproductive) contradictions.push({ code: "DEMOGRAPHIC_ANATOMY_MISMATCH", current: reproductive.value, previous: "Man", explanation: "The latest answer refers to reproductive/vaginal context that needs confirmation against the declared SEX field.", confidence: "HIGH" });
  }
  if (/^new\s*patient$/i.test(context.patientType ?? "") && /\b(previous appointment|old prescription|prescription|purani parchi|pehle ki appointment|previous visit)\b/i.test([latest, context.previousPatientContext ?? ""].join(" "))) {
    contradictions.push({ code: "HISTORY_MISMATCH", current: "previous record or prescription mentioned", previous: "New patient", explanation: "Previous-care information was reported while this encounter is marked as a new-patient intake.", confidence: "MEDIUM" });
  }
  for (const current of currentFacts) {
    const previous = earlierFacts.find((item) => item.conceptKey && item.conceptKey === current.conceptKey && item.polarity && current.polarity && item.polarity !== current.polarity);
    if (previous) contradictions.push({ code: "OPPOSING_CLAIMS", current: current.value, previous: previous.value, explanation: "The latest claim has a different polarity from an earlier claim about the same clinical concept.", confidence: "MEDIUM" });
  }
  const currentSide = currentFacts.find((item) => item.conceptKey === "site:left" || item.conceptKey === "site:right");
  const previousSide = earlierFacts.find((item) => item.conceptKey === "site:left" || item.conceptKey === "site:right");
  if (currentSide && previousSide && currentSide.conceptKey !== previousSide.conceptKey) contradictions.push({ code: "CHANGED_BODY_SITE", current: currentSide.value, previous: previousSide.value, explanation: "The reported side/location changed and needs confirmation rather than being silently overwritten.", confidence: "MEDIUM" });
  if (contradictions.length) return { status: "NEEDS_CLARIFICATION", needsClarification: true, explanation: contradictions[0].explanation, question: contradictionQuestion(contradictions[0], currentFacts), facts: currentFacts, contradictions, safetyFlags: [], reasonCodes: contradictions.map((item) => item.code) };
  return { status: "CONSISTENT", needsClarification: false, explanation: "No material cross-turn contradiction was found by deterministic context checks.", question: "", facts: currentFacts, contradictions: [], safetyFlags: [], reasonCodes: ["CONTEXT_CONSISTENT"] };
}

/** A correction is accepted only when the patient explicitly states it. */
export function explicitSexCorrection(text: string): "Man" | "Woman" | "Transgender Man" | "Transgender Woman" | null {
  const value = text.toLowerCase();
  if (!/(galat|wrong|correct|sahi|select|answer|sex|ling|female|male|woman|man|mahila|purush)/i.test(text)) return null;
  if (/transgender\s*woman|trans woman/i.test(value)) return "Transgender Woman";
  if (/transgender\s*man|trans man/i.test(value)) return "Transgender Man";
  if (/\b(female|woman|mahila|aurat|स्त्री|महिला)\b/i.test(value)) return "Woman";
  if (/\b(male|man|purush|पुरुष)\b/i.test(value)) return "Man";
  return null;
}

export const detectAppointmentSafetyFlags = safetyFlags;


export function extractClinicalContext(text: string): string {
  // Fallback stub for missing clinical context extractor
  return text;
}
