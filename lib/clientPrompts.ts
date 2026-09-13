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

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VISIT AI REPORT + INTERNET DEEP RESEARCH
// Runs at the end of the conversational appointment flow. Two steps:
//   1) Internet deep research (Perplexity sonar) on the patient's condition.
//   2) A structured, review-required report compiling everything for the doctor.
// Both are review-required and NEVER a diagnosis.
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeSnapshot = {
  patientType: "new" | "returning";
  name?: string;
  age?: string;
  sex?: string;
  chiefComplaint: string;
  duration?: string;
  history?: string;         // prior care / chronic conditions the patient mentioned
  medications?: string;     // current medicines mentioned
  symptoms?: string;        // symptom deep-question answers, joined
  reportFindings?: string;  // merged findings text from uploaded reports/prescriptions
  pastVisits?: string;      // compact summary of previous visits (returning patients)
};

/** Builds the transcript block shared by both prompts. */
function snapshotBlock(s: IntakeSnapshot): string {
  return [
    `Patient type: ${s.patientType}`,
    s.age ? `Age: ${s.age}` : "",
    s.sex ? `Sex: ${s.sex}` : "",
    `Chief complaint: ${s.chiefComplaint}`,
    s.duration ? `Duration: ${s.duration}` : "",
    s.history ? `History / prior care: ${s.history}` : "",
    s.medications ? `Current medicines: ${s.medications}` : "",
    s.symptoms ? `Reported symptoms: ${s.symptoms}` : "",
    s.reportFindings ? `Uploaded report findings (AI-read, unverified): ${s.reportFindings}` : "",
    s.pastVisits ? `PREVIOUS VISITS (history for context):\n${s.pastVisits}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Internet deep-research prompt for Perplexity Sonar (real-time web + citations).
 * Asks for an evidence-informed overview relevant to the patient's presentation,
 * with sources, framed strictly as clinician decision-support (no diagnosis).
 */
export function buildResearchPrompt(s: IntakeSnapshot): string {
  return [
    "You are a medical research assistant supporting a doctor (NOT the patient). Using current, reputable",
    "web sources (prefer guidelines, reviews, and established medical references), research the presentation below.",
    "",
    snapshotBlock(s),
    "",
    "Produce a concise, evidence-informed briefing for the DOCTOR covering:",
    "- Common and important causes to consider for this presentation (possibilities, NOT a diagnosis).",
    "- Recommended work-up / investigations typically indicated.",
    "- Red-flag features that would warrant urgent attention.",
    "- Relevant management considerations per current guidance.",
    "Include inline source references/links. Keep it focused (a few short sections).",
    "Do NOT address the patient, do NOT diagnose, do NOT prescribe. This is decision-support to be verified by the clinician.",
  ].join("\n");
}

/**
 * Research-informed QUESTION PLAN (Perplexity Sonar, real-time web + citations).
 * Given the complaint so far, researches what a doctor should ASK to assess THIS
 * condition, plus red-flag questions. Returns a short, plain list of question
 * topics the deep-questioning phase can follow. Not a diagnosis.
 */
export function buildQuestionPlanPrompt(s: IntakeSnapshot): string {
  return [
    "You are a clinical intake planner supporting a doctor. Using reputable medical sources, determine the",
    "specific ASSESSMENT QUESTIONS a doctor would ask a patient to evaluate the presentation below —",
    "the way a clinician takes a focused history for THIS complaint.",
    "",
    snapshotBlock(s),
    "",
    "Output a SHORT numbered list (6-10 items) of the most useful, condition-specific questions to ask this",
    "patient (associated symptoms, character/severity, timing/triggers, relevant history, and DANGER/red-flag",
    "questions). Keep each item to one line. No diagnosis, no advice — only the questions to ask.",
  ].join("\n");
}

export type UrgencyLevel = "routine" | "opd" | "urgent" | "admit" | "emergency";
export type SurgeryLikelihood = "none" | "possible" | "likely";

export type PreVisitReport = {
  // Backward-compatible fields (kept so existing save route/UI keep working).
  chiefComplaint: string;
  history: string;
  medications: string;
  currentIssue: string;
  considerations: string[];   // = likely diagnoses / possibilities (review-required)
  redFlags: string[];
  missingInfo: string[];
  patientQuestions: string[];
  summary: string;            // full narrative for the doctor
  research: string;           // the web-research briefing (with citations)
  // New diagnostic sections for the doctor report.
  assessment: string;                 // AI's clinical assessment narrative (review-required)
  diagnosisConfidence: "low" | "moderate" | "high";
  testsInitial: string[];             // first-line tests (blood/urine/stool etc.)
  testsIfSevere: string[];            // escalation tests/scans if severe/persistent
  infoSufficient: boolean;            // is the collected info enough to start treatment?
  infoSufficientNote: string;
  treatmentMedicines: string[];       // suggested medicine considerations (review-required)
  treatmentMeasures: string[];        // supportive/lifestyle measures
  urgency: UrgencyLevel;
  urgencyReason: string;
  surgery: SurgeryLikelihood;
  surgeryNote: string;
  nextSteps: string[];                // clear next-step guidance for the doctor
};

const URGENCY_VALUES: UrgencyLevel[] = ["routine", "opd", "urgent", "admit", "emergency"];
const SURGERY_VALUES: SurgeryLikelihood[] = ["none", "possible", "likely"];

/**
 * Compiles the final SECTION-WISE pre-visit report for the doctor from the intake
 * snapshot + web-research briefing. Review-required; the doctor decides everything.
 */
export function buildPreVisitReportMessages(s: IntakeSnapshot, research: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You compile a patient's pre-visit intake into a DETAILED, SECTION-WISE report for a DOCTOR to read before the visit.",
        "You ASSIST; the clinician DECIDES. Everything is review-required. Do NOT give a final diagnosis and do NOT prescribe —",
        "instead give considerations, suggestions, and clear options for the doctor to confirm.",
        "Use the patient's reported information and the web-research briefing. Do not invent clinical data.",
        "",
        "Return STRICT JSON only (no markdown/fences) with EXACTLY these keys:",
        "  chiefComplaint (string),",
        "  history (string — full history: background, prior care, medicines, uploaded report findings),",
        "  medications (string), currentIssue (string),",
        "  assessment (string — your clinical assessment narrative, review-required),",
        "  considerations (string[] — likely conditions/possibilities to weigh, NOT a final diagnosis),",
        "  diagnosisConfidence ('low'|'moderate'|'high'),",
        "  redFlags (string[] — safety concerns to check),",
        "  testsInitial (string[] — first-line tests to consider e.g. CBC, urine, stool),",
        "  testsIfSevere (string[] — escalation tests/scans if severe/persistent e.g. USG, CT, endoscopy),",
        "  infoSufficient (boolean — is the info gathered enough to START treatment, or is more needed?),",
        "  infoSufficientNote (string — one line explaining),",
        "  treatmentMedicines (string[] — medicine considerations, review-required, generic where possible),",
        "  treatmentMeasures (string[] — supportive/lifestyle/diet measures),",
        "  urgency ('routine'|'opd'|'urgent'|'admit'|'emergency'),",
        "  urgencyReason (string),",
        "  surgery ('none'|'possible'|'likely'), surgeryNote (string),",
        "  nextSteps (string[] — clear next-step guidance for the doctor),",
        "  missingInfo (string[]), patientQuestions (string[]),",
        "  summary (string — a clear 4-8 sentence overview the doctor can read at a glance).",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "PATIENT INTAKE:",
        snapshotBlock(s),
        "",
        "WEB RESEARCH BRIEFING (already sourced; use for assessment/tests/red-flags):",
        research || "(no research available)",
      ].join("\n"),
    },
  ];
}

export function parsePreVisitReport(raw: string, research: string): PreVisitReport {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  let o: Record<string, unknown> = {};
  if (start >= 0 && end > start) {
    try { o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>; } catch { o = {}; }
  }
  const urgency = (URGENCY_VALUES.includes(o.urgency as UrgencyLevel) ? o.urgency : "opd") as UrgencyLevel;
  const surgery = (SURGERY_VALUES.includes(o.surgery as SurgeryLikelihood) ? o.surgery : "none") as SurgeryLikelihood;
  const conf = (["low", "moderate", "high"].includes(String(o.diagnosisConfidence)) ? o.diagnosisConfidence : "moderate") as "low" | "moderate" | "high";
  return {
    chiefComplaint: String(o.chiefComplaint ?? ""),
    history: String(o.history ?? ""),
    medications: String(o.medications ?? ""),
    currentIssue: String(o.currentIssue ?? ""),
    considerations: arr(o.considerations),
    redFlags: arr(o.redFlags),
    missingInfo: arr(o.missingInfo),
    patientQuestions: arr(o.patientQuestions),
    summary: String(o.summary ?? cleaned.slice(0, 2000)),
    research,
    assessment: String(o.assessment ?? ""),
    diagnosisConfidence: conf,
    testsInitial: arr(o.testsInitial),
    testsIfSevere: arr(o.testsIfSevere),
    infoSufficient: Boolean(o.infoSufficient),
    infoSufficientNote: String(o.infoSufficientNote ?? ""),
    treatmentMedicines: arr(o.treatmentMedicines),
    treatmentMeasures: arr(o.treatmentMeasures),
    urgency,
    urgencyReason: String(o.urgencyReason ?? ""),
    surgery,
    surgeryNote: String(o.surgeryNote ?? ""),
    nextSteps: arr(o.nextSteps),
  };
}
