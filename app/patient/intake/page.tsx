"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, MessageSquare, Mic, SkipForward, Stethoscope } from "lucide-react";

type IntakeSession = { id: string; visitType: string; status: string; currentStep: number; totalSteps: number };
type Question = { key: string; text: string; type: string; required: boolean };

const DEMO_PATIENT_ID = "RM-102";

export default function IntakePage() {
  const [phase, setPhase] = useState<"start" | "intake" | "done">("start");
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID);
  const [visitType, setVisitType] = useState("new_complaint");
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answer, setAnswer] = useState("");
  const [severity, setSeverity] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startIntake() {
    if (!patientId.trim()) { setError("Patient ID is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", patientId, visitType }),
      });
      const payload = await res.json() as { ok: boolean; data: { session: IntakeSession; firstQuestion: Question; totalQuestions: number }; error?: { message: string } };
      if (payload.ok) {
        setSession(payload.data.session);
        setQuestion(payload.data.firstQuestion);
        setTotalQuestions(payload.data.totalQuestions);
        setPhase("intake");
      } else setError(payload.error?.message ?? "Could not start intake.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  async function submitAnswer(skip = false) {
    if (!session || !question) return;
    if (!skip && !answer.trim() && question.type !== "scale") { setError("Please provide an answer."); return; }
    setLoading(true); setError("");

    const responseValue = skip ? "__skipped__" : question.type === "scale" ? severity : answer;
    const action = skip ? "skip" : "answer";

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: session.id, questionKey: question.key, responseValue }),
      });
      const payload = await res.json() as { ok: boolean; data: { nextQuestion: Question | null; progress: number; isComplete: boolean }; error?: { message: string } };
      if (payload.ok) {
        setProgress(payload.data.progress);
        setAnswer("");
        setSeverity("5");
        if (payload.data.isComplete) {
          setPhase("done");
        } else {
          setQuestion(payload.data.nextQuestion);
        }
      } else setError(payload.error?.message ?? "Could not submit answer.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <span className="text-xs text-[#78908a]">Pre-visit intake</span>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-8">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Start Screen */}
        {phase === "start" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf7f2]"><MessageSquare className="h-6 w-6 text-[#07947f]" /></div>
              <div>
                <h1 className="text-xl font-bold text-[#173f3c]">Pre-visit intake</h1>
                <p className="text-sm text-[#78908a]">A few questions to help your doctor prepare</p>
              </div>
            </div>
            <p className="text-sm text-[#5a7a6e] leading-6">Your answers help the doctor understand your visit before you arrive, saving time and improving your care. All information is confidential.</p>

            <div className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Patient ID</label>
                <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="e.g. RM-102" className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Visit type</label>
                <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]">
                  <option value="new_complaint">New complaint</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="wellness">Wellness check</option>
                  <option value="report_review">Report review</option>
                </select>
              </div>
            </div>

            <button onClick={() => void startIntake()} disabled={loading} className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
              {loading ? "Starting…" : <><MessageSquare className="h-4 w-4" /> Start intake</>}
            </button>
            <p className="mt-3 text-center text-xs text-[#78908a]">Takes about 3–5 minutes · Completely private</p>
          </div>
        )}

        {/* Intake Questions */}
        {phase === "intake" && question && (
          <div>
            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-[#78908a] mb-1.5">
                <span>Question {session ? session.currentStep + 1 : 1} of {totalQuestions}</span>
                <span>{progress}% complete</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#e1e9e5]">
                <div className="h-2 rounded-full bg-[#07947f] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a967e] mb-3">
                {question.required ? "Required" : "Optional"}
              </p>
              <h2 className="text-lg font-semibold text-[#173f3c] leading-snug">{question.text}</h2>

              <div className="mt-5">
                {question.type === "text" && (
                  <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" autoFocus className="w-full h-28 rounded-lg border border-[#dce9e3] p-3 text-sm outline-none focus:border-[#07947f]" />
                )}
                {question.type === "yesno" && (
                  <div className="flex gap-3">
                    {["Yes", "No", "Not sure"].map((opt) => (
                      <button key={opt} onClick={() => setAnswer(opt)} className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition ${answer === opt ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]" : "border-[#e1e9e5] hover:border-[#9ac8b8]"}`}>{opt}</button>
                    ))}
                  </div>
                )}
                {question.type === "scale" && (
                  <div>
                    <div className="flex items-center justify-between mb-2 text-xs text-[#78908a]">
                      <span>1 — No pain</span><span>10 — Worst pain</span>
                    </div>
                    <input type="range" min="1" max="10" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full accent-[#07947f]" />
                    <p className="mt-2 text-center text-2xl font-bold text-[#07947f]">{severity} / 10</p>
                  </div>
                )}
                {question.type === "document_prompt" && (
                  <div className="rounded-xl border border-dashed border-[#c2ddd5] p-6 text-center text-sm text-[#78908a]">
                    <p className="font-semibold text-[#5a7a6e]">Document upload</p>
                    <p className="mt-1 text-xs">Document upload will be available in the full app. For now, you can describe your documents.</p>
                    <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Describe what documents you have (optional)" className="mt-3 w-full h-16 rounded-lg border border-[#dce9e3] p-2 text-xs outline-none" />
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => void submitAnswer(false)} disabled={loading || (!answer && question.type !== "scale")} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-50">
                  {loading ? "Saving…" : <>Next <ArrowRight className="h-4 w-4" /></>}
                </button>
                {!question.required && (
                  <button onClick={() => void submitAnswer(true)} disabled={loading} className="flex items-center gap-1 rounded-xl border border-[#dce9e3] px-4 text-sm font-semibold text-[#78908a] hover:bg-[#f0f6f3] disabled:opacity-50">
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="rounded-2xl border border-[#b9decf] bg-[#f0faf5] p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#07947f]" />
            <h2 className="text-xl font-bold text-[#1f6a4a]">Intake complete!</h2>
            <p className="mt-2 text-sm text-[#317b67]">Thank you. Your doctor will have your information ready before your visit.</p>
            <div className="mt-6 space-y-2">
              <Link href="/patient/portal" className="block w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white text-center">
                Go to patient portal
              </Link>
              <Link href="/patient/book" className="block w-full rounded-xl border border-[#c2ddd5] py-3 text-sm font-semibold text-[#317b67] text-center">
                Book another appointment
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
