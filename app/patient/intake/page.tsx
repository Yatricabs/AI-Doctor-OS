"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send, Stethoscope } from "lucide-react";
import { aiChat, aiChatStream, PuterUnavailableError } from "@/lib/puterAI";
import {
  buildIntakeMessages,
  buildIntakeSummaryMessages,
  parseIntakeTurn,
  type IntakeLanguage,
} from "@/lib/medicalPrompts";

type Turn = { role: "user" | "assistant"; content: string };
type Phase = "start" | "chat" | "done";

const DEMO_PATIENT_ID = "RM-102";

export default function IntakePage() {
  const [phase, setPhase] = useState<Phase>("start");
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID);
  const [language, setLanguage] = useState<IntakeLanguage>("hinglish");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(""); // in-progress assistant text
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<{ token: string; eta: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  // Persist one turn to the intake API (best-effort; failure never blocks the chat).
  const persistTurn = useCallback(
    async (sid: string, role: string, content: string) => {
      try {
        await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "log_turn",
            sessionId: sid,
            questionKey: `${role}-${Date.now()}`,
            responseValue: `${role}: ${content}`,
          }),
        });
      } catch {
        /* non-blocking */
      }
    },
    []
  );

  // Ask the AI for its next message, given the running transcript.
  const runAssistant = useCallback(
    async (history: Turn[], sid: string | null) => {
      setBusy(true);
      setError("");
      setStreaming("");
      const messages = buildIntakeMessages(history, language, { name: patientId });
      let full = "";
      try {
        full = await aiChatStream(messages, (_d, f) => {
          // Show streaming text without the trailing control tag.
          setStreaming(parseIntakeTurn(f).text);
        });
      } catch (e) {
        setStreaming("");
        if (e instanceof PuterUnavailableError) {
          setError("AI service is unavailable right now. Please try again, or proceed to the reception.");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
        setBusy(false);
        return;
      }

      const { text, state } = parseIntakeTurn(full);
      const next: Turn = { role: "assistant", content: text };
      setTurns((prev) => [...prev, next]);
      setStreaming("");
      if (sid) void persistTurn(sid, "assistant", text);

      if (state === "urgent") setUrgent(true);
      if (state === "complete") {
        await finish([...history, next], sid);
      }
      setBusy(false);
    },
    [language, patientId, persistTurn]
  );

  // Begin the interview: create a session, then get the first question.
  async function start() {
    if (!patientId.trim()) {
      setError("Patient ID is required.");
      return;
    }
    setBusy(true);
    setError("");
    let sid: string | null = null;
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", patientId, visitType: "new_complaint" }),
      });
      const payload = (await res.json()) as { ok: boolean; data?: { session?: { id: string } } };
      if (payload.ok && payload.data?.session?.id) sid = payload.data.session.id;
    } catch {
      /* session is optional; chat still works without persistence */
    }
    setSessionId(sid);
    setPhase("chat");
    await runAssistant([], sid);
  }

  // Patient sends an answer.
  async function send() {
    const value = input.trim();
    if (!value || busy) return;
    const userTurn: Turn = { role: "user", content: value };
    const history = [...turns, userTurn];
    setTurns(history);
    setInput("");
    if (sessionId) void persistTurn(sessionId, "patient", value);
    await runAssistant(history, sessionId);
  }

  // Generate the pre-visit brief and move to the handoff screen.
  async function finish(history: Turn[], sid: string | null) {
    try {
      const raw = await aiChat(buildIntakeSummaryMessages(history), { temperature: 0.2 });
      if (sid) {
        await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "log_turn",
            sessionId: sid,
            questionKey: "pre_visit_brief",
            responseValue: raw,
          }),
        });
      }
    } catch {
      /* brief generation is best-effort */
    }
    // Simple demo ETA/token.
    const token = Math.floor(5 + Math.random() * 20);
    const eta = new Date(Date.now() + token * 4 * 60000).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setHandoff({ token: `#${token}`, eta });
    setPhase("done");
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
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
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Emergency banner */}
        {urgent && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-700">This may be an emergency</p>
              <p className="mt-1 text-xs text-red-600">
                Please go to the nearest emergency room or call for help immediately. Do not wait for the intake to finish.
              </p>
            </div>
          </div>
        )}

        {/* Start screen */}
        {phase === "start" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h1 className="text-xl font-bold text-[#173f3c]">Pre-visit intake</h1>
            <p className="mt-2 text-sm text-[#5a7a6e] leading-6">
              A short chat with our assistant so the doctor already knows your story before you sit down. It asks one
              question at a time and never diagnoses — the doctor decides everything.
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
            <button
              onClick={() => void start()}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Starting…" : "Start intake"}
            </button>
            <p className="mt-3 text-center text-xs text-[#78908a]">Takes about 3–5 minutes · Completely private</p>
          </div>
        )}

        {/* Chat */}
        {phase === "chat" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white">
            <div ref={scrollRef} className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${t.role === "user"
                      ? "rounded-br-sm bg-[#07947f] text-white"
                      : "rounded-bl-sm bg-[#f1f7f2] text-[#2f4a43]"
                      }`}
                  >
                    {t.content}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#f1f7f2] px-3.5 py-2.5 text-sm leading-6 text-[#2f4a43]">
                    {streaming}
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#7f9b90] align-middle" />
                  </div>
                </div>
              )}
              {busy && !streaming && (
                <div className="flex items-center gap-2 text-xs text-[#78908a]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Assistant is typing…
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-[#eef4f1] p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={busy}
                placeholder="Type your answer…"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f] disabled:bg-[#f7faf8]"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="rounded-lg bg-[#07947f] p-2.5 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Done / handoff */}
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
              <Link href="/patient/portal" className="block w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">
                Go to patient portal
              </Link>
              <Link href="/patient/book" className="block w-full rounded-xl border border-[#c2ddd5] py-3 text-sm font-semibold text-[#317b67]">
                Book another appointment
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
