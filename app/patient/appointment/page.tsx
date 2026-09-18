"use client";

// Patient-side AI conversational appointment + intake flow.
// The AI asks questions one at a time (like a doctor), the patient answers,
// can upload prescriptions/reports (read by GPT+Gemini vision), then the AI does
// internet deep research (Perplexity sonar) and compiles a review-required
// report for the doctor. Finally it books the appointment, shows success, and
// then the patient's appointment list.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, CheckCircle2, FileText, Loader2, Paperclip, Send, Stethoscope } from "lucide-react";
import { MODELS } from "@/lib/puterClient";
import { serverAiAnalyzeImage, serverAiChat, serverAiChatStream } from "@/lib/serverAiClient";
import {
  buildAdaptiveQuestionMessages,
  buildPreVisitReportMessages,
  buildQuestionPlanPrompt,
  buildReportVisionPrompt,
  buildResearchPrompt,
  hasAbnormalFindings,
  mergeFindings,
  parsePreVisitReport,
  parseReportFindings,
  type IntakeSnapshot,
  type ReportFindings,
  type ReportKind,
} from "@/lib/clientPrompts";
import { logAiTraining } from "@/lib/aiTraining";
import {
  resolveClinicalContext,
  pathwayForClinicalContext,
  detectRedFlagsForContext,
  pathwayGuidance,
  coverageFor,
  questionForDimension,
  type ClinicalContext,
  type SafetyEvidence,
  type CoverageResult,
  type ClinicalPathway,
  type HistoryDimension,
} from "@/lib/clinicalPathways";
import { assessAppointmentAnswer } from "@/lib/appointmentIntakeReasoning";

type Turn = { role: "assistant" | "user"; content: string };
type Phase = "chat" | "finalizing" | "done";
type Lang = "hinglish" | "english";

const ACCEPTED = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

// The deterministic question script. `key` identifies where the answer is stored.
// `when` gates a step; `options` renders quick-reply chips.
type StepKey =
  | "identity" | "phone" | "name" | "age" | "sex" | "location"
  | "date" | "time"
  | "complaint" | "duration" | "seen_doctor" | "self_medicine"
  | "symptoms" | "upload_prompt";

type Answers = Partial<Record<StepKey, string>>;
type DeepQuestion = { text: string; dimension?: HistoryDimension; source: "ai" | "deterministic" };

function kindFromFile(name: string, mime: string): ReportKind {
  const n = name.toLowerCase();
  if (/prescri|rx|parchi/.test(n)) return "Prescription";
  if (/mri|ct|x-?ray|xray|ultrasound|sono|scan|imaging/.test(n)) return "Imaging";
  if (/refer/.test(n)) return "Referral";
  return "Lab report";
}

// The appointment flow uses the server-side OpenAI boundary. The existing
// Puter.js client remains available for compatibility and attachment vision,
// but no Puter login is required for the conversational appointment flow.
export default function AppointmentFlowPage() {
  return <AppointmentFlow />;
}

