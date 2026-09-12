// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders for AI UPCHAR's clinical AI features.
//
// Every prompt enforces the product's core principle — "AI assists, clinicians
// decide". The model is instructed to produce review-required drafts only: it must
// never present itself as making a diagnosis, prescribing, or taking a clinical
// action. Output is decision support for an authorized clinician.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChatMessage } from "./puterAI";

/** Minimal patient context the client already has for prompt grounding. */
export type PatientBrief = {
  name?: string;
  status?: string;
  appointment?: string;
};

const SAFETY_SYSTEM = [
  "You are a clinical decision-support assistant inside AI UPCHAR, a doctor's workspace.",
  "Core rules you must always follow:",
  "1. You ASSIST; the clinician DECIDES. Never state a definitive diagnosis or prescribe.",
  "2. Frame outputs as considerations, possibilities, and questions for the doctor to weigh.",
  "3. Be concise and clinically relevant. Use short paragraphs or bullet points.",
  "4. Surface red flags and safety concerns explicitly when present.",
  "5. Do not invent patient data. If information is missing, say what should be confirmed.",
  "6. This is decision support, not a substitute for the clinician's judgment.",
].join("\n");

function patientLine(p?: PatientBrief): string {
  if (!p?.name) return "No specific patient is selected.";
  const bits = [`Patient: ${p.name}`];
  if (p.status) bits.push(`status: ${p.status}`);
  if (p.appointment) bits.push(`context: ${p.appointment}`);
  return bits.join(" · ");
}

/** Copilot: free-form clinical question about the selected patient. */
export function buildCopilotMessages(question: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY_SYSTEM },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        `Clinician's question: ${question}`,
        "",
        "Give focused decision support. Where relevant, list what to review in the record,",
        "differential considerations (not a diagnosis), and any safety flags. End with a one-line",
        "reminder that the clinician makes the final decision.",
      ].join("\n"),
    },
  ];
}

