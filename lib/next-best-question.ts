import { askAIForJSON } from "./puter-ai.ts";
import { matchPathway } from "./clinicalPathways.ts";

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

function combinePatientText(context: NextBestContext): string {
  const pieces = [
    context.answers.chiefComplaint || "",
    context.answers.duration || "",
    context.answers.priorConsultation || "",
    context.answers.priorReports || "",
    ...context.qaLog.map((turn) => `${turn.question} ${turn.answer}`),
    ...context.previousPatientAnswers,
    ...context.clarificationHistory.map((turn) => `${turn.question} ${turn.answer}`),
  ];
  return pieces.join(" ");
}

export function coveredClinicalInformation(context: NextBestContext): ClinicalCoverageKey[] {
  const covered = new Set<ClinicalCoverageKey>();
  const allText = combinePatientText(context);

  if (context.answers.duration?.trim()) covered.add("duration");
  if (context.answers.priorConsultation?.trim()) covered.add("treatment_history");
  if (context.answers.priorReports?.trim()) covered.add("reports");

  context.qaLog.forEach((turn) => {
    if (turn.coverageTarget) covered.add(turn.coverageTarget);
  });

  // 1. Duration in text: e.g. "3 din se", "2 hafte se", "kal raat se", "aaj subah se", "do din se"
  if (/\b((\d+|ek|do|teen|chaar|char|paanch|panch|chhe|che|saat|aath|nau|das|one|two|three|four|five|several|few)\s*(day|days|din|hafte|week|weeks|mahine|month|ghante|hours)|since|kal raat|kal se|aaj se|subah se|parso se|pehle se)\b/i.test(allText)) {
    covered.add("duration");
  }

  // 2. Severity in text: e.g. "tez dard", "8/10", "bahut zyada", "mild", "severe"
  if (/\b(1\s*(to|-|se|से)\s*10|[0-9]+\s*(\/10|out of 10)|mild|moderate|severe|tez|bahut tez|halka|bardasht nahi|unbearable)\b/i.test(allText)) {
    covered.add("severity");
  }

  // 3. Character in text: e.g. "marod", "jalan", "chubhan", "jakdan", "dabav"
  if (/\b(marod|cramp|jalan|burning|chubhan|sharp|stabbing|dabav|pressure|jakdan|tightness|heavy|sookhi|sukhi|balgam|phlegm|continuous|lagataar)\b/i.test(allText)) {
    covered.add("character");
  }

  // 4. Symptom location in text: e.g. "pet", "seene", "sar", "gale", "kamar"
  if (/\b(pet|stomach|abdomen|seene|chest|sar|sir|head|gale|throat|kamar|back|peeth|pair|leg|haath|hand|arm|gardan|neck|aankh|eye|kaan|ear|daant|tooth|teeth|ghutne|knee|skin|chamdi)\b/i.test(allText)) {
    covered.add("symptom_location");
  }

  // 5. Associated symptoms in text: e.g. "ulti", "bukhar", "dast", "khansi", "chills"
  if (/\b(ulti|vomit|bukhar|fever|cough|khansi|chills|thandi|shivering|loose motion|dast|chakkar|giddiness|ghabrahat|kamzori|weakness|balgam|phlegm|acidity|jalan)\b/i.test(allText)) {
    // Only mark as associated symptoms if there's more than just the chief complaint itself
    const complaint = (context.answers.chiefComplaint || "").toLowerCase();
    const matches = allText.match(/\b(ulti|vomit|bukhar|fever|cough|khansi|chills|thandi|shivering|loose motion|dast|chakkar|giddiness|ghabrahat|kamzori|weakness|balgam|phlegm|acidity)\b/gi) || [];
    const nonComplaintMatches = matches.filter((m) => !complaint.includes(m.toLowerCase()));
    if (nonComplaintMatches.length > 0 || context.qaLog.some((t) => t.coverageTarget === "associated_symptoms")) {
      covered.add("associated_symptoms");
    }
  }

  // 6. Medical history
  if (/\b(sugar|diabetes|bp|blood pressure|thyroid|asthma|purani bimari|pehle se hai)\b/i.test(allText)) {
    covered.add("medical_history");
  }

  // 7. Treatment history
  if (/\b(doctor|clinic|hospital|dikhaya|ilaaj|treatment|consult|parchi)\b/i.test(allText)) {
    covered.add("treatment_history");
  }

  // 8. Medications
  if (/\b(paracetamol|tablet|dawa|medicine|antacid|syrup|goli|le raha|le rahi)\b/i.test(allText)) {
    covered.add("medications");
  }

  // 9. Reports
  if (/\b(report|scan|x-ray|blood test|prescription|mri|ct|ultrasound)\b/i.test(allText)) {
    covered.add("reports");
  }

  return [...covered];
}

