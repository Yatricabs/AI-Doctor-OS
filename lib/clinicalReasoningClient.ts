/**
 * AI UPCHAR Proprietary Clinical Reasoning Gateway Client.
 *
 * Connects the Next.js application to the AI UPCHAR proprietary fine-tuned model
 * (Qwen-4B E3 Targeted Clinical Safety) served via `ai-upchar-llm/scripts/serve.py`
 * at `POST /v1/clinical/reason`.
 *
 * Core Principle: "AI assists. Doctors decide."
 * The model and fallback are advisory only. State transitions, diagnoses, and
 * prescriptions remain strictly under clinician authority.
 */

export type RecommendedAction = "ASK_QUESTION" | "CLARIFY" | "SAFETY_REVIEW";

export type ClinicalSemanticInterpretation = {
  symptom?: string;
  problems?: string[];
  temporal_facts?: string[];
  anatomy?: string[];
  severity?: string[];
  triggers?: string[];
  associated_symptoms?: string[];
  patient_reported_diagnoses?: string[];
  confirmed_diagnoses?: string[] | null;
  patient_statement?: string;
  [key: string]: unknown;
};

export type ClinicalReasoningRequest = {
  patient_context: Record<string, unknown>;
  current_answer: string;
  semantic_context: Record<string, unknown>;
  safety_state: {
    status?: "CLEAR" | "SAFETY_CONCERN" | "WARNING" | string;
    reason?: string;
    [key: string]: unknown;
  };
  retrieved_evidence: Array<Record<string, unknown>>;
};

export type ClinicalReasoningResponse = {
  semantic_interpretation: ClinicalSemanticInterpretation;
  clinical_considerations: string[];
  recommended_action: RecommendedAction;
  next_best_question: string | null;
  missing_information: string[];
  confidence: number | "LOW" | "MEDIUM" | "HIGH" | null;
  source: "AI_UPCHAR_E3_GATEWAY" | "CLINICAL_SAFETY_FLOOR";
  disclaimer: string;
};

const DEFAULT_GATEWAY_URL =
  process.env.AI_UPCHAR_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_AI_UPCHAR_GATEWAY_URL ||
  "http://127.0.0.1:8001";

const CLINICAL_DISCLAIMER =
  "AI assists. Doctors decide. Advisory decision support only; not a diagnosis or prescription.";

/**
 * Deterministic safety floor evaluator.
 * Guarantees zero downtime: if the local/hosted Python gateway is offline,
 * the application continues operating with conservative, clinical-grade safety rules.
 */
