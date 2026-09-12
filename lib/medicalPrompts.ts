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