export function resolvePathwayId(complaint: string): string {
  const t = complaint.toLowerCase();
  if (/\b(seene|chhati|heart|chest)\b/i.test(t) && /\b(dard|pain|jakdan|tightness|dabav|pressure)\b/i.test(t)) {
    return "chest_pain";
  }
  if (/\b(pet|stomach|abdomen|tummy)\b/i.test(t) && /\b(dard|pain|cramp|marod|gas|jalan)\b/i.test(t)) {
    return "abdominal_pain";
  }
  if (/\b(fever|bukhar|temperature|jvar)\b/i.test(t)) {
    return "fever";
  }
  if (/\b(sar|sir|head)\b/i.test(t) && /\b(dard|pain|ache|migraine)\b/i.test(t)) {
    return "headache";
  }
  if (/\b(khansi|khaansi|cough|balgam|saans)\b/i.test(t)) {
    return "cough_breathing";
  }
  if (/\b(dast|diarrhea|diarrhoea|loose motion|loose stool)\b/i.test(t)) {
    return "diarrhea";
  }
  if (/\b(ulti|vomit|nausea)\b/i.test(t)) {
    return "vomiting";
  }
  if (/\b(peshab|peshaab|urine|uti)\b/i.test(t)) {
    return "urinary";
  }
  if (/\b(kamar|peeth|back)\b/i.test(t) && /\b(dard|pain)\b/i.test(t)) {
    return "back_pain";
  }
  if (/\b(rash|khujli|itching|daane|chakatte)\b/i.test(t)) {
    return "skin_rash";
  }
  const matched = matchPathway(complaint);
  return matched?.id ?? "general";
}