/** Symptom checker: structured triage support from a symptom description. */
export function buildSymptomMessages(
  input: {
    symptoms: string;
    duration?: string;
    severity?: string;
    associatedSymptoms?: string;
    medicines?: string;
  },
  patient?: PatientBrief
): ChatMessage[] {
  const details = [
    `Symptoms: ${input.symptoms}`,
    input.duration ? `Duration: ${input.duration}` : "",
    input.severity ? `Severity: ${input.severity}` : "",
    input.associatedSymptoms ? `Associated symptoms: ${input.associatedSymptoms}` : "",
    input.medicines ? `Current medicines: ${input.medicines}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: SAFETY_SYSTEM },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        details,
        "",
        "Provide triage-oriented decision support in this structure:",
        "• Clarifying questions to ask the patient",
        "• Differential considerations (possibilities to weigh, not a diagnosis)",
        "• Red flags / when to escalate urgently",
        "• Suggested triage level (routine / urgent / emergency) as a recommendation only",
        "Keep it brief. The clinician confirms all findings.",
      ].join("\n"),
    },
  ];
}

/** Scribe: turn a raw consultation transcript into a structured SOAP draft. */
export function buildScribeMessages(transcript: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY_SYSTEM },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        "Convert the following consultation transcript into a structured SOAP note DRAFT.",
        "Return strictly valid JSON with exactly these keys: subjective, objective, assessment, plan.",
        "Each value is a plain-text string. Do not include markdown, code fences, or commentary.",
        "The assessment must be framed as clinical impressions for review, not a final diagnosis.",
        "",
        "Transcript:",
        transcript,
      ].join("\n"),
    },
  ];
}

/**
 * Parses a SOAP JSON draft from a model response, tolerating stray text or code
 * fences around the JSON. Returns null if no usable object is found.
 */
export function parseSoapDraft(
  raw: string
): { subjective: string; objective: string; assessment: string; plan: string } | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      subjective: String(obj.subjective ?? ""),
      objective: String(obj.objective ?? ""),
      assessment: String(obj.assessment ?? ""),
      plan: String(obj.plan ?? ""),
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational patient intake ("AI Upchar Intake Assistant").
//
// This drives a chat-style pre-visit interview that follows a fixed decision tree
// (new vs returning patient, prior-doctor history, treatment efficacy, chronic
// conditions) and asks exactly ONE question at a time. The model never diagnoses
// or prescribes; it gathers a structured history for the doctor and escalates
// emergencies. It emits a hidden control tag on its own last line so the UI can
// react (show the emergency banner, or move to the completion screen).
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeLanguage = "hinglish" | "english";

/**
 * Control tag the assistant appends on its OWN final line, e.g.
 *   [[STATE: continue]]
 *   [[STATE: urgent]]      -> emergency detected, advise ER
 *   [[STATE: complete]]    -> enough info gathered, ready to hand off
 * The UI strips this tag from the visible bubble.
 */
export const INTAKE_STATE_TAG = /\[\[STATE:\s*(continue|urgent|complete)\s*\]\]/i;

export function buildIntakeSystemPrompt(language: IntakeLanguage): ChatMessage {
  const langRule =
    language === "english"
      ? "Speak in simple, clear English."
      : "Speak in simple Hindi/Hinglish (Roman script), warm and polite.";

  return {
    role: "system",
    content: [
      "Role: You are 'AI Upchar Intake Assistant', an empathetic, logical clinical intake assistant.",
      "You pre-interview a patient BEFORE they meet the doctor, like a skilled compounder or junior doctor.",
      "",
      "Objective: Gather a structured medical history by first identifying whether the patient is NEW or",
      "RETURNING, and whether the issue is acute, chronic, or unresolved from a previous doctor.",
      "",
      "Hard rules:",
      `1. ${langRule}`,
      "2. Ask ONLY ONE question per message. Never bundle multiple questions together.",
      "3. Be brief. One short question, no long paragraphs.",
      "4. NEVER diagnose, name a disease, or suggest any medicine. You only collect information.",
      "5. Follow this decision tree strictly:",
      "   • FIRST: ask if they are visiting for the FIRST time (new) or have come BEFORE (follow-up).",
      "   • IF NEW: main problem -> since when -> have they already seen another doctor for this ->",
      "     (if yes) did that treatment help or not, and do they have the old prescription/report ->",
      "     (if no/self-medicated) did they take any medicine on their own -> any long-term illness",
      "     (BP, sugar, thyroid, asthma) with ongoing medicines.",
      "   • IF RETURNING: is it the same old issue or a NEW problem ->",
      "     (if new problem) switch to the NEW patient branch ->",
      "     (if same issue) better/same/worse since last time -> did they take all medicines on time ->",
      "     any new problem after the medicine (vomiting, dizziness, gas, etc.) -> any pending lab report.",
      "6. Documents: ask the patient to BRING their old prescriptions/reports and hand them at the",
      "   reception (in-app upload is not available yet). Do not claim you received any file.",
      "7. EMERGENCY: if the patient mentions severe chest pain, heavy bleeding, unconsciousness, stroke",
      "   signs (face droop, slurred speech, one-side weakness), difficulty breathing, or similar, STOP the",
      "   intake, tell them to reach the emergency room / call for help immediately.",
      "",
      "Output format (critical):",
      "- Write ONLY your single next question or closing message as normal text for the patient.",
      "- On a NEW LAST LINE, append a control tag exactly one of:",
      "    [[STATE: continue]]  (still interviewing)",
      "    [[STATE: urgent]]    (emergency detected — your message must advise emergency care)",
      "    [[STATE: complete]]  (you have gathered enough; your message thanks them and says the doctor",
      "                          will see their history, and to keep reports ready at reception)",
      "- The patient never sees the tag; it is a machine signal. Always include exactly one tag.",
    ].join("\n"),
  };
}

/**
 * Builds the full message array for one intake turn: system prompt + the running
 * transcript. `history` is the alternating patient/assistant turns so far. Pass an
 * empty history to get the very first question.
 */
export function buildIntakeMessages(
  history: { role: "user" | "assistant"; content: string }[],
  language: IntakeLanguage,
  patient?: PatientBrief
): ChatMessage[] {
  const sys = buildIntakeSystemPrompt(language);
  const context: ChatMessage[] = patient?.name
    ? [{ role: "system", content: `Known patient on file: ${patient.name}. Still confirm new vs returning.` }]
    : [];
  // Seed the very first turn so the model opens the conversation.
  const seed: ChatMessage[] =
    history.length === 0
      ? [{ role: "user", content: "Start the intake now with your first question." }]
      : [];
  return [sys, ...context, ...history, ...seed];
}

/**
 * Strips the [[STATE: ...]] control tag from an assistant message and returns the
 * clean text plus the parsed state.
 */
export function parseIntakeTurn(raw: string): {
  text: string;
  state: "continue" | "urgent" | "complete";
} {
  const match = raw.match(INTAKE_STATE_TAG);
  const state = (match?.[1]?.toLowerCase() as "continue" | "urgent" | "complete") ?? "continue";
  const text = raw.replace(INTAKE_STATE_TAG, "").trim();
  return { text, state };
}

/**
 * Builds a prompt that turns the completed intake transcript into a structured
 * Pre-Visit Patient Brief (JSON) for the doctor.
 */
export function buildIntakeSummaryMessages(
  history: { role: "user" | "assistant"; content: string }[]
): ChatMessage[] {
  const transcript = history
    .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`)
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "You convert a patient intake conversation into a structured Pre-Visit Brief for a doctor.",
        "Return STRICT JSON only, no markdown or code fences, with exactly these keys:",
        "  patientType (string: 'new' or 'returning'),",
        "  chiefComplaint (string),",
        "  duration (string),",
        "  priorTreatment (string: what other doctors/self-medication and whether it helped),",
        "  chronicConditions (string),",
        "  medicationAdherence (string, '' if not applicable),",
        "  redFlags (string, '' if none),",
        "  summary (string: 2-3 sentence brief for the doctor).",
        "Do not diagnose. Only summarize what the patient reported.",
      ].join("\n"),
    },
    { role: "user", content: `Intake conversation:\n${transcript}` },
  ];
}
