// Client-side prompt builders for browser AI (Puter.js). Mirror of the server
// prompts but browser-safe. All enforce: AI assists, the clinician decides.
"use client";

import type { ChatMessage } from "./puterClient";

export type PatientBrief = { name?: string; status?: string; appointment?: string };

const SAFETY = [
  "You are a clinical decision-support assistant inside AI UPCHAR, a doctor's workspace.",
  "Rules: You ASSIST; the clinician DECIDES. Never give a definitive diagnosis or prescribe.",
  "Frame outputs as considerations and questions for the doctor. Be concise. Surface red flags.",
].join("\n");

function pLine(p?: PatientBrief): string {
  if (!p?.name) return "No specific patient selected.";
  return [`Patient: ${p.name}`, p.status ? `status: ${p.status}` : "", p.appointment ? `context: ${p.appointment}` : ""].filter(Boolean).join(" · ");
}

export function buildCopilotMessages(question: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY },
    { role: "user", content: `${pLine(patient)}\n\nClinician's question: ${question}\n\nGive focused decision support: what to review, differential considerations (not a diagnosis), safety flags. End with a one-line reminder that the clinician decides.` },
  ];
}

export function buildSymptomMessages(
  input: { symptoms: string; duration?: string; severity?: string; associatedSymptoms?: string; medicines?: string },
  patient?: PatientBrief
): ChatMessage[] {
  const details = [
    `Symptoms: ${input.symptoms}`,
    input.duration ? `Duration: ${input.duration}` : "",
    input.severity ? `Severity: ${input.severity}` : "",
    input.associatedSymptoms ? `Associated: ${input.associatedSymptoms}` : "",
    input.medicines ? `Current medicines: ${input.medicines}` : "",
  ].filter(Boolean).join("\n");
  return [
    { role: "system", content: SAFETY },
    { role: "user", content: `${pLine(patient)}\n\n${details}\n\nProvide triage-oriented support: clarifying questions, differential considerations (not a diagnosis), red flags, and a suggested triage level (routine/urgent/emergency) as a recommendation. Keep it brief.` },
  ];
}

export function buildScribeMessages(transcript: string, patient?: PatientBrief): ChatMessage[] {
  return [
    { role: "system", content: SAFETY },
    { role: "user", content: `${pLine(patient)}\n\nConvert this transcript into a SOAP note DRAFT. Return STRICT JSON only (no markdown/fences) with keys: subjective, objective, assessment, plan (each a plain string). Assessment = impressions for review, not a final diagnosis.\n\nTranscript:\n${transcript}` },
  ];
}

export function parseSoapDraft(raw: string): { subjective: string; objective: string; assessment: string; plan: string } | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return { subjective: String(o.subjective ?? ""), objective: String(o.objective ?? ""), assessment: String(o.assessment ?? ""), plan: String(o.plan ?? "") };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT ANALYSIS (browser vision) + adaptive follow-up questions.
// These run in the browser via Puter.js on vision-capable models. All output is
// review-required: the AI extracts and organizes what the report shows, and
// flags what looks abnormal, but never diagnoses or prescribes.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportKind = "Lab report" | "Prescription" | "Referral" | "Imaging" | "Other";

/** Vision prompt: extract structured findings from an uploaded report/prescription image or PDF. */
export function buildReportVisionPrompt(kind: ReportKind): string {
  const shared = [
    "You are a medical document reader assisting a doctor. Read the attached patient document carefully.",
    "You DO NOT diagnose and you DO NOT prescribe. You only transcribe and organize what the document shows,",
    "and flag which values/lines appear outside their stated normal range.",
    "",
    "Return STRICT JSON only (no markdown, no code fences) with exactly these keys:",
    '  "documentType": string,',
    '  "overallImpression": string  // 1-2 lines: what this document is and its general picture. No diagnosis.',
    '  "abnormal": string[]         // human-readable lines that appear ABNORMAL/out-of-range, with value + range if shown',
    '  "normal": string[]           // notable values that appear within normal limits',
    '  "medications": string[]      // any medicines named (esp. for prescriptions), with dose/frequency if visible',
    '  "followUpFocus": string      // one short phrase: what a doctor would most want to probe next based on this',
    '  "reviewNote": string         // always: "Values transcribed by AI — the doctor must verify against the original."',
    "",
    "If a field is not applicable, use an empty string or empty array. Never invent values you cannot read.",
  ];
  const hint =
    kind === "Prescription"
      ? "This is likely a doctor's prescription letter — focus on medicines, doses, and instructions in 'medications'."
      : kind === "Imaging"
        ? "This is likely an imaging report (X-ray/MRI/CT/ultrasound) — put the radiologist's impression lines into 'abnormal'/'normal' and 'overallImpression'."
        : "This is likely a lab/test report — transcribe test values and mark which are out of the printed reference range.";
  return [...shared, "", hint].join("\n");
}