export function fallbackDecision(context: NextBestContext, covered: ClinicalCoverageKey[]): NextBestDecision {
  const complaint = context.answers.chiefComplaint || "";
  const pathwayId = resolvePathwayId(complaint);
  const qaCount = context.qaLog.length;

  // Finalize when minimum clinical coverage is met (at least 3 turns, red_flags screened, and duration covered)
  if (qaCount >= 3 && covered.includes("duration") && covered.includes("red_flags") && (covered.includes("treatment_history") || covered.includes("reports") || qaCount >= 4)) {
    return {
      action: "READY_TO_FINALIZE",
      question: "",
      coverageTarget: null,
      rationale: "Clinical intake completed with core symptom, duration, and safety red flags covered.",
      missingInformation: [],
      safetyConcern: false,
      readyToFinalize: true,
    };
  }

  type PathwayStep = { target: ClinicalCoverageKey; action: NextClinicalAction; question: string; isSafety?: boolean };
  let candidateSteps: PathwayStep[] = [];

  if (pathwayId === "chest_pain") {
    candidateSteps = [
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Dard kya baayein haath, jabde ya peeth tak jaata hai? Saans phoolna, paseena ya ghabrahat to nahi ho rahi?", isSafety: true },
      { target: "character", action: "CONTINUE_WITH_QUESTION", question: "Dard kaisa mehsoos ho raha hai — seene par bhaari dabav, jakdan, jalan ya teekha chubhan?" },
      { target: "duration", action: "REQUEST_DURATION", question: "Yeh seene ka dard kab shuru hua aur abhi bhi ho raha hai kya?" },
      { target: "medical_history", action: "REQUEST_RELEVANT_HISTORY", question: "Kya aapko pehle se High BP, diabetes, ya dil ki koi bimari hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne iske liye koi dawai li ya pehle kisi doctor ko dikhaya hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya pehle ka koi ECG ya heart se judi koi report available hai?" },
    ];
  } else if (pathwayId === "abdominal_pain") {
    candidateSteps = [
      { target: "symptom_location", action: "CONTINUE_WITH_QUESTION", question: "Pet mein dard kis hisse mein ho raha hai — upar, neeche, ya dahine/baayein taraf? Aur kaisa dard hai — marod ya jalan?" },
      { target: "duration", action: "REQUEST_DURATION", question: "Pet mein yeh dard kab se shuru hua hai?" },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Kya iske saath ulti, dast (loose motions), bukhar ya gas ki dikkat ho rahi hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya pet patthar jaisa kathor lag raha hai, achanak behoshi aayi, ya ulti/latrine mein khoon aaya hai?", isSafety: true },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne iske liye koi dawa li ya doctor ko dikhaya hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya is takleef se judi koi USG, blood test report ya prescription hai?" },
    ];
  } else if (pathwayId === "fever") {
    candidateSteps = [
      { target: "duration", action: "REQUEST_DURATION", question: "Yeh bukhar kab se hai aur kya thermometer se naapa tha (kitna taapman tha)?" },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Kya bukhar ke saath thandi/kaampna (chills), sirdard, gale mein kharash ya badan dard ho raha hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya gardan mein akdan, daura/jhatke, behoshi ya sharir par koi laal chakatte dikh rahe hain?", isSafety: true },
      { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Bukhar ke liye kya abhi tak koi Paracetamol ya koi aur dawa li hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya is bukhar ke liye pehle kisi doctor se salah li hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya CBC, malaria, dengue ya koi aur blood report karwayi hai?" },
    ];
  } else if (pathwayId === "cough_breathing") {
    candidateSteps = [
      { target: "character", action: "CONTINUE_WITH_QUESTION", question: "Khansi sookhi hai ya balgam (phlegm) aa raha hai? Balgam ka rang kaisa hai?" },
      { target: "duration", action: "REQUEST_DURATION", question: "Yeh khansi kab se ho rahi hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya saans phoolti hai, seene mein seeti jaisi aawaz aati hai, ya balgam mein khoon aaya hai?", isSafety: true },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Kya iske saath bukhar, seene mein dard ya raat ko paseena aata hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne iske liye koi cough syrup, inhaler ya doctor ki salah li hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya koi Chest X-ray ya purani prescription available hai?" },
    ];
  } else if (pathwayId === "headache") {
    candidateSteps = [
      { target: "symptom_location", action: "CONTINUE_WITH_QUESTION", question: "Sirdard aage, peeche ya kisi ek taraf ho raha hai? Aur kya dard achanak shuru hua ya dheere-dheere badha?" },
      { target: "duration", action: "REQUEST_DURATION", question: "Yeh sirdard kitne samay se ho raha hai aur pehle bhi kabhi aisa hua hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya aankhon ke aage dhundhlapan, ulti jaisa lagna, gardan mein akdan ya haath-pair mein kamzori mehsoos ho rahi hai?", isSafety: true },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Kya tez roshni ya aawaz se dard aur zyada badh jaata hai?" },
      { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Dard kam karne ke liye kya koi painkiller dawa li hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya pehle kabhi migraine ya sinusitis ke liye doctor ko dikhaya hai?" },
    ];
  } else if (pathwayId === "diarrhea" || pathwayId === "vomiting") {
    candidateSteps = [
      { target: "duration", action: "REQUEST_DURATION", question: "Dast ya ulti kab se shuru hui hai aur din mein lagbhag kitni baar ho chuki hai?" },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Motion kaisa hai — paani jaisa patla, aam (mucus) ya pet mein marod ke saath? Kya bukhar bhi hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya peshab bohot kam ho gaya hai, muh sookh raha hai, chakkar/behoshi lagti hai, ya motion mein khoon aaya hai?", isSafety: true },
      { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Kya ORS ka ghol, zinc ya koi antibiotic dawa shuru ki hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya is takleef ke liye pehle kisi clinic ya doctor ko dikhaya hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya stool routine ya blood test ki koi report hai?" },
    ];
  } else if (pathwayId === "urinary") {
    candidateSteps = [
      { target: "duration", action: "REQUEST_DURATION", question: "Peshab mein yeh pareshani kab se ho rahi hai?" },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Peshab mein jalan ke alawa kya baar-baar aana, kamar ya baju (flank) mein dard ya bukhar bhi hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya peshab mein khoon (laal rang) dikhai diya hai ya peshab bilkul ruk gaya hai?", isSafety: true },
      { target: "medical_history", action: "REQUEST_RELEVANT_HISTORY", question: "Kya pehle kabhi UTI, kidney stone (pathri) ya prostate ki problem rahi hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne iske liye koi antibiotic ya doctor ki salah li hai?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya Urine routine/culture ya USG report available hai?" },
    ];
  } else if (pathwayId === "back_pain") {
    candidateSteps = [
      { target: "symptom_location", action: "CONTINUE_WITH_QUESTION", question: "Dard kamar ke kis hisse mein hai aur kya yeh neeche pair ya jaangh tak jaata hai?" },
      { target: "duration", action: "REQUEST_DURATION", question: "Kamar dard kab se hai? Kya koi bhaari saman uthane ya jhatka lagne ke baad shuru hua tha?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya pair mein sunnapan, kamzori ya peshab/latrine rokne mein koi dikkat mehsoos ho rahi hai?", isSafety: true },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya pehle is dard ke liye koi X-ray, physiotherapy ya doctor ki salah li hai?" },
      { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Kya aap dard kam karne ke liye koi dawa le rahe hain?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya spine ka koi X-ray ya MRI scan report available hai?" },
    ];
  } else if (pathwayId === "skin_rash") {
    candidateSteps = [
      { target: "symptom_location", action: "CONTINUE_WITH_QUESTION", question: "Chakatte ya daane sharir mein kahan-kahan hain aur kya tezi se fail rahe hain?" },
      { target: "character", action: "CONTINUE_WITH_QUESTION", question: "Kya inme bohot tez khujli, jalan ya chhale (blisters) ban rahe hain?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya chehre ya hothon par sujan, bukhar ya saans lene mein dikkat ho rahi hai?", isSafety: true },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya koi naya saabun, cream ya dawa shuru karne ke baad yeh hua tha?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya pehle ka koi prescription ya report available hai?" },
    ];
  } else {
    // General structured clinical pathway
    candidateSteps = [
      { target: "duration", action: "REQUEST_DURATION", question: "Yeh takleef aapko kab se hai?" },
      { target: "severity", action: "REQUEST_SEVERITY", question: "Is takleef ki teevrata 1 se 10 mein kitni hai?" },
      { target: "associated_symptoms", action: "REQUEST_ASSOCIATED_SYMPTOMS", question: "Iske saath aur kaun se lakshan ya pareshani ho rahi hai?" },
      { target: "red_flags", action: "ASK_SAFETY_QUESTION", question: "Kya iske saath behoshi, saans lene mein dikkat, bahut zyada bleeding ya achanak bahut tez takleef hai?", isSafety: true },
      { target: "medical_history", action: "REQUEST_RELEVANT_HISTORY", question: "Kya aapko koi purani bimari ya isi tarah ki takleef pehle bhi hui hai?" },
      { target: "treatment_history", action: "REQUEST_TREATMENT_HISTORY", question: "Kya aapne is takleef ke liye pehle koi ilaaj ya doctor ki salah li hai?" },
      { target: "medications", action: "REQUEST_MEDICATION_HISTORY", question: "Kya aap abhi koi dawa niyamit roop se le rahe hain?" },
      { target: "reports", action: "REQUEST_REPORT", question: "Kya is takleef se judi koi report, scan ya prescription available hai?" },
      { target: "functional_impact", action: "CONTINUE_WITH_QUESTION", question: "Is takleef se aapki rozmarra ki activities par kitna asar pad raha hai?" },
    ];
  }

  const next = candidateSteps.find((item) => !covered.includes(item.target));
  if (next) {
    return {
      action: next.action,
      question: next.question,
      coverageTarget: next.target,
      rationale: `Selected complaint-specific clinical dimension: ${next.target} for pathway: ${pathwayId ?? "general"}`,
      missingInformation: candidateSteps.filter((item) => !covered.includes(item.target)).map((item) => item.target),
      safetyConcern: Boolean(next.isSafety),
      readyToFinalize: false,
    };
  }

  return {
    action: "READY_TO_FINALIZE",
    question: "",
    coverageTarget: null,
    rationale: "All relevant clinical dimensions are covered.",
    missingInformation: [],
    safetyConcern: false,
    readyToFinalize: true,
  };
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
  const complaint = context.answers.chiefComplaint || "";
  const pathway = matchPathway(complaint);

  const generated = await Promise.race([
    askAIForJSON<NextBestDecision>([
      {
        role: "system",
        content: `You select exactly ONE next-best action for a clinical intake.
Complaint category: ${pathway?.displayName ?? "General clinical intake"}.
Use the complete context, semantic facts, and already-covered dimensions.
Prioritize immediate safety gaps, then highest-value complaint-specific missing information.
Do not repeat covered information.
Actions: ${NEXT_CLINICAL_ACTIONS.join(", ")}.
Coverage keys: ${CLINICAL_COVERAGE_KEYS.join(", ")}.
Return JSON exactly: {"action":"...","question":"one short Hindi/Hinglish question or empty for finalize","coverageTarget":"allowed key or null","rationale":"short reason","missingInformation":["allowed keys"],"safetyConcern":false,"readyToFinalize":false}.`,
      },
      { role: "user", content: JSON.stringify({ ...context, coveredInformation: covered, matchedPathway: pathway?.id ?? "general" }) },
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);

  return validateDecision(generated, covered, context.qaLog.length) ?? fallbackDecision(context, covered);
}