function AppointmentFlow() {
  const [lang, setLang] = useState<Lang>("hinglish");
  const [phase, setPhase] = useState<Phase>("chat");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [answers, setAnswers] = useState<Answers>({});
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [findings, setFindings] = useState<ReportFindings[]>([]);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const [created, setCreated] = useState<{ date: string; time: string; token: string; patientId: string } | null>(null);
  const [finalizeMsg, setFinalizeMsg] = useState("Preparing your details for the doctor…");

  const stepRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Dynamic AI deep-questioning phase (after the fixed script):
  const inDeepPhaseRef = useRef(false);   // are we asking complaint-specific Qs?
  const deepCountRef = useRef(0);          // how many deep Qs asked so far
  const deepQARef = useRef<{ q: string; a: string; dimension?: HistoryDimension; source?: "ai" | "deterministic" }[]>([]); // collected Q/A + target metadata
  const answersRef = useRef<Answers>({});  // latest answers (for finalize)
  const questionPlanRef = useRef("");      // research-informed plan of what to ask
  const researchRef = useRef("");          // cached web research (reused at finalize)
  const processingRef = useRef(false);     // hard lock to prevent double-submits
  const clarificationRef = useRef(false); // complaint context must be clarified before duration
  const turnsRef = useRef<Turn[]>([]);     // mirror of `turns` for async save
  const pastVisitsRef = useRef("");        // AI context: summary of previous visits
  // Keep one resolved context for routing, adaptive coverage, snapshots, and
  // final overlays. pathwayRef remains as a compatibility alias for existing
  // curated guidance callers and is never the sole safety decision.
  const clinicalContextRef = useRef<ClinicalContext>(resolveClinicalContext(""));
  const pathwayRef = useRef<ClinicalPathway | null>(null);

  useEffect(() => { turnsRef.current = turns; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns, busy, analyzing]);

  // The ordered script. Each step has a GUARANTEED base question (Hinglish +
  // English) so a bubble is NEVER empty — the AI only warms up the wording.
  // `intent` guides the AI; `base` is the fallback that always shows.
  type Step = { key: StepKey; intent: string; base: { hinglish: string; english: string }; options?: string[]; skip?: (a: Answers) => boolean };
  function script(): Step[] {
    return [
      { key: "identity", intent: "Ask whether they are a new patient or have visited this clinic before.", base: { hinglish: "Aap naye patient hain ya pehle bhi yahan aa chuke hain?", english: "Are you a new patient, or have you visited us before?" }, options: ["New patient", "Visited before"] },
      { key: "phone", intent: "Ask for their 10-digit mobile number so we can find or create their record.", base: { hinglish: "Kripya apna 10-digit mobile number bataiye, taaki hum aapka record bana/dhoondh sakein.", english: "Please share your 10-digit mobile number so we can find or create your record." } },
      { key: "name", intent: "Ask their full name.", base: { hinglish: "Aapka poora naam kya hai?", english: "What is your full name?" }, skip: () => isReturning },
      { key: "age", intent: "Ask their age in years.", base: { hinglish: "Aapki umar kitni hai (saalon mein)?", english: "How old are you (in years)?" }, skip: () => isReturning },
      { key: "sex", intent: "Ask their sex.", base: { hinglish: "Aapka ling kya hai?", english: "What is your sex?" }, options: ["Male", "Female", "Other"], skip: () => isReturning },
      { key: "location", intent: "Ask their city or area.", base: { hinglish: "Aap kis sheher/ilaake se hain?", english: "Which city or area are you from?" }, skip: () => isReturning },
      { key: "date", intent: "Ask which date they would like the appointment.", base: { hinglish: "Aap appointment kis din chahte hain? (jaise 2026-09-20)", english: "Which day would you like the appointment? (e.g. 2026-09-20)" } },
      { key: "time", intent: "Ask what time of day they prefer for the appointment.", base: { hinglish: "Kis samay aana chahenge — subah, dopahar ya shaam? (jaise 11:00)", english: "What time works for you — morning, afternoon or evening? (e.g. 11:00)" } },
      { key: "complaint", intent: "Ask the main problem or reason for the visit today.", base: { hinglish: "Aapko mukhya roop se kya takleef hai? Aaj kis wajah se aa rahe hain?", english: "What is the main problem troubling you? Why are you visiting today?" } },
      { key: "duration", intent: "Ask since when they have had this problem.", base: { hinglish: "Yeh takleef aapko kab se hai?", english: "Since when have you had this problem?" } },
      { key: "seen_doctor", intent: "Ask if they have already shown this to a doctor before; if yes, they can upload the old prescription with the attach button.", base: { hinglish: "Kya aapne is takleef ke liye pehle kisi doctor ko dikhaya hai? Agar haan, to purani parchi attach (📎) button se upload kar dijiye.", english: "Have you already seen a doctor for this? If yes, upload the old prescription using the attach (📎) button." }, options: ["Yes", "No"] },
      { key: "upload_prompt", intent: "Ask if they have any test report or scan to upload now using the attach button, or type no.", base: { hinglish: "Koi test report ya scan hai (blood test, MRI, CT, ultrasound)? Attach (📎) button se upload kar dijiye, ya 'nahi' likhein.", english: "Do you have any test report or scan (blood test, MRI, CT, ultrasound)? Upload it with the attach (📎) button, or type 'no'." }, options: ["I'll upload", "No reports"] },
      // NOTE: after this the flow enters a DYNAMIC AI deep-questioning phase that
      // asks complaint-specific questions (see askDeepQuestion) — not a fixed step.
    ];
  }

  // How many complaint-specific deep questions the AI may ask before finalizing.
  const MAX_DEEP = 4;

  function baseText(step: Step): string {
    return lang === "english" ? step.base.english : step.base.hinglish;
  }

  // AI warms up the fixed question in the patient's language. NEVER returns empty:
  // if the AI is unavailable or blank, the guaranteed base text is used.
  async function phrase(step: Step, last: string | null): Promise<string> {
    const fallback = baseText(step);
    const langTxt = lang === "english" ? "simple clear English" : "simple warm Hindi/Hinglish (Roman script)";
    try {
      // Race the AI against a timeout so a slow/absent AI never blocks the flow.
      const out = await Promise.race([
        serverAiChat(
          [
            { role: "system", content: `You are a warm medical appointment assistant talking to a patient, one question at a time in ${langTxt}. Reword the given question into ONE short friendly question (max ~25 words). You may start with a 2-3 word acknowledgement of their last answer. Output ONLY the question. No lists, no diagnosis, no preamble.` },
            { role: "user", content: `${last ? `Patient's last answer: "${last}"\n` : ""}Question to ask: ${fallback}\nIntent: ${step.intent}` },
          ],
          { model: MODELS.fast, temperature: 0.4, maxTokens: 80 }
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 12000)),
      ]);
      const clean = (out ?? "").trim();
      return clean.length >= 3 ? clean : fallback; // never blank
    } catch {
      return fallback;
    }
  }

  // Store an asked question so it can be reused across patients (question bank).
  function logQuestion(key: string, text: string) {
    void logAiTraining({ workflow: "intake_question", model: MODELS.fast, inputContext: { stepKey: key, lang }, aiOutput: text, outputType: "text", source: "patient_appointment" });
  }

  // Warm, friendly greeting + the first question on mount.
  useEffect(() => {
    void (async () => {
      setBusy(true);
      const greeting = lang === "english"
        ? "Hello! 👋 I'm your AI Upchar assistant. I'll ask a few quick questions to book your appointment and prepare your details for the doctor. Let's begin."
        : "Namaste! 👋 Main aapka AI Upchar assistant hoon. Appointment book karne aur doctor ke liye aapki jaankari taiyaar karne ke liye main kuch chhote sawaal poochunga. Chaliye shuru karte hain.";
      const first = script()[0];
      const q = await phrase(first, null);
      logQuestion(first.key, q);
      setTurns([{ role: "assistant", content: greeting }, { role: "assistant", content: q }]);
      setOptions(first.options ?? []);
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensurePatient(): Promise<string | null> {
    // Called once we have enough info. Returns patientId.
    if (patientId) return patientId;
    const phone = answers.phone ?? "";
    if (isReturning) {
      try {
        const res = await fetch(`/api/patients?phone=${encodeURIComponent(phone)}`);
        const jr = await res.json() as { ok: boolean; data?: { found: boolean; patient?: { id: string; name: string } } };
        if (jr.ok && jr.data?.found && jr.data.patient) {
          setPatientId(jr.data.patient.id);
          setPatientName(jr.data.patient.name);
          void loadPastVisits(jr.data.patient.id); // fetch history for AI context
          return jr.data.patient.id;
        }
      } catch { /* fall through to create */ }
    }
    // New patient (or returning not found) → create.
    try {
      const res = await fetch("/api/patients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: answers.name || "Patient", phone, age: answers.age, gender: answers.sex, address: answers.location, patientType: isReturning ? "returning" : "new" }),
      });
      const jr = await res.json() as { ok: boolean; data?: { patient: { id: string; name: string } }; error?: { message: string } };
      if (jr.ok && jr.data?.patient) { setPatientId(jr.data.patient.id); setPatientName(jr.data.patient.name); return jr.data.patient.id; }
    } catch { /* ignore */ }
    return null;
  }

  function normalizeDate(v: string): string {
    const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    // best-effort: default to 3 days out if they typed a vague day
    return new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  }
  function normalizeTime(v: string): string {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
    if (/morning|subah/i.test(v)) return "10:00";
    if (/afternoon|dopahar/i.test(v)) return "14:00";
    if (/evening|shaam/i.test(v)) return "17:00";
    return "11:00";
  }

  async function advance(answer: string) {
    // Hard lock: ignore a second submit while one is being processed (prevents
    // the double-message / double-question race seen when Enter+click overlap).
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      setTurns((p) => [...p, { role: "user", content: answer }]);
      setInput(""); setOptions([]); setBusy(true); setError("");

      // A clarification answer resolves the ambiguity without replacing the
      // authoritative SEX or complaint answer, then resumes the script.
      if (clarificationRef.current) {
        clarificationRef.current = false;
        const clarificationSteps = script();
        let nextIndex = stepRef.current + 1;
        while (clarificationSteps[nextIndex] && clarificationSteps[nextIndex].skip?.(answersRef.current)) nextIndex += 1;
        stepRef.current = nextIndex;
        if (clarificationSteps[nextIndex]) {
          const q = await phrase(clarificationSteps[nextIndex], answer);
          logQuestion(clarificationSteps[nextIndex].key, q);
          setTurns((p) => [...p, { role: "assistant", content: q }]);
          setOptions(clarificationSteps[nextIndex].options ?? []);
          setBusy(false);
          return;
        }
        await beginDeepPhase(answersRef.current);
        return;
      }

      // ── If we're in the dynamic AI deep-questioning phase, route the answer
      //    there instead of the fixed script. ──
      if (inDeepPhaseRef.current) {
        const lastIndex = deepQARef.current.length - 1;
        const currentDeep = deepQARef.current[lastIndex];
        if (currentDeep) deepQARef.current[lastIndex] = { ...currentDeep, a: answer };
        await continueDeepPhase();
        return;
      }

      const steps = script();
      let idx = stepRef.current;
      const cur = steps[idx];
      if (!cur) { setBusy(false); await beginDeepPhase(answersRef.current); return; }

      // Record answer + side effects.
      const next: Answers = { ...answersRef.current, [cur.key]: answer };
      if (cur.key === "identity") setIsReturning(/before|visited|purana|pehle/i.test(answer));
      answersRef.current = next;
      setAnswers(next);

      // This gate runs before the fixed complaint → duration transition.
      // It never rewrites structured context; it pauses for clarification or
      // safety review before the generic script can continue. The complaint is
      // not restricted to a small gender-specific keyword list: the semantic
      // boundary may understand any disease/symptom and return a relevant gate.
      if (cur.key === "complaint") {
        const assessment = await assessAppointmentAnswer({
          answers: next,
          latestAnswer: answer,
          previousAnswers: Object.values(next),
          previousPatientContext: pastVisitsRef.current ?? "",
        });
        if (assessment.status !== "CONSISTENT") {
          clarificationRef.current = true;
          setTurns((p) => [...p, { role: "assistant", content: assessment.question }]);
          setBusy(false);
          return;
        }
      }

      // As soon as we know the complaint: (1) match a curated clinical pathway
      // to frame safe, consistent questioning, and (2) research (in background)
      // WHAT a doctor should ask for this condition, guiding the deep questions.
      if (cur.key === "complaint" && answer.trim().length > 2) {
        const context = resolveClinicalContext(answer, next.duration ?? "");
        clinicalContextRef.current = context;
        pathwayRef.current = context.pathway;
        void buildResearchPlan(next);
      }

      // Advance to next non-skipped step.
      idx += 1;
      while (steps[idx] && steps[idx].skip?.(next)) idx += 1;
      stepRef.current = idx;

      // More fixed questions remain → ask the next.
      if (steps[idx]) {
        const q = await phrase(steps[idx], answer);
        logQuestion(steps[idx].key, q);
        setTurns((p) => [...p, { role: "assistant", content: q }]);
        setOptions(steps[idx].options ?? []);
        setBusy(false);
        return;
      }

      // Fixed script finished → start the AI deep-questioning phase.
      await beginDeepPhase(next);
    } finally {
      processingRef.current = false;
    }
  }

  // Start the dynamic phase: AI asks the FIRST complaint-specific deep question.
  async function beginDeepPhase(a: Answers) {
    inDeepPhaseRef.current = true;
    deepCountRef.current = 0;
    deepQARef.current = [];
    setBusy(true);
    const selection = await nextDeepQuestion(a);
    // A null selection is safe only when coverage is complete or the hard
    // MAX_DEEP ceiling has been reached. An unresolved safety screen is carried
    // into finalization as clinician-review-needed, never as a passed screen.
    if (!selection) { await finishFromDeep(a); return; }
    deepCountRef.current = 1;
    deepQARef.current.push({ q: selection.text, a: "", dimension: selection.dimension, source: selection.source });
    logQuestion("deep_symptom", selection.text);
    setTurns((p) => [...p, { role: "assistant", content: selection.text }]);
    setBusy(false);
  }

  // After a deep answer: decide whether to ask another or finalize.
  async function continueDeepPhase() {
    setBusy(true);
    // Hard SAFETY CEILING (not the completion criterion): the interview can
    // never loop past MAX_DEEP complaint-specific questions.
    if (deepCountRef.current >= MAX_DEEP) { await finishFromDeep(answersRef.current); return; }
    const selection = await nextDeepQuestion(answersRef.current);
    if (!selection) { await finishFromDeep(answersRef.current); return; }
    deepCountRef.current += 1;
    deepQARef.current.push({ q: selection.text, a: "", dimension: selection.dimension, source: selection.source });
    logQuestion("deep_symptom", selection.text);
    setTurns((p) => [...p, { role: "assistant", content: selection.text }]);
    setBusy(false);
  }

  // Fold the deep Q/A into the symptoms bucket and finalize.
  async function finishFromDeep(a: Answers) {
    inDeepPhaseRef.current = false;
    const transcript = deepQARef.current.filter((x) => x.a).map((x) => `${x.q} -> ${x.a}`).join(" | ");
    const merged: Answers = { ...a, symptoms: transcript || a.symptoms };
    answersRef.current = merged;
    setAnswers(merged);
    setBusy(false);
    await finalize(merged);
  }

  // Background: research (Perplexity) what a doctor should ask for this complaint.
  // Cached in questionPlanRef and reused to guide the deep questions. Best-effort.
  async function buildResearchPlan(a: Answers) {
    if (questionPlanRef.current) return;
    try {
      const plan = await serverAiChat(
        [{ role: "user", content: buildQuestionPlanPrompt(snapshotFrom(a)) }],
        { model: MODELS.research, maxTokens: 500 }
      );
      const clean = (plan ?? "").trim();
      if (clean.length > 10) {
        questionPlanRef.current = clean;
        logQuestion("question_plan", clean);
      }
    } catch { /* deep questions still work without the plan */ }
  }

  // The core intelligence: AI generates ONE complaint-specific deep question,
  // guided by the research question-plan, aware of everything asked so far.
  // The return value carries target metadata so only a targeted safety question
  // can produce explicit red_flag_screen evidence.
  async function nextDeepQuestion(a: Answers): Promise<DeepQuestion | null> {
    const coverage = coverageNow(a);
    if (coverage.complete) return null;
    const langTxt = lang === "english" ? "simple clear English" : "simple warm Hindi/Hinglish (Roman script)";
    const asked = deepQARef.current.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a || "(not answered yet)"}`).join("\n");
    const plan = questionPlanRef.current;
    const context = clinicalContextRef.current;
    const pathway = pathwayForClinicalContext(context);
    const guidance = pathway ? pathwayGuidance(pathway, lang) : "";
    const mustContinue = !coverage.complete;
    try {
      const out = await Promise.race([
        serverAiChat(
          [
            {
              role: "system",
              content: [
                `You are an experienced doctor doing intake with a patient in ${langTxt}.`,
                pathway
                  ? "You have a curated CLINICAL PATHWAY (reviewed question set + danger signs) for this complaint, plus a research-based plan. Use the pathway as your primary guide and cover its key questions and danger signs first."
                  : "You have a research-based PLAN of the questions a doctor should ask for this condition.",
                "Ask the SINGLE most useful NEXT question on a NEW topic that is still missing from the adaptive coverage.",
                "Cover only relevant associated symptoms, character/severity, timing/triggers, relevant history, and DANGER/red-flag signs.",
                "The question MUST be specific to their complaint — never generic or irrelevant.",
                "CRITICAL: Never repeat or re-ask a topic already asked (even in different words). Look at the",
                "'Deep questions asked so far' and pick something genuinely NEW.",
                "If the key topics are already covered OR the patient's answers already give enough to brief the",
                "doctor, reply with exactly: STOP (do not keep asking for the sake of it).",
                "Otherwise output ONLY the single new question (max ~25 words).",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `Main complaint: ${a.complaint ?? ""}`,
                `Duration: ${a.duration ?? ""}`,
                `Seen a doctor before: ${a.seen_doctor ?? ""}`,
                `Age: ${a.age ?? ""}, Sex: ${a.sex ?? ""}`,
                guidance ? guidance : "",
                plan ? `RESEARCH-BASED QUESTION PLAN:\n${plan}` : "",
                `MISSING COVERAGE DIMENSIONS: ${coverage.missing.join(", ")}`,
                asked ? `Deep questions asked so far:\n${asked}` : "No deep questions asked yet — ask the first, most relevant one.",
              ].filter(Boolean).join("\n"),
            },
          ],
          { model: MODELS.reasoning, temperature: 0.5, maxTokens: 80 }
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 12000)),
      ]);
      const clean = (out ?? "").trim();
      const wantsStop = /^stop\b/i.test(clean) || clean.length < 3;
      // The AI wants to stop, or gave a duplicate. While coverage is missing,
      // deterministically ask the next missing dimension instead.
      if (wantsStop || isDuplicateQuestion(clean)) {
        if (mustContinue) return dimensionQuestion(coverage.missing);
        return null;
      }
      return { text: clean, source: "ai", dimension: inferQuestionDimension(clean) };
    } catch {
      // AI unavailable → ask about the next uncovered dimension deterministically,
      // preferring the resolved pathway's curated question. This preserves
      // complaint-specific adaptive questioning even fully offline.
      if (mustContinue) return dimensionQuestion(coverage.missing);
      return null;
    }
  }

  function inferQuestionDimension(question: string): HistoryDimension | undefined {
    const q = question.toLowerCase();
    if (/danger|red flag|breath|saans|radiat|arm|haath|jaw|jabda|sweat|paseena|faint|behosh|unconscious|bleed|khoon|exertion|mehnat|chalne/.test(q)) return "red_flag_screen";
    if (/when|since|long|start|kab|kitne din|hafte|shuru|duration|onset|aaj|kal/.test(q)) return "onset_duration";
    if (/severe|severity|how bad|0.?10|feel|character|pressure|burning|dard kaisa|kitna tez|kaisa/.test(q)) return "severity_character";
    if (/other symptom|associated|along with|anything else|aur koi|saath|ulti|bukhar|nausea|symptom/.test(q)) return "associated_symptoms";
    if (/doctor|medicine|dawa|treatment|report|test|pehle.*dikhaya/.test(q)) return "prior_care";
    if (/history|known|diabetes|blood pressure|bp|heart disease|smok|bimari|medical/.test(q)) return "relevant_history";
    return undefined;
  }


  // True if `q` overlaps heavily (>=55% shared significant words) with a question
  // already asked — so we don't repeat the same question in different wording.
  function isDuplicateQuestion(q: string): boolean {
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
    const words = new Set(norm(q));
    if (words.size === 0) return false;
    for (const prev of deepQARef.current) {
      const pw = norm(prev.q);
      if (pw.length === 0) continue;
      const shared = pw.filter((w) => words.has(w)).length;
      const ratio = shared / Math.min(words.size, pw.length);
      if (ratio >= 0.55) return true;
    }
    return false;
  }

  // Fetch a compact summary of the patient's previous visits for AI context.
  async function loadPastVisits(pid: string) {
    if (pastVisitsRef.current) return;
    try {
      const res = await fetch(`/api/appointments/chat?patientId=${encodeURIComponent(pid)}&context=1`);
      const jr = await res.json() as { ok: boolean; data?: { pastSummary?: string } };
      if (jr.ok && jr.data?.pastSummary) pastVisitsRef.current = jr.data.pastSummary;
    } catch { /* best effort */ }
  }

  // Patient evidence is deliberately separate from the assistant's question
  // transcript. Question wording must never satisfy coverage or raise a safety
  // signal after finishFromDeep folds Q/A into `a.symptoms`.
  function patientTextsFrom(a: Answers): string[] {
    return [
      a.complaint, a.duration, a.seen_doctor, a.self_medicine,
      ...deepQARef.current.map((x) => x.a),
    ].filter((x): x is string => Boolean(x));
  }

  function patientSafetyText(a: Answers): string {
    return patientTextsFrom(a).join(" . ");
  }

  // Coverage/completeness snapshot for the CURRENT collected info. Completion of
  // the deep phase is gated on this (not on a fixed count/order): the interview
  // may finalize only when no required clinical dimension is still missing.
  function safetyEvidenceFrom(): SafetyEvidence[] {
    return deepQARef.current
      .filter((item) => Boolean(item.a) && item.dimension === "red_flag_screen")
      .map((item) => ({ source: "patient_answer" as const, text: item.a, questionDimension: "red_flag_screen" as const }));
  }

  // Coverage/completeness snapshot for the CURRENT collected info. Completion of
  // the deep phase is gated on this (not on a fixed count/order): the interview
  // may finalize only when no required clinical dimension is still missing.
  function coverageNow(a: Answers) {
    return coverageFor(clinicalContextRef.current, {
      patientTexts: patientTextsFrom(a),
      safetyEvidence: safetyEvidenceFrom(),
    });
  }

  // Deterministic question targeting the next uncovered dimension — used when
  // the AI is unavailable OR tries to STOP while a dimension is still missing.
  // The returned target metadata is what makes a later answer eligible for the
  // explicit safety-screen evidence boundary.
  function dimensionQuestion(missing: HistoryDimension[]): DeepQuestion | null {
    for (const dimension of missing) {
      const q = questionForDimension(clinicalContextRef.current, dimension, isDuplicateQuestion);
      if (q) return { text: lang === "english" ? q.english : q.hinglish, dimension, source: "deterministic" };
    }
    const fallbackDimension = missing[0];
    if (fallbackDimension) {
      const fallbackText: Record<HistoryDimension, string> = {
        onset_duration: "Please clarify exactly when this started and how long it has been happening.",
        severity_character: "Please describe how severe this is and what the sensation feels like.",
        associated_symptoms: "Please tell me whether any other symptoms occur with this problem.",
        prior_care: "Please tell me whether you have already seen a doctor, taken medicine, or had tests for this.",
        relevant_history: "Please share any relevant existing medical conditions or previous history.",
        red_flag_screen: "Please answer the danger-sign question explicitly: are any warning signs present, or none?",
      };
      return { text: fallbackText[fallbackDimension], dimension: fallbackDimension, source: "deterministic" };
    }
    return null;
  }

  // Build the clinical snapshot from collected answers + uploaded report findings.
  function snapshotFrom(a: Answers, coverage: CoverageResult = coverageNow(a)): IntakeSnapshot {
    const context = clinicalContextRef.current;
    const patientText = patientSafetyText(a);
    const flags = detectRedFlagsForContext(context, patientText);
    const safetyNote = coverage.required.includes("red_flag_screen") && coverage.safetyEvaluation.unresolved
      ? "Safety screen unresolved/incomplete — explicit targeted answer and clinician review required"
      : "";
    const redFlagLines = [
      ...flags.map((flag) => `${flag.signal} [${flag.urgency}]`),
      safetyNote,
    ].filter(Boolean);
    return {
      patientType: isReturning ? "returning" : "new",
      name: a.name, age: a.age, sex: a.sex,
      chiefComplaint: a.complaint ?? "",
      duration: a.duration,
      history: [a.seen_doctor ? `Seen a doctor before: ${a.seen_doctor}` : "", a.self_medicine ?? ""].filter(Boolean).join("; "),
      symptoms: a.symptoms,
      reportFindings: findings.map((f) => `${f.documentType || "report"}: ${f.overallImpression}${f.abnormal.length ? ` | abnormal: ${f.abnormal.join("; ")}` : ""}`).join(" || "),
      pathway: pathwayForClinicalContext(context)?.displayName,
      redFlags: redFlagLines.length ? redFlagLines.join("; ") : undefined,
      pastVisits: pastVisitsRef.current || undefined,
    };
  }

  async function finalize(a: Answers) {
    setPhase("finalizing");
    setError("");
    // 1) Ensure the patient record exists.
    setFinalizeMsg("Saving your details…");
    const pid = await ensurePatient();
    if (!pid) { setError("Could not create your patient record. Please check your details."); setPhase("chat"); return; }

    const finalCoverage = coverageNow(a);
    const finalSafety = finalCoverage.safetyEvaluation;
    const snapshot = snapshotFrom(a, finalCoverage);

    // 2) Internet deep research (Perplexity sonar). Now the snapshot includes all
    //    symptom answers, so run a full briefing (best effort).
    let research = "";
    try {
      setFinalizeMsg("Researching your condition on the web…");
      const researchPrompt = buildResearchPrompt(snapshot);
      research = await serverAiChatStream(
        [{ role: "user", content: researchPrompt }],
        () => { },
        { model: MODELS.research, maxTokens: 900 }
      );
      void logAiTraining({ workflow: "web_research", patientId: pid, model: MODELS.research, inputContext: researchPrompt, aiOutput: research, outputType: "markdown", source: "patient_appointment" });
    } catch { research = ""; }
    if (!research) research = researchRef.current; // reuse the plan-time research if the full one failed

    // 3) Compile the structured report.
    let report;
    try {
      setFinalizeMsg("Preparing your report for the doctor…");
      const raw = await serverAiChat(buildPreVisitReportMessages(snapshot, research), { model: MODELS.reasoning, temperature: 0.2, maxTokens: 1200 });
      report = parsePreVisitReport(raw, research);
      void logAiTraining({ workflow: "pre_visit_report", patientId: pid, model: MODELS.reasoning, inputContext: snapshot, aiOutput: raw, outputType: "json", source: "patient_appointment" });
    } catch {
      report = parsePreVisitReport("", research);
      report.chiefComplaint = snapshot.chiefComplaint;
      report.summary = `${snapshot.chiefComplaint || "Patient"} — ${snapshot.duration ?? ""}. ${snapshot.symptoms ?? ""}`.trim();
    }

    // 3b) Deterministic safety overlay (Clinical Library §7): reuse the same
    //     resolved context and final safety evaluation used by coverage/snapshot.
    //     Complaint context can surface explainable signals, but only explicit
    //     targeted evidence can complete red_flag_screen.
    const context = clinicalContextRef.current;
    const patientText = patientSafetyText(a);
    const detected = detectRedFlagsForContext(context, patientText);
    const allDetected = [...finalSafety.signals, ...detected].filter((flag, index, all) =>
      all.findIndex((other) => other.signal === flag.signal && other.urgency === flag.urgency) === index,
    );
    const unresolvedNote = "Safety screen unresolved/incomplete — clinician review required";
    if (finalCoverage.missing.length) {
      const incompleteNote = `Adaptive intake incomplete — unresolved dimensions: ${finalCoverage.missing.join(", ")}; clinician review required`;
      if (!report.missingInfo.some((item) => item.toLowerCase().includes("adaptive intake incomplete"))) report.missingInfo.push(incompleteNote);
    }
    if (finalCoverage.required.includes("red_flag_screen") && finalSafety.unresolved) {
      if (!report.missingInfo.some((item) => item.toLowerCase().includes("safety screen"))) report.missingInfo.push(unresolvedNote);
      if (!report.redFlags.some((item) => item.toLowerCase().includes("safety screen"))) report.redFlags.push(unresolvedNote);
      if (!report.urgencyReason) report.urgencyReason = unresolvedNote;
    }
    if (allDetected.length) {
      const existing = new Set(report.redFlags.map((r) => r.toLowerCase()));
      for (const f of allDetected) {
        const line = `${f.signal} (${f.urgency})`;
        if (!existing.has(line.toLowerCase())) report.redFlags.push(line);
      }
      const rank: Record<string, number> = { routine: 0, opd: 1, urgent: 2, admit: 3, emergency: 4 };
      const worst = allDetected.some((f) => f.urgency === "emergency") ? "emergency" : "urgent";
      if ((rank[worst] ?? 0) > (rank[report.urgency] ?? 0)) {
        report.urgency = worst as typeof report.urgency;
        if (!report.urgencyReason) report.urgencyReason = `Auto-flagged: ${allDetected[0].signal}`;
      }
    }

    // 4) Save the AI report for the doctor (structured JSON + legacy fields).
    let briefId = "";
    try {
      const res = await fetch("/api/pre-visit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_ai_report", patientId: pid, patientType: snapshot.patientType, report, reportJson: JSON.stringify(report) }),
      });
      const jr = await res.json() as { ok: boolean; data?: { briefId?: string } };
      briefId = jr.data?.briefId ?? "";
    } catch { /* best effort */ }

    // 5) Create the appointment.
    setFinalizeMsg("Booking your appointment…");
    const date = normalizeDate(a.date ?? "");
    const time = normalizeTime(a.time ?? "");
    const visitType = isReturning ? "follow_up" : "new_complaint";
    let appointmentId = "";
    try {
      const res = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: pid, appointmentDate: date, appointmentTime: time, visitType, channel: "web", reason: a.complaint }),
      });
      const jr = await res.json() as { ok: boolean; data?: { appointment: { id: string } }; error?: { message: string } };
      if (!jr.ok || !jr.data?.appointment) throw new Error(jr.error?.message ?? "Booking failed.");
      appointmentId = jr.data.appointment.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book the appointment.");
      setPhase("chat");
      return;
    }

    // 6) Save the full chat transcript for this appointment (visit history).
    try {
      await fetch("/api/appointments/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: pid, appointmentId, briefId, transcript: turnsRef.current }),
      });
    } catch { /* best effort */ }

    const token = `#${Math.floor(5 + Math.random() * 20)}`;
    setCreated({ date, time, token, patientId: pid });
    setPhase("done");
  }

  // ── Report/prescription upload (inline, during chat) ──
  async function handleFile(file: File) {
    setError("");
    if (file.size > MAX_BYTES) { setError("File is too large (max 20 MB)."); return; }
    if (!ACCEPTED.split(",").includes(file.type)) { setError("Please upload a PNG, JPG, WEBP or PDF."); return; }

    const pid = await ensurePatient();
    const kind = kindFromFile(file.name, file.type);
    setTurns((p) => [...p, { role: "user", content: `📎 ${file.name}` }, { role: "assistant", content: lang === "english" ? "Got it — reading your report now…" : "Mil gaya — main aapki report padh raha hoon…" }]);
    setUploadedNames((n) => [...n, file.name]);
    setAnalyzing(true);

    // Upload to Supabase (durable, for the doctor) if we have a patient.
    let reportId = "";
    if (pid) {
      try {
        const form = new FormData();
        form.append("file", file); form.append("patientId", pid); form.append("title", file.name);
        form.append("type", kind === "Imaging" || kind === "Referral" ? "Lab report" : kind);
        const res = await fetch("/api/reports/upload", { method: "POST", body: form });
        const jr = await res.json() as { ok: boolean; data?: { report?: { id: string } } };
        reportId = jr.data?.report?.id ?? "";
      } catch { /* continue to analysis anyway */ }
    }

    // Image vision uses the server-side OpenAI boundary. PDFs are persisted for
    // the doctor but are not sent through the old Puter browser integration.
    try {
      const prompt = buildReportVisionPrompt(kind);
      const imageResult = file.type.startsWith("image/")
        ? await serverAiAnalyzeImage(file, prompt)
        : "";
      const f = mergeFindings(
        imageResult ? parseReportFindings(imageResult) : null,
        null,
      );
      if (f) {
        setFindings((prev) => [...prev, f]);
        if (reportId) {
          await fetch("/api/reports/upload", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId, findings: JSON.stringify(f) }) }).catch(() => { });
        }
        const line = hasAbnormalFindings(f)
          ? (lang === "english" ? `I've read it. A few values need the doctor's attention: ${f.abnormal.slice(0, 3).join("; ")}.` : `Maine padh liya. Kuch cheezein doctor ke dhyaan dene layak hain: ${f.abnormal.slice(0, 3).join("; ")}.`)
          : (lang === "english" ? "I've read it — it looks broadly normal. The doctor will confirm." : "Maine padh liya — kaafi had tak normal lagta hai. Doctor confirm karenge.");
        setTurns((p) => [...p, { role: "assistant", content: line }]);
        // Adaptive follow-up.
        try {
          const adaptive = await serverAiChat(buildAdaptiveQuestionMessages(f, lang), { model: MODELS.fast, temperature: 0.4, maxTokens: 80 });
          if (adaptive.trim()) setTurns((p) => [...p, { role: "assistant", content: adaptive.trim() }]);
        } catch { /* ignore */ }
      } else {
        setTurns((p) => [...p, { role: "assistant", content: lang === "english" ? "Saved for the doctor. I couldn't read it clearly — the doctor will review the original." : "Doctor ke liye save ho gaya. Main ise saaf padh nahi paaya — doctor original dekh lenge." }]);
      }
    } catch {
      const msg = lang === "english" ? "Saved for the doctor. AI reading is unavailable right now." : "Doctor ke liye save ho gaya. AI reading abhi uplabdh nahi hai.";
      setTurns((p) => [...p, { role: "assistant", content: msg }]);
    } finally {
      setAnalyzing(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void handleFile(f);
  }

  function send(v: string) {
    const t = v.trim();
    if (!t || busy || analyzing || phase !== "chat" || processingRef.current) return;
    void advance(t);
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <button onClick={() => setLang((l) => (l === "hinglish" ? "english" : "hinglish"))} disabled={turns.length > 1} className="rounded-lg border border-[#e4ebe7] px-2.5 py-1.5 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3] disabled:opacity-50">
            {lang === "hinglish" ? "हिन्दी / Hinglish" : "English"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-6">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Chat */}
        {phase !== "done" && (
          <div className="flex h-[74vh] flex-col overflow-hidden rounded-2xl border border-[#e1e9e5] bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#eef4f1] bg-[#f7fbf9] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07947f] text-white"><Stethoscope className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-bold text-[#1f3a37]">Book with AI Upchar</p>
                <p className="flex items-center gap-1.5 text-[11px] text-[#5a967e]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Appointment + pre-visit intake</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[#fbfdfc] px-4 py-5">
              {turns.map((t, i) => t.role === "assistant" ? (
                <div key={i} className="flex items-end gap-2">
                  <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2f1ea] text-[#07947f]"><Stethoscope className="h-3.5 w-3.5" /></span>
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#e4efe9] bg-white px-4 py-2.5 text-sm leading-6 text-[#2f4a43] shadow-sm">{t.content}</div>
                </div>
              ) : (
                <div key={i} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#07947f] px-4 py-2.5 text-sm leading-6 text-white shadow-sm">{t.content}</div></div>
              ))}

              {(busy || analyzing || phase === "finalizing") && (
                <div className="flex items-end gap-2">
                  <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2f1ea] text-[#07947f]"><Stethoscope className="h-3.5 w-3.5" /></span>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e4efe9] bg-white px-4 py-3 shadow-sm">
                    {phase === "finalizing" ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-[#07947f]" /><span className="text-xs text-[#5a967e]">{finalizeMsg}</span></> : (
                      <>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa] [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa] [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa]" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {uploadedNames.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[#eef4f1] bg-white px-3 pt-2.5">
                {uploadedNames.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full border border-[#c2ddd5] bg-[#f1f7f2] px-2.5 py-1 text-[11px] font-semibold text-[#317b67]"><FileText className="h-3 w-3" />{n}</span>
                ))}
              </div>
            )}

            {options.length > 0 && !busy && phase === "chat" && (
              <div className="flex flex-wrap gap-2 border-t border-[#eef4f1] bg-white px-3 pt-3">
                {options.map((o) => <button key={o} onClick={() => send(o)} className="rounded-full border border-[#c2ddd5] bg-[#f1f7f2] px-3 py-1.5 text-xs font-semibold text-[#317b67] hover:bg-[#e3f0ea]">{o}</button>)}
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-[#eef4f1] bg-white p-3">
              <input ref={fileRef} type="file" accept={ACCEPTED} onChange={onPick} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={busy || analyzing || phase !== "chat"} aria-label="Upload report or prescription" title="Upload report / prescription" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce9e3] text-[#07947f] hover:bg-[#f0f6f3] disabled:opacity-50"><Paperclip className="h-4 w-4" /></button>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} disabled={busy || phase !== "chat"} placeholder={lang === "english" ? "Type your reply…" : "Apna jawab likhein…"} autoFocus className="min-w-0 flex-1 rounded-full border border-[#dce9e3] px-4 py-2.5 text-sm outline-none focus:border-[#07947f] disabled:bg-[#f7faf8]" />
              <button onClick={() => send(input)} disabled={busy || phase !== "chat" || !input.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#07947f] text-white hover:bg-[#066d66] disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Success */}
        {phase === "done" && created && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#b9decf] bg-[#f0faf5] p-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#07947f]" />
              <h2 className="text-xl font-bold text-[#1f6a4a]">Appointment created successfully!</h2>
              <p className="mt-2 text-sm text-[#317b67]">{patientName ? `${patientName}, ` : ""}your visit is booked. Your full details and an AI report have been sent to the doctor.</p>
              <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#c2ddd5] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Date</p><p className="mt-1 text-sm font-bold text-[#1f6a4a]">{created.date}</p></div>
                <div className="rounded-xl border border-[#c2ddd5] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Time</p><p className="mt-1 text-sm font-bold text-[#1f6a4a]">{created.time}</p></div>
              </div>
              <p className="mt-3 text-sm text-[#3f6b5c]">Appointment no. <strong>{created.token}</strong></p>
            </div>
            <AppointmentsList patientId={created.patientId} />
          </div>
        )}
      </div>
    </main>
  );
}

// Patient's appointments list, shown after a successful booking.
function AppointmentsList({ patientId }: { patientId: string }) {
  const [appts, setAppts] = useState<{ id: string; appointmentDate: string; appointmentTime: string; visitType: string; reason?: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/appointments?patientId=${encodeURIComponent(patientId)}`);
        const jr = await res.json() as { ok: boolean; data?: { appointments: typeof appts } };
        setAppts(jr.data?.appointments ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [patientId]);

  return (
    <div className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-[#1f3a37]"><CalendarCheck2 className="h-4 w-4 text-[#07947f]" /> My appointments</p>
      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="mt-3 space-y-2">
          {appts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-[#eef4f1] px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-[#24443f]">{a.reason || a.visitType.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-[#8a9e98]">{a.appointmentDate} · {a.appointmentTime}</p>
              </div>
              <span className="rounded-full bg-[#edf7f2] px-2 py-0.5 text-[10px] font-bold capitalize text-[#4f9d78]">{a.status.replace(/_/g, " ")}</span>
            </div>
          ))}
          {appts.length === 0 && <p className="py-4 text-center text-sm text-[#9db3aa]">No appointments yet.</p>}
          <Link href="/patient/portal" className="mt-2 block w-full rounded-xl border border-[#c2ddd5] py-2.5 text-center text-sm font-semibold text-[#317b67]">Go to my portal</Link>
        </div>
      )}
    </div>
  );
}
