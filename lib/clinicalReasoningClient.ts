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

    const data = (await res.json()) as Record<string, unknown>;

    // Validate contract compliance
    const action = data.recommended_action as RecommendedAction;
    if (!["ASK_QUESTION", "CLARIFY", "SAFETY_REVIEW"].includes(action)) {
      throw new Error(`Invalid recommended_action from gateway: ${String(action)}`);
    }

    const semantic = (typeof data.semantic_interpretation === "object" && data.semantic_interpretation !== null
      ? data.semantic_interpretation
      : {}) as ClinicalSemanticInterpretation;

    // Clinical Safety Floor: ensure models never confirm diagnosis independently
    if (semantic.confirmed_diagnoses) {
      semantic.confirmed_diagnoses = null;
    }

    return {
      semantic_interpretation: semantic,
      clinical_considerations: Array.isArray(data.clinical_considerations)
        ? data.clinical_considerations.map(String)
        : [],
      recommended_action: action,
      next_best_question: typeof data.next_best_question === "string" ? data.next_best_question : null,
      missing_information: Array.isArray(data.missing_information) ? data.missing_information.map(String) : [],
      confidence: (data.confidence as ClinicalReasoningResponse["confidence"]) ?? null,
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