export function deterministicClinicalFloor(
  request: ClinicalReasoningRequest
): ClinicalReasoningResponse {
  const text = (request.current_answer || "").toLowerCase();
  const safetyStatus = request.safety_state?.status;

  const emergencyKeywords = [
    "chest pain", "chest pressure", "seene me dard", "chhati me dard",
    "saans lene me dikkat", "shortness of breath", "breathless",
    "unconscious", "behosh", "fainted", "chakkar kha ke gir",
    "heavy bleeding", "khoon behna", "vomiting blood", "ulti me khoon",
    "stroke", "facial droop", "paralysis", "slurred speech", "seizure", "daura",
  ];

  const hasEmergencySymptom = emergencyKeywords.some((k) => text.includes(k));
  const isSafetyConcern = safetyStatus === "SAFETY_CONCERN" || hasEmergencySymptom;

  const semantic: ClinicalSemanticInterpretation = {
    patient_statement: request.current_answer,
    confirmed_diagnoses: null, // Models must never independently confirm a diagnosis
    problems: [],
    temporal_facts: [],
    anatomy: [],
    severity: [],
    associated_symptoms: [],
    patient_reported_diagnoses: [],
  };

  // Symptom & temporal extraction
  if (text.includes("fever") || text.includes("bukhar")) {
    semantic.problems?.push("fever");
  }
  if (text.includes("pain") || text.includes("dard")) {
    semantic.problems?.push("pain");
  }
  if (text.includes("urine") || text.includes("peshab") || text.includes("burning")) {
    semantic.problems?.push("dysuria/urinary symptom");
    semantic.anatomy?.push("urinary tract");
  }
  if (text.includes("cough") || text.includes("khansi")) {
    semantic.problems?.push("cough");
    semantic.anatomy?.push("respiratory");
  }
  if (text.includes("headache") || text.includes("sar dard")) {
    semantic.problems?.push("headache");
    semantic.anatomy?.push("head");
  }

  // Temporal facts
  if (/\b(\d+\s*(day|days|din|hafte|week|weeks|mahine|month|hours|ghante)|since|kab se|pehle)\b/i.test(text)) {
    const match = text.match(/\b\d+\s*(?:day|days|din|hafte|week|weeks|mahine|month|hours|ghante)\b/i);
    if (match) semantic.temporal_facts?.push(match[0]);
  }

  if (isSafetyConcern) {
    return {
      semantic_interpretation: semantic,
      clinical_considerations: [
        "Reported symptoms may indicate acute clinical urgency.",
        "Priority clinician triage or emergency medical evaluation recommended.",
      ],
      recommended_action: "SAFETY_REVIEW",
      next_best_question: "Kya koi aur warning sign ya associated emergency symptom bhi hai?",
      missing_information: ["vital_signs", "red_flags_confirmation"],
      confidence: "HIGH",
      source: "CLINICAL_SAFETY_FLOOR",
      disclaimer: CLINICAL_DISCLAIMER,
    };
  }

  // Identify missing information dimensions
  const missing: string[] = [];
  if (!semantic.temporal_facts?.length) missing.push("duration");
  if (!text.includes("mild") && !text.includes("moderate") && !text.includes("severe") && !/\d+\s*(?:to|-|\/)\s*10/.test(text)) {
    missing.push("severity");
  }
  missing.push("associated_symptoms");

  return {
    semantic_interpretation: semantic,
    clinical_considerations: [
      "Review reported timeline and symptom severity.",
      "Consider common etiologies pending doctor evaluation.",
    ],
    recommended_action: "ASK_QUESTION",
    next_best_question: !semantic.temporal_facts?.length
      ? "Yeh takleef aapko kab se hai?"
      : "Is takleef ki teevrata 1 se 10 ke scale par kitni hai?",
    missing_information: missing,
    confidence: "MEDIUM",
    source: "CLINICAL_SAFETY_FLOOR",
    disclaimer: CLINICAL_DISCLAIMER,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const REQUIRED_GATEWAY_KEYS = [
  "semantic_interpretation",
  "recommended_action",
  "next_best_question",
  "missing_information",
  "clinical_considerations",
  "confidence",
] as const;

/**
 * Validate the gateway response without coercion or repair.
 * Invalid model output must throw so evaluateClinicalReasoning() uses the
 * deterministic safety floor instead of passing malformed data to callers.
 */
export function validateClinicalReasoningResponse(
  value: unknown
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Gateway response must be a JSON object");
  }

  const missing = REQUIRED_GATEWAY_KEYS.filter((key) => !(key in value));
  if (missing.length > 0) {
    throw new Error(`Gateway response is missing keys: ${missing.join(", ")}`);
  }

  if (!isRecord(value.semantic_interpretation)) {
    throw new Error("semantic_interpretation must be an object");
  }

  const action = value.recommended_action;
  if (!["ASK_QUESTION", "CLARIFY", "SAFETY_REVIEW"].includes(String(action))) {
    throw new Error(`Invalid recommended_action from gateway: ${String(action)}`);
  }

  const nextQuestion = value.next_best_question;
  if (nextQuestion !== null && typeof nextQuestion !== "string") {
    throw new Error("next_best_question must be a string or null");
  }
  if (action === "ASK_QUESTION" && (!nextQuestion || !nextQuestion.trim())) {
    throw new Error("ASK_QUESTION requires a non-empty next_best_question");
  }

  for (const key of ["missing_information", "clinical_considerations"]) {
    if (!isStringArray(value[key])) {
      throw new Error(`${key} must be an array of strings`);
    }
  }

  const confidence = value.confidence;
  if (confidence !== null) {
    if (typeof confidence === "boolean") {
      throw new Error("confidence must not be boolean");
    }
    if (typeof confidence === "string") {
      if (!["LOW", "MEDIUM", "HIGH"].includes(confidence.toUpperCase())) {
        throw new Error("Unsupported confidence label");
      }
    } else if (typeof confidence === "number") {
      if (!Number.isFinite(confidence)) {
        throw new Error("confidence must be finite");
      }
    } else {
      throw new Error("confidence must be a label, number, or null");
    }
  }

  const semantic = value.semantic_interpretation;
  if ("confirmed_diagnoses" in semantic) {
    const diagnoses = semantic.confirmed_diagnoses;
    if (diagnoses !== null && !Array.isArray(diagnoses)) {
      throw new Error("confirmed_diagnoses must be an array or null");
    }
    if (Array.isArray(diagnoses) && diagnoses.length > 0) {
      throw new Error("The model cannot independently confirm a diagnosis");
    }
  }
}

/**
 * Calls the AI UPCHAR Clinical Reasoning Gateway.
 * Returns parsed and validated clinical response conforming to the 6-key contract.
 */
export async function callClinicalReasoningGateway(
  request: ClinicalReasoningRequest,
  options: { gatewayUrl?: string; timeoutMs?: number } = {}
): Promise<ClinicalReasoningResponse> {
  const url = (options.gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs || 4000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/v1/clinical/reason`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Gateway returned HTTP ${res.status}`);
    }

    const data: unknown = await res.json();
    validateClinicalReasoningResponse(data);

    return {
      semantic_interpretation: data.semantic_interpretation as ClinicalSemanticInterpretation,
      clinical_considerations: data.clinical_considerations as string[],
      recommended_action: data.recommended_action as RecommendedAction,
      next_best_question: data.next_best_question as string | null,
      missing_information: data.missing_information as string[],
      confidence: data.confidence as ClinicalReasoningResponse["confidence"],
      source: "AI_UPCHAR_E3_GATEWAY",
      disclaimer: CLINICAL_DISCLAIMER,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * High-level clinical reasoning evaluator.
 * Tries the proprietary model gateway first; automatically falls back to the deterministic
 * safety floor if the gateway is offline, unconfigured, or timed out.
 */
export async function evaluateClinicalReasoning(
  request: ClinicalReasoningRequest,
  options: { gatewayUrl?: string; timeoutMs?: number } = {}
): Promise<ClinicalReasoningResponse> {
  try {
    return await callClinicalReasoningGateway(request, options);
  } catch {
    // Gateway offline or unconfigured -> Safe deterministic clinical floor
    return deterministicClinicalFloor(request);
  }
}
