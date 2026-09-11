"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, RefreshCw, Shield, Sparkles } from "lucide-react";

type AttentionSignal = { type: string; title: string; detail: string; severity: string };

type Brief = {
  id: string;
  patientId: string;
  visitReason?: string;
  patientType?: string;
  historySummary?: string;
  medicationSummary?: string;
  whatChanged?: string;
  missingInfo: string[];
  attentionSignals: AttentionSignal[];
  patientQuestions: string[];
  aiConsiderations: string[];
  queueStatus?: string;
  confidence: string;
  reviewStatus: string;
  createdAt: string;
  disclaimer?: string;
};

type Context = {
  patient: Record<string, unknown>;
  medications: { name: string; dose?: string; frequency?: string }[];
  allergies: { allergen: string; severity: string; reaction?: string }[];
  conditions: { name: string }[];
  followUps: { title: string; dueDate: string; priority: string }[];
};

export default function PreVisitBrief({ patientId }: { patientId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/pre-visit?patientId=${patientId}`);
      const payload = await res.json() as { ok: boolean; data: { brief: Brief; context: Context }; error?: { message: string } };
      if (payload.ok) { setBrief(payload.data.brief); setContext(payload.data.context); }
      else setError(payload.error?.message ?? "Could not load brief.");
    } catch { setError("Network error loading pre-visit brief."); }
    finally { setLoading(false); }
  }

  async function markReviewed() {
    if (!brief) return;
    setReviewing(true);
    try {
      await fetch("/api/pre-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", briefId: brief.id, reviewStatus: "reviewed" }),
      });
      setBrief({ ...brief, reviewStatus: "reviewed" });
    } catch { /* silent */ }
    finally { setReviewing(false); }
  }

  useEffect(() => { if (patientId) void load(); }, [patientId]);

  if (loading) return (
    <div className="flex items-center gap-2 rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">
      <Loader2 className="h-4 w-4 animate-spin" /> Generating pre-visit brief…
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
      {error} <button onClick={load} className="underline ml-2">Retry</button>
    </div>
  );

  if (!brief) return null;

  const hasSevereAlerts = brief.attentionSignals.some((s) => s.severity === "high");

  return (
    <div className={`rounded-2xl border ${hasSevereAlerts ? "border-amber-300" : "border-[#c2ddd5]"} bg-white overflow-hidden`}>
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#f7faf8] transition">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf7f2]"><Brain className="h-4 w-4 text-[#07947f]" /></div>
          <div className="text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">AI Pre-visit Brief</p>
            <p className="text-sm font-semibold text-[#244642]">{brief.visitReason ?? "Visit brief"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSevereAlerts && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${brief.reviewStatus === "reviewed" ? "bg-[#edf7f2] text-[#4e927d]" : "bg-amber-100 text-amber-600"}`}>
            {brief.reviewStatus === "reviewed" ? "Reviewed" : "AI Generated"}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-[#78908a]" /> : <ChevronDown className="h-4 w-4 text-[#78908a]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#f0f4f2]">
          {/* Attention Signals — always show first */}
          {brief.attentionSignals.length > 0 && (
            <div className="pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-400 mb-2">⚠ Attention signals</p>
              <div className="space-y-2">
                {brief.attentionSignals.map((signal, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 ${signal.severity === "high" ? "border-red-200 bg-red-50" : signal.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-[#e1e9e5] bg-white"}`}>
                    <p className={`text-xs font-bold ${signal.severity === "high" ? "text-red-600" : signal.severity === "medium" ? "text-amber-600" : "text-[#5a7a6e]"}`}>{signal.title}</p>
                    <p className="text-xs text-[#78908a] mt-0.5">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            {/* History */}
            {brief.historySummary && (
              <div className="rounded-lg bg-[#f7faf8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e] mb-1">History</p>
                <p className="text-xs text-[#5f7c70] leading-5">{brief.historySummary}</p>
              </div>
            )}

            {/* Medications */}
            {brief.medicationSummary && (
              <div className="rounded-lg bg-[#f7faf8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e] mb-1">Current medications</p>
                <p className="text-xs text-[#5f7c70] leading-5">{brief.medicationSummary}</p>
              </div>
            )}
          </div>

          {/* What Changed */}
          {brief.whatChanged && (
            <div className="rounded-lg border border-[#c2ddd5] bg-[#edf7f2] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e] mb-1 flex items-center gap-1"><Info className="h-3 w-3" /> What changed</p>
              <p className="text-xs text-[#317b67] leading-5">{brief.whatChanged}</p>
            </div>
          )}

          {/* AI Considerations */}
          {brief.aiConsiderations.length > 0 && (
            <div className="rounded-lg border border-[#d8d0e8] bg-[#f4eef7] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a5a8a] mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI clinical considerations</p>
              <ul className="space-y-1">
                {brief.aiConsiderations.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[#5a4570] leading-5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9773a4]" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-[#9773a4]">AI-generated · REVIEW REQUIRED · Not a clinical diagnosis</p>
            </div>
          )}

          {/* Missing Info */}
          {brief.missingInfo.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">Missing information</p>
              {brief.missingInfo.map((m, i) => (
                <p key={i} className="text-xs text-amber-700 mt-0.5">· {m}</p>
              ))}
            </div>
          )}

          {/* Patient Questions */}
          {brief.patientQuestions.length > 0 && (
            <div className="rounded-lg bg-[#f7faf8] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e] mb-1">Patient questions / notes</p>
              {brief.patientQuestions.map((q, i) => (
                <p key={i} className="text-xs text-[#5f7c70] mt-0.5">· &ldquo;{q}&rdquo;</p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-[#8a9e98]">Source: patient record · medications · allergies · conditions · AI_GENERATED</p>
            <div className="flex items-center gap-2">
              <button onClick={() => void load()} className="flex items-center gap-1 text-xs text-[#5a967e] hover:underline">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
              {brief.reviewStatus !== "reviewed" && (
                <button onClick={() => void markReviewed()} disabled={reviewing} className="flex items-center gap-1.5 rounded-lg bg-[#07947f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  <CheckCircle2 className="h-3 w-3" /> Mark reviewed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
