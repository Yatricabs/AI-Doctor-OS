"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Paperclip, Send, Stethoscope } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { aiChat, MODELS, puterUpload, PuterUnavailableError } from "@/lib/puterClient";
import {
  buildAdaptiveQuestionMessages,
  buildReportVisionPrompt,
  hasAbnormalFindings,
  mergeFindings,
  parseReportFindings,
  type ReportFindings,
  type ReportKind,
} from "@/lib/clientPrompts";
import { aiAnalyzeFile } from "@/lib/puterClient";

type Turn = { role: "assistant" | "user"; content: string };
type Phase = "start" | "chat" | "done";
type Language = "hinglish" | "english";

type UploadStatus = "uploading" | "analyzing" | "done" | "error";
type UploadedReport = {
  reportId: string;
  fileName: string;
  kind: ReportKind;
  status: UploadStatus;
  findings?: ReportFindings;
  note?: string;
};

const DEMO_PATIENT_ID = "RM-102";
const ACCEPTED = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

type NextResponse = {
  ok: boolean;
  data?: {
    sessionId: string;
    stepId?: string;
    question?: string;
    options?: string[];
    emergency?: boolean;
    done: boolean;
    closing?: string;
  };
  error?: { message: string };
};

function kindFromFile(name: string, mime: string): ReportKind {
  const n = name.toLowerCase();
  if (/prescri|rx|parchi/.test(n)) return "Prescription";
  if (/mri|ct|x-?ray|xray|ultrasound|sono|scan|imaging/.test(n)) return "Imaging";
  if (/refer/.test(n)) return "Referral";
  if (mime === "application/pdf" || /report|lab|blood|test/.test(n)) return "Lab report";
  return "Lab report";
}