export type ReportFindings = {
  documentType: string;
  overallImpression: string;
  abnormal: string[];
  normal: string[];
  medications: string[];
  followUpFocus: string;
  reviewNote: string;
};

export function parseReportFindings(raw: string): ReportFindings | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    return {
      documentType: String(o.documentType ?? ""),
      overallImpression: String(o.overallImpression ?? ""),
      abnormal: arr(o.abnormal),
      normal: arr(o.normal),
      medications: arr(o.medications),
      followUpFocus: String(o.followUpFocus ?? ""),
      reviewNote: String(o.reviewNote ?? "Values transcribed by AI — the doctor must verify against the original."),
    };
  } catch {
    return null;
  }
}

/** Merge two independent model readings (GPT + Gemini) into one findings object. */
export function mergeFindings(a: ReportFindings | null, b: ReportFindings | null): ReportFindings | null {
  if (!a) return b;
  if (!b) return a;
  const uniq = (xs: string[]) => Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));
  return {
    documentType: a.documentType || b.documentType,
    overallImpression: a.overallImpression || b.overallImpression,
    abnormal: uniq([...a.abnormal, ...b.abnormal]),
    normal: uniq([...a.normal, ...b.normal]),
    medications: uniq([...a.medications, ...b.medications]),
    followUpFocus: a.followUpFocus || b.followUpFocus,
    reviewNote: a.reviewNote || b.reviewNote,
  };
}

/** True when the report has anything flagged as abnormal. */
export function hasAbnormalFindings(f: ReportFindings | null): boolean {
  return Boolean(f && f.abnormal.length > 0);
}

/**
 * Adaptive follow-up question prompt. If the report looked abnormal, ask a
 * symptom-specific deep question tied to the abnormal area; if it looked normal,
 * ask an improvement/progress question. The AI outputs ONE short patient-facing
 * question in the given language — no diagnosis, no preamble.
 */
export function buildAdaptiveQuestionMessages(
  findings: ReportFindings,
  language: "hinglish" | "english"
): ChatMessage[] {
  const lang = language === "english" ? "simple, clear English" : "simple warm Hindi/Hinglish (Roman script)";
  const abnormal = hasAbnormalFindings(findings);
  const focus = findings.followUpFocus || findings.overallImpression || "the report";
  const context = abnormal
    ? `The report has ABNORMAL findings: ${findings.abnormal.slice(0, 6).join("; ")}. Focus area: ${focus}.`
    : `The report looks broadly within normal limits. Focus area: ${focus}.`;
  const goal = abnormal
    ? "Ask ONE symptom-specific question that probes how this abnormal area is affecting them right now (e.g. related pain, breathing, eating, movement, energy). This helps the doctor understand severity."
    : "Ask ONE gentle progress/improvement question to learn whether they are feeling better and whether the earlier problem is settling.";
  return [
    {
      role: "system",
      content: [
        "You are a warm clinical intake assistant talking to a patient, one question at a time.",
        `Speak in ${lang}.`,
        "You are given AI-read findings from a report the patient just uploaded.",
        goal,
        "Output ONLY the single question (max ~25 words). No preamble, no lists, no diagnosis, no medicine advice.",
      ].join("\n"),
    },
    { role: "user", content: context },
  ];
}
