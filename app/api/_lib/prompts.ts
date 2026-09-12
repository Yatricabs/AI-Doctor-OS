// ─────────────────────────────────────────────────────────────────────────────
// Server-side prompt builders + the hybrid intake decision tree.
//
// Server-safe (no "use client", no browser imports). All AI-facing prompts enforce
// the product principle: AI assists, the clinician decides. The model never
// diagnoses or prescribes — it drafts review-required content.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChatMessage } from "./ai";

export type PatientBrief = { name?: string; status?: string; appointment?: string };

const SAFETY = [
  "You are a clinical decision-support assistant inside AI UPCHAR, a doctor's workspace.",
  "Rules you MUST follow:",
  "1. You ASSIST; the clinician DECIDES. Never give a definitive diagnosis or prescribe.",
  "2. Frame outputs as considerations/possibilities and questions for the doctor to weigh.",
  "3. Be concise and clinically relevant. Short paragraphs or bullet points.",
  "4. Surface red flags and safety concerns explicitly.",
  "5. Never invent patient data; say what should be confirmed if missing.",
].join("\n");

function patientLine(p?: PatientBrief): string {
  if (!p?.name) return "No specific patient is selected.";
  const bits = [`Patient: ${p.name}`];
  if (p.status) bits.push(`status: ${p.status}`);
  if (p.appointment) bits.push(`context: ${p.appointment}`);
  return bits.join(" · ");
}

// ─── Copilot ─────────────────────────────────────────────────────────────────
export function buildCopilotMessages(question: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        `Clinician's question: ${question}`,
        "",
        "Give focused decision support: what to review in the record, differential",
        "considerations (not a diagnosis), and any safety flags. End with a one-line",
        "reminder that the clinician makes the final decision.",
      ].join("\n"),
    },
  ];
}

// ─── Symptom checker ───────────────────────────────────────────────────────────
export function buildSymptomMessages(
  input: { symptoms: string; duration?: string; severity?: string; associatedSymptoms?: string; medicines?: string },
  patient?: PatientBrief
): ChatMessage[] {
  const details = [
    `Symptoms: ${input.symptoms}`,
    input.duration ? `Duration: ${input.duration}` : "",
    input.severity ? `Severity: ${input.severity}` : "",
    input.associatedSymptoms ? `Associated symptoms: ${input.associatedSymptoms}` : "",
    input.medicines ? `Current medicines: ${input.medicines}` : "",
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: SAFETY },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        details,
        "",
        "Provide triage-oriented decision support in this structure:",
        "Clarifying questions to ask the patient",
        "Differential considerations (possibilities, not a diagnosis)",
        "Red flags / when to escalate urgently",
        "Suggested triage level (routine / urgent / emergency) as a recommendation only",
        "Keep it brief. The clinician confirms all findings.",
      ].join("\n"),
    },
  ];
}

// ─── Scribe (SOAP draft) ─────────────────────────────────────────────────────
export function buildScribeMessages(transcript: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY },
    {
      role: "user",
      content: [
        patientLine(patient),
        "",
        "Convert this consultation transcript into a structured SOAP note DRAFT.",
        "Return STRICT JSON only (no markdown/code fences) with exactly these keys:",
        "subjective, objective, assessment, plan — each a plain-text string.",
        "The assessment must read as clinical impressions for review, not a final diagnosis.",
        "",
        "Transcript:",
        transcript,
      ].join("\n"),
    },
  ];
}

