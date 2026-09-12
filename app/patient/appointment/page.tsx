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
import { aiChat, aiAnalyzeFile, aiChatStream, MODELS, puterUpload, PuterUnavailableError } from "@/lib/puterClient";
import {
  buildAdaptiveQuestionMessages,
  buildPreVisitReportMessages,
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

function kindFromFile(name: string, mime: string): ReportKind {
  const n = name.toLowerCase();
  if (/prescri|rx|parchi/.test(n)) return "Prescription";
  if (/mri|ct|x-?ray|xray|ultrasound|sono|scan|imaging/.test(n)) return "Imaging";
  if (/refer/.test(n)) return "Referral";
  return "Lab report";
}

export default function AppointmentFlowPage() {
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
  const pendingFollowUpRef = useRef<StepKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns, busy, analyzing]);

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
      { key: "symptoms", intent: "Ask what specific difficulties or symptoms they face right now due to this problem.", base: { hinglish: "Is takleef ke kaaran abhi aapko kya-kya pareshani ho rahi hai? (jaise dard, saans, khana, chalna, kamzori)", english: "What difficulties are you facing right now because of this? (e.g. pain, breathing, eating, walking, weakness)" } },
    ];
  }

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
        aiChat(
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
    const steps = script();
    let idx = stepRef.current;
    const cur = steps[idx];
    if (!cur) return;

    // Record answer + side effects.
    const next: Answers = { ...answers, [cur.key]: answer };
    if (cur.key === "identity") setIsReturning(/before|visited|purana|pehle/i.test(answer));
    setAnswers(next);
    setTurns((p) => [...p, { role: "user", content: answer }]);
    setInput(""); setOptions([]); setBusy(true); setError("");

    // After the main complaint or symptoms, let the AI ask ONE intelligent
    // follow-up of its own (adaptive), then continue the fixed script.
    if ((cur.key === "complaint" || cur.key === "symptoms") && answer.trim().length > 2) {
      const followUp = await aiFollowUp(next, answer);
      if (followUp) {
        setTurns((p) => [...p, { role: "assistant", content: followUp }]);
        // Merge the follow-up answer into the same key's context on next turn.
        // (We keep the script position; the patient's reply is stored under the
        //  same clinical bucket so the report still gets it.)
        setBusy(false);
        pendingFollowUpRef.current = cur.key;
        return;
      }
    }
    // If the previous assistant message was an AI follow-up, fold this answer in
    // and DO NOT advance the script index (we already advanced before the F/U).
    if (pendingFollowUpRef.current) {
      const k = pendingFollowUpRef.current;
      pendingFollowUpRef.current = null;
      const merged: Answers = { ...next, [k]: `${next[k] ?? ""} | ${answer}`.trim() };
      setAnswers(merged);
      // fall through to ask the next scripted question using `merged`
      if (steps[idx]) {
        const q = await phrase(steps[idx], answer);
        logQuestion(steps[idx].key, q);
        setTurns((p) => [...p, { role: "assistant", content: q }]);
        setOptions(steps[idx].options ?? []);
        setBusy(false);
        return;
      }
      setBusy(false);
      await finalize(merged);
      return;
    }

    // Advance to next non-skipped step.
    idx += 1;
    while (steps[idx] && steps[idx].skip?.(next)) idx += 1;
    stepRef.current = idx;

    // If more questions remain, phrase the next one.
    if (steps[idx]) {
      const q = await phrase(steps[idx], answer);
      logQuestion(steps[idx].key, q);
      setTurns((p) => [...p, { role: "assistant", content: q }]);
      setOptions(steps[idx].options ?? []);
      setBusy(false);
      return;
    }

    // ── Conversation finished → finalize ──
    setBusy(false);
    await finalize(next);
  }

  // AI generates ONE smart follow-up question based on the answer so far.
  // Guaranteed non-empty-or-skip: returns "" if AI unavailable (flow continues).
  async function aiFollowUp(a: Answers, lastAnswer: string): Promise<string> {
    const langTxt = lang === "english" ? "simple clear English" : "simple warm Hindi/Hinglish (Roman script)";
    const patientType = isReturning ? "returning" : "new";
    try {
      const out = await aiChat(
        [
          { role: "system", content: `You are a doctor's intake assistant talking to a ${patientType} patient in ${langTxt}. Based on what they just told you, ask ONE short, specific follow-up question that a good doctor would ask to understand the problem better (severity, triggers, associated symptoms, impact on daily life). Output ONLY the single question (max ~25 words). No diagnosis, no advice, no lists.` },
          { role: "user", content: `Main complaint: ${a.complaint ?? ""}\nDuration: ${a.duration ?? ""}\nSymptoms so far: ${a.symptoms ?? ""}\nPatient's latest answer: "${lastAnswer}"` },
        ],
        { model: MODELS.fast, temperature: 0.5, maxTokens: 70 }
      );
      const clean = (out ?? "").trim();
      if (clean.length < 3) return "";
      logQuestion("ai_followup", clean);
      return clean;
    } catch {
      return "";
    }
  }

  async function finalize(a: Answers) {
    setPhase("finalizing");
    setError("");
    // 1) Ensure the patient record exists.
    setFinalizeMsg("Saving your details…");
    const pid = await ensurePatient();
    if (!pid) { setError("Could not create your patient record. Please check your details."); setPhase("chat"); return; }

    const snapshot: IntakeSnapshot = {
      patientType: isReturning ? "returning" : "new",
      name: a.name, age: a.age, sex: a.sex,
      chiefComplaint: a.complaint ?? "",
      duration: a.duration,
      history: [a.seen_doctor ? `Seen a doctor before: ${a.seen_doctor}` : "", a.self_medicine ?? ""].filter(Boolean).join("; "),
      symptoms: a.symptoms,
      reportFindings: findings.map((f) => `${f.documentType || "report"}: ${f.overallImpression}${f.abnormal.length ? ` | abnormal: ${f.abnormal.join("; ")}` : ""}`).join(" || "),
    };

    // 2) Internet deep research (Perplexity sonar) — best effort.
    let research = "";
    try {
      setFinalizeMsg("Researching your condition on the web…");
      const researchPrompt = buildResearchPrompt(snapshot);
      research = await aiChatStream(
        [{ role: "user", content: researchPrompt }],
        () => { },
        { model: MODELS.research, maxTokens: 900 }
      );
      void logAiTraining({ workflow: "web_research", patientId: pid, model: MODELS.research, inputContext: researchPrompt, aiOutput: research, outputType: "markdown", source: "patient_appointment" });
    } catch { research = ""; }

    // 3) Compile the structured report.
    let report;
    try {
      setFinalizeMsg("Preparing your report for the doctor…");
      const raw = await aiChat(buildPreVisitReportMessages(snapshot, research), { model: MODELS.reasoning, temperature: 0.2, maxTokens: 1200 });
      report = parsePreVisitReport(raw, research);
      void logAiTraining({ workflow: "pre_visit_report", patientId: pid, model: MODELS.reasoning, inputContext: snapshot, aiOutput: raw, outputType: "json", source: "patient_appointment" });
    } catch {
      report = parsePreVisitReport("", research);
      report.chiefComplaint = snapshot.chiefComplaint;
      report.summary = `${snapshot.chiefComplaint || "Patient"} — ${snapshot.duration ?? ""}. ${snapshot.symptoms ?? ""}`.trim();
    }

    // 4) Save the AI report for the doctor.
    try {
      await fetch("/api/pre-visit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_ai_report", patientId: pid, patientType: snapshot.patientType, report }),
      });
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

    const token = `#${Math.floor(5 + Math.random() * 20)}`;
    setCreated({ date, time, token, patientId: pid });
    void appointmentId;
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

    // Browser vision: GPT + Gemini.
    try {
      const puterPath = await puterUpload(file);
      const prompt = buildReportVisionPrompt(kind);
      const [g, m] = await Promise.allSettled([
        aiAnalyzeFile(puterPath, prompt, { model: MODELS.visionGpt }),
        aiAnalyzeFile(puterPath, prompt, { model: MODELS.visionGemini }),
      ]);
      const f = mergeFindings(
        g.status === "fulfilled" ? parseReportFindings(g.value) : null,
        m.status === "fulfilled" ? parseReportFindings(m.value) : null,
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
          const adaptive = await aiChat(buildAdaptiveQuestionMessages(f, lang), { model: MODELS.fast, temperature: 0.4, maxTokens: 80 });
          if (adaptive.trim()) setTurns((p) => [...p, { role: "assistant", content: adaptive.trim() }]);
        } catch { /* ignore */ }
      } else {
        setTurns((p) => [...p, { role: "assistant", content: lang === "english" ? "Saved for the doctor. I couldn't read it clearly — the doctor will review the original." : "Doctor ke liye save ho gaya. Main ise saaf padh nahi paaya — doctor original dekh lenge." }]);
      }
    } catch (e) {
      const msg = e instanceof PuterUnavailableError
        ? (lang === "english" ? "Saved for the doctor. AI reading is unavailable right now." : "Doctor ke liye save ho gaya. AI reading abhi uplabdh nahi hai.")
        : (lang === "english" ? "Saved for the doctor." : "Doctor ke liye save ho gaya.");
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
    if (!t || busy || analyzing || phase !== "chat") return;
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