export default function IntakePage() {
  const [phase, setPhase] = useState<Phase>("start");
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID);
  const [language, setLanguage] = useState<Language>("hinglish");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<{ token: string; eta: string } | null>(null);

  // Uploaded reports (Task 3/4): shown as chips with live analysis status.
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function callNext(payload: Record<string, unknown>): Promise<NextResponse["data"] | null> {
    const res = await fetch("/api/intake/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as NextResponse;
    if (!json.ok || !json.data) {
      setError(json.error?.message ?? "Something went wrong. Please try again.");
      return null;
    }
    return json.data;
  }

  async function start() {
    if (!patientId.trim()) { setError("Patient ID is required."); return; }
    setBusy(true); setError("");
    const data = await callNext({ action: "start", patientId, language });
    setBusy(false);
    if (!data) return;
    setSessionId(data.sessionId);
    setStepId(data.stepId ?? null);
    setOptions(data.options ?? []);
    setTurns([{ role: "assistant", content: data.question ?? "" }]);
    if (data.emergency) setUrgent(true);
    setPhase("chat");
  }

  async function answer(value: string) {
    const text = value.trim();
    if (!text || busy || !sessionId || !stepId) return;
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setOptions([]);
    setBusy(true);
    setError("");

    const data = await callNext({ action: "answer", sessionId, stepId, answer: text, language });
    setBusy(false);
    if (!data) return;

    if (data.emergency) setUrgent(true);

    if (data.done) {
      setTurns((prev) => [...prev, { role: "assistant", content: data.closing ?? "Thank you." }]);
      const token = Math.floor(5 + Math.random() * 20);
      const eta = new Date(Date.now() + token * 4 * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setHandoff({ token: `#${token}`, eta });
      setTimeout(() => setPhase("done"), 1200);
      return;
    }

    setStepId(data.stepId ?? null);
    setOptions(data.options ?? []);
    setTurns((prev) => [...prev, { role: "assistant", content: data.question ?? "" }]);
  }

  function setReportStatus(reportId: string, patch: Partial<UploadedReport>) {
    setReports((prev) => prev.map((r) => (r.reportId === reportId ? { ...r, ...patch } : r)));
  }

  // Task 3+4+5: upload -> Supabase (durable) + Puter (for vision) -> analyze with
  // GPT + Gemini -> save findings -> inject one adaptive question into the chat.
  async function handleFile(file: File) {
    setError("");
    if (!sessionId) return;
    if (file.size > MAX_BYTES) { setError("File is too large (max 20 MB)."); return; }
    if (!ACCEPTED.split(",").includes(file.type)) { setError("Please upload a PNG, JPG, WEBP or PDF."); return; }

    const kind = kindFromFile(file.name, file.type);
    setReportsExpanded(true);

    // 1) Upload to our private Supabase Storage (durable copy for the doctor).
    const form = new FormData();
    form.append("file", file);
    form.append("patientId", patientId);
    form.append("title", file.name);
    form.append("type", kind === "Imaging" || kind === "Other" ? "Lab report" : kind);

    let reportId = "";
    try {
      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      const jr = (await res.json()) as { ok: boolean; data?: { report?: { id: string } }; error?: { message: string } };
      if (!jr.ok || !jr.data?.report?.id) throw new Error(jr.error?.message ?? "Upload failed.");
      reportId = jr.data.report.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      return;
    }

    const entry: UploadedReport = { reportId, fileName: file.name, kind, status: "uploading" };
    setReports((prev) => [...prev, entry]);

    // Acknowledge the upload in the chat so the flow feels conversational.
    setTurns((prev) => [
      ...prev,
      { role: "user", content: `📎 ${file.name}` },
      {
        role: "assistant",
        content:
          language === "english"
            ? "Got your report — reading it now so the doctor sees the key points."
            : "Report mil gayi — main ise padh raha hoon taaki doctor ko mukhya baatein mil jaayein.",
      },
    ]);

    // 2) Vision analysis in the browser (free). Upload the same file to Puter fs
    //    (vision models read from a puter_path), then read with GPT + Gemini.
    setReportStatus(reportId, { status: "analyzing" });
    try {
      const puterPath = await puterUpload(file);
      const prompt = buildReportVisionPrompt(kind);

      // Run both models; tolerate one failing.
      const [gptRaw, gemRaw] = await Promise.allSettled([
        aiAnalyzeFile(puterPath, prompt, { model: MODELS.visionGpt }),
        aiAnalyzeFile(puterPath, prompt, { model: MODELS.visionGemini }),
      ]);
      const gpt = gptRaw.status === "fulfilled" ? parseReportFindings(gptRaw.value) : null;
      const gem = gemRaw.status === "fulfilled" ? parseReportFindings(gemRaw.value) : null;
      const findings = mergeFindings(gpt, gem);

      if (!findings) throw new Error("Could not read the report clearly.");

      // 3) Persist findings against the report (doctor summary uses these).
      await fetch("/api/reports/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, findings: JSON.stringify(findings) }),
      }).catch(() => { });

      setReportStatus(reportId, { status: "done", findings });

      // Log a transcript turn so the pre-visit brief includes the report.
      const summaryLine = [
        `Report (${findings.documentType || kind}): ${findings.overallImpression}`,
        findings.abnormal.length ? `Abnormal: ${findings.abnormal.join("; ")}` : "",
        findings.medications.length ? `Meds: ${findings.medications.join("; ")}` : "",
      ].filter(Boolean).join(" | ");
      await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_turn", sessionId, questionKey: `report_${reportId}`, responseValue: summaryLine }),
      }).catch(() => { });

      // 4) Adaptive follow-up question based on abnormal/normal findings.
      let adaptive = "";
      try {
        adaptive = await aiChat(buildAdaptiveQuestionMessages(findings, language), { model: MODELS.fast, temperature: 0.4, maxTokens: 80 });
      } catch {
        adaptive =
          hasAbnormalFindings(findings)
            ? language === "english"
              ? "I see some values need attention. Are you feeling any discomfort related to this right now?"
              : "Report me kuch cheezein dhyaan dene layak hain. Kya isse judi koi takleef abhi ho rahi hai?"
            : language === "english"
              ? "Good — this looks broadly normal. Are you feeling better than before?"
              : "Achha — yeh kaafi had tak normal lag raha hai. Kya pehle se behtar mehsoos kar rahe hain?";
      }
      if (adaptive.trim()) {
        setTurns((prev) => [...prev, { role: "assistant", content: adaptive.trim() }]);
      }
    } catch (e) {
      const msg =
        e instanceof PuterUnavailableError
          ? "The report was saved for the doctor, but AI reading is unavailable in this browser right now."
          : e instanceof Error
            ? e.message
            : "Could not analyze the report.";
      setReportStatus(reportId, { status: "error", note: msg });
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            language === "english"
              ? "Your report is saved for the doctor. We couldn't read it automatically, but the doctor will review the original."
              : "Aapki report doctor ke liye save ho gayi hai. Hum ise apne aap nahi padh paaye, par doctor original dekh lenge.",
        },
      ]);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (f) void handleFile(f);
  }

  const analyzing = reports.some((r) => r.status === "uploading" || r.status === "analyzing");

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-11 rounded-lg bg-[#071a32]" alt="" />
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLanguage((l) => (l === "hinglish" ? "english" : "hinglish"))}
              disabled={phase !== "start"}
              className="rounded-lg border border-[#e4ebe7] px-2.5 py-1.5 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3] disabled:opacity-50"
            >
              {language === "hinglish" ? "हिन्दी / Hinglish" : "English"}
            </button>
            <span className="text-xs text-[#78908a]">Pre-visit intake</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-8">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {urgent && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-700">This may be an emergency</p>
              <p className="mt-1 text-xs text-red-600">Please go to the nearest emergency room or call for help immediately.</p>
            </div>
          </div>
        )}

        {/* Start */}
        {phase === "start" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h1 className="text-xl font-bold text-[#173f3c]">Pre-visit intake</h1>
            <p className="mt-2 text-sm text-[#5a7a6e] leading-6">
              A short chat so the doctor already knows your story before you sit down. It asks one question at a time
              and never diagnoses — the doctor decides everything. You can also upload reports or prescriptions along the way.
            </p>
            <div className="mt-6">
              <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Patient ID</label>
              <input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. RM-102"
                className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]"
              />
            </div>
            <button onClick={() => void start()} disabled={busy} className="mt-5 w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Starting…" : "Start intake"}
            </button>
            <p className="mt-3 text-center text-xs text-[#78908a]">Takes about 3–5 minutes · Completely private</p>
          </div>
        )}

        {/* Chat */}
        {phase === "chat" && (
          <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-[#e1e9e5] bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#eef4f1] bg-[#f7fbf9] px-4 py-3">
              <BrandLogo className="h-9 w-12 rounded-full bg-[#071a32]" alt="AI UPCHAR assistant" />
              <div>
                <p className="text-sm font-bold text-[#1f3a37]">AI Upchar Assistant</p>
                <p className="flex items-center gap-1.5 text-[11px] text-[#5a967e]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Pre-visit conversation</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[#fbfdfc] px-4 py-5">
              {turns.map((t, i) =>
                t.role === "assistant" ? (
                  <div key={i} className="flex items-end gap-2">
                    <BrandLogo className="mb-1 h-7 w-9 shrink-0 rounded-full bg-[#071a32]" alt="AI UPCHAR assistant" />
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#e4efe9] bg-white px-4 py-2.5 text-sm leading-6 text-[#2f4a43] shadow-sm">{t.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#07947f] px-4 py-2.5 text-sm leading-6 text-white shadow-sm">{t.content}</div>
                  </div>
                )
              )}

              {(busy || analyzing) && (
                <div className="flex items-end gap-2">
                  <BrandLogo className="mb-1 h-7 w-9 shrink-0 rounded-full bg-[#071a32]" alt="AI UPCHAR assistant" />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#e4efe9] bg-white px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa] [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa] [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db3aa]" />
                  </div>
                </div>
              )}
            </div>

            {/* Uploaded-report chips */}
            {reports.length > 0 && (
              <div className="border-t border-[#eef4f1] bg-white px-3 pt-2.5">
                <div className="flex flex-wrap gap-2">
                  {reports.map((r) => (
                    <span
                      key={r.reportId}
                      title={r.note ?? r.findings?.overallImpression ?? r.fileName}
                      className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${r.status === "error"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : r.status === "done"
                            ? hasAbnormalFindings(r.findings ?? null)
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-[#c2ddd5] bg-[#f1f7f2] text-[#317b67]"
                            : "border-[#c2ddd5] bg-[#f1f7f2] text-[#317b67]"
                        }`}
                    >
                      {r.status === "uploading" || r.status === "analyzing" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      <span className="truncate">{r.fileName}</span>
                      <span className="opacity-70">
                        · {r.status === "uploading" ? "saving" : r.status === "analyzing" ? "reading" : r.status === "error" ? "saved" : hasAbnormalFindings(r.findings ?? null) ? "needs review" : "read"}
                      </span>
                    </span>
                  ))}
                </div>
                {reportsExpanded && reports.some((r) => r.status === "done") && (
                  <button onClick={() => setReportsExpanded((v) => !v)} className="mt-1 text-[10px] text-[#78908a] underline">
                    hide details
                  </button>
                )}
              </div>
            )}

            {/* Quick-reply chips for steps that offer options */}
            {options.length > 0 && !busy && (
              <div className="flex flex-wrap gap-2 border-t border-[#eef4f1] bg-white px-3 pt-3">
                {options.map((opt) => (
                  <button key={opt} onClick={() => void answer(opt)} className="rounded-full border border-[#c2ddd5] bg-[#f1f7f2] px-3 py-1.5 text-xs font-semibold text-[#317b67] hover:bg-[#e3f0ea]">
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-[#eef4f1] bg-white p-3">
              <input ref={fileRef} type="file" accept={ACCEPTED} onChange={onPick} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy || analyzing}
                aria-label="Upload a report or prescription"
                title="Upload a report or prescription (PDF/JPG/PNG)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce9e3] text-[#07947f] transition hover:bg-[#f0f6f3] disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && answer(input)}
                disabled={busy}
                placeholder="Type your reply…"
                autoFocus
                className="min-w-0 flex-1 rounded-full border border-[#dce9e3] px-4 py-2.5 text-sm outline-none focus:border-[#07947f] disabled:bg-[#f7faf8]"
              />
              <button onClick={() => void answer(input)} disabled={busy || !input.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#07947f] text-white transition hover:bg-[#066d66] disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="rounded-2xl border border-[#b9decf] bg-[#f0faf5] p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#07947f]" />
            <h2 className="text-xl font-bold text-[#1f6a4a]">Intake complete!</h2>
            <p className="mt-2 text-sm text-[#317b67]">
              Thank you. Your history has been sent to the doctor&apos;s screen so your treatment can start quickly.
              Please keep any old prescriptions or reports ready to hand at the reception.
            </p>
            {handoff && (
              <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#c2ddd5] bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Appointment no.</p>
                  <p className="mt-1 text-lg font-bold text-[#1f6a4a]">{handoff.token}</p>
                </div>
                <div className="rounded-xl border border-[#c2ddd5] bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Approx. time</p>
                  <p className="mt-1 text-lg font-bold text-[#1f6a4a]">{handoff.eta}</p>
                </div>
              </div>
            )}
            <div className="mt-6 space-y-2">
              <Link href="/patient/portal" className="block w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">Go to patient portal</Link>
              <Link href="/patient/book" className="block w-full rounded-xl border border-[#c2ddd5] py-3 text-sm font-semibold text-[#317b67]">Book another appointment</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