export function parseSoapDraft(raw: string): { subjective: string; objective: string; assessment: string; plan: string } | null {
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
// HYBRID INTAKE
//
// A fixed decision tree guarantees the ORDER and coverage of questions. The AI is
// used only to (a) phrase each fixed question warmly in the patient's language and
// acknowledge their previous answer, and (b) at the end, summarize into a brief.
// This gives deterministic flow with a natural, conversational feel.
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeLanguage = "hinglish" | "english";

/** A node in the intake tree. `next` decides the following step id from the answer. */
export type IntakeStep = {
  id: string;
  // The clinical intent of this question (the AI rephrases this, doesn't invent new ones).
  intent: string;
  // Optional quick-reply chips the UI can render.
  options?: string[];
  // Given the (lowercased) answer, return the next step id, or "complete".
  next: (answer: string) => string;
};

const yes = (a: string) => /\b(yes|haan|haa|ha|y|sahi|theek|kiya|tha|hua)\b/i.test(a);

// The tree. Branching is deterministic; the AI never changes the path.
export const INTAKE_STEPS: Record<string, IntakeStep> = {
  identity: {
    id: "identity",
    intent: "Ask if this is their first visit here (new patient) or they have visited before (returning).",
    options: ["First time", "Visited before"],
    next: (a) => (/(before|returning|purana|pehle|follow)/i.test(a) ? "ret_reason" : "new_complaint"),
  },

  // ── NEW patient branch ──
  new_complaint: {
    id: "new_complaint",
    intent: "Ask the main problem/complaint troubling them today.",
    next: () => "new_duration",
  },
  new_duration: {
    id: "new_duration",
    intent: "Ask since when they have had this problem (how many days/weeks/months).",
    next: () => "new_seen_doctor",
  },
  new_seen_doctor: {
    id: "new_seen_doctor",
    intent: "Ask if they already saw another doctor for this problem before coming here.",
    options: ["Yes, saw a doctor", "No, came directly"],
    next: (a) => (yes(a) ? "new_prev_helped" : "new_self_medicine"),
  },
  new_prev_helped: {
    id: "new_prev_helped",
    intent: "Ask whether that previous treatment helped, and to bring the old prescription/report to reception.",
    next: () => "chronic",
  },
  new_self_medicine: {
    id: "new_self_medicine",
    intent: "Ask if they took any medicine on their own (from a medical store) for this problem.",
    next: () => "chronic",
  },

  // ── RETURNING patient branch ──
  ret_reason: {
    id: "ret_reason",
    intent: "Ask if they are here for the SAME earlier problem (follow-up) or a NEW problem.",
    options: ["Same problem", "New problem"],
    next: (a) => (/(new|nayi|naya|different)/i.test(a) ? "new_complaint" : "ret_progress"),
  },
  ret_progress: {
    id: "ret_progress",
    intent: "Ask how they feel since the last visit — better, same, or worse.",
    options: ["Better", "Same", "Worse"],
    next: () => "ret_adherence",
  },
  ret_adherence: {
    id: "ret_adherence",
    intent: "Ask if they took all the prescribed medicines on time, or missed any.",
    options: ["Took all", "Missed some"],
    next: () => "ret_sideeffects",
  },
  ret_sideeffects: {
    id: "ret_sideeffects",
    intent: "Ask if they noticed any new problem after the medicine (e.g. vomiting, dizziness, gas).",
    next: () => "ret_reports",
  },
  ret_reports: {
    id: "ret_reports",
    intent: "Ask if they have any pending lab report/test done, and to bring it to reception.",
    next: () => "chronic",
  },

  // ── Shared closing question ──
  chronic: {
    id: "chronic",
    intent: "Ask if they have any long-term illness on regular medicine (BP, sugar, thyroid, asthma).",
    next: () => "complete",
  },
};

export const INTAKE_FIRST_STEP = "identity";

/**
 * Builds the prompt that asks the AI to PHRASE one fixed question. The AI must not
 * invent a different question — it only rewords `intent`, optionally acknowledging
 * the last answer, in the patient's language. It also flags emergencies.
 */
export function buildIntakePhraseMessages(
  step: IntakeStep,
  lastAnswer: string | null,
  language: IntakeLanguage
): ChatMessage[] {
  const lang = language === "english" ? "simple, clear English" : "simple warm Hindi/Hinglish (Roman script)";
  return [
    {
      role: "system",
      content: [
        "You are a warm clinical intake assistant talking to a patient in a chat, one question at a time.",
        `Speak in ${lang}.`,
        "You are given the EXACT question intent to ask next. Reword it into ONE short, friendly question.",
        "Do NOT add extra questions, lists, or preamble. Output ONLY the single question (max ~25 words).",
        "If a previous answer is given, you may start with a 2-3 word acknowledgement (e.g. 'Theek hai,').",
        "Never diagnose or suggest medicines.",
        "If the previous answer mentions a medical emergency (severe chest pain, heavy bleeding,",
        "unconsciousness, stroke signs, trouble breathing), IGNORE the question and instead output exactly:",
        "EMERGENCY: <one line telling them to reach the emergency room / call for help now>",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        lastAnswer ? `Patient's previous answer: "${lastAnswer}"` : "This is the first question of the conversation.",
        `Question intent to ask now: ${step.intent}`,
      ].join("\n"),
    },
  ];
}

/** Detects the emergency marker the phrasing model may emit. */
export function isEmergencyReply(text: string): { emergency: boolean; message: string } {
  const m = text.match(/^\s*EMERGENCY:\s*(.+)$/i);
  if (m) return { emergency: true, message: m[1].trim() };
  return { emergency: false, message: text.trim() };
}

/** Prompt to turn the collected Q/A transcript into a structured pre-visit brief. */
export function buildIntakeSummaryMessages(qa: { question: string; answer: string }[]): ChatMessage[] {
  const transcript = qa.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "You convert a patient intake Q/A into a structured Pre-Visit Brief for a doctor.",
        "Return STRICT JSON only (no markdown/fences) with exactly these keys:",
        "patientType, chiefComplaint, duration, priorTreatment, chronicConditions,",
        "medicationAdherence, redFlags, summary. Each value is a string ('' if not applicable).",
        "Do not diagnose. Only summarize what the patient reported.",
      ].join("\n"),
    },
    { role: "user", content: `Intake Q/A:\n${transcript}` },
  ];
}
