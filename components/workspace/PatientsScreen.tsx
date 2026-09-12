"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowLeft, FileText, HeartPulse, Loader2, Pill, Receipt, Search, Sparkles, User } from "lucide-react";
import { apiGet } from "./api";
import { formatINR, humanize } from "@/lib/format";

type Patient = { id: string; name: string; initials?: string; status?: string; phone?: string; gender?: string; dateOfBirth?: string; patientType?: string; appointment?: string };

export default function PatientsScreen({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPatients((await apiGet<{ patients: Patient[] }>("/api/patients")).patients); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load patients."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (selectedId) return <PatientDetail patientId={selectedId} onBack={() => onSelect(null)} />;

  const visible = patients.filter((p) => !q || `${p.name} ${p.id}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Patients</h1>
      <p className="mt-1 text-sm text-[#78908a]">All patients. Open a patient for their full history and record.</p>

      <div className="relative mt-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8da09b]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="w-full rounded-xl border border-[#dce9e3] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#07947f]" />
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading patients…</div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center gap-3 rounded-2xl border border-[#e1e9e5] bg-white p-4 text-left hover:border-[#c2ddd5] hover:bg-[#f7faf8]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d5eee4] text-sm font-bold text-[#277a6b]">{p.initials ?? p.name.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#24443f]">{p.name}</p>
                <p className="text-[11px] text-[#8a9e98]">{p.id}{p.patientType ? ` · ${humanize(p.patientType)}` : ""}</p>
              </div>
            </button>
          ))}
          {visible.length === 0 && <p className="col-span-full rounded-xl border border-[#e1e9e5] bg-white px-4 py-10 text-center text-sm text-[#8a9e98]">No patients found.</p>}
        </div>
      )}
    </div>
  );
}

// ── Individual patient page ──────────────────────────────────────────────────
type Context = {
  patient: Patient;
  medications: { id: string; name: string; dose?: string; frequency?: string }[];
  allergies: { id: string; allergen: string; severity: string; reaction?: string }[];
  conditions: { id: string; name: string; status?: string }[];
  reports: { id: string; title: string; type: string; date: string; aiFindings?: string }[];
  followUps: { id: string; title: string; dueDate: string; priority: string }[];
};
type Summary = {
  intake: { preVisitBrief: string; story: { question: string; answer: string }[] };
  aiReport?: { summary: string; research: string; considerations: string[]; redFlags: string[] };
  reports: { id: string; title: string; findings: { overallImpression: string; abnormal: string[] } | null }[];
  abnormalHighlights: string[];
};
type Bill = { id: string; total: number; createdAt: string; items: { description: string; amount: number; itemType: string }[] };

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billTotal, setBillTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const [c, s, b] = await Promise.all([
          apiGet<Context>(`/api/patients/context?patientId=${patientId}`),
          apiGet<Summary>(`/api/pre-visit/summary?patientId=${patientId}`).catch(() => null),
          apiGet<{ bills: Bill[]; total: number }>(`/api/billing?patientId=${patientId}`).catch(() => ({ bills: [], total: 0 })),
        ]);
        if (cancelled) return;
        setCtx(c); setSummary(s); setBills(b.bills); setBillTotal(b.total);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load patient."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) return <div className="mx-auto max-w-[1000px] px-6 py-10"><div className="flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading patient…</div></div>;
  if (error || !ctx) return <div className="mx-auto max-w-[1000px] px-6 py-10"><button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-[#5a967e]"><ArrowLeft className="h-4 w-4" /> Back</button><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error || "Patient not found."}</div></div>;

  const p = ctx.patient;
  const nextVisit = ctx.followUps[0];

  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#5a967e] hover:underline"><ArrowLeft className="h-4 w-4" /> All patients</button>

      {/* Header */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#e1e9e5] bg-white p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d5eee4] text-lg font-bold text-[#277a6b]">{p.initials ?? p.name.slice(0, 2).toUpperCase()}</span>
        <div>
          <h1 className="text-xl font-bold text-[#173f3c]">{p.name}</h1>
          <p className="text-sm text-[#78908a]">{p.id}{p.gender ? ` · ${p.gender}` : ""}{p.phone ? ` · ${p.phone}` : ""}{p.patientType ? ` · ${humanize(p.patientType)}` : ""}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#5a967e]">Total billed</p>
          <p className="text-lg font-bold text-[#173f3c]">{formatINR(billTotal)}</p>
        </div>
      </div>

      {/* AI pre-visit report (from the patient's conversational intake) */}
      {(summary?.aiReport?.summary || summary?.intake.preVisitBrief) && (
        <Card icon={Sparkles} title="AI pre-visit report" tone="purple">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#5a4570]">{summary?.aiReport?.summary || summary?.intake.preVisitBrief}</p>
          {summary?.aiReport && summary.aiReport.redFlags.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">Red flags</p>
              <ul className="mt-1 space-y-0.5">
                {summary.aiReport.redFlags.map((f, i) => <li key={i} className="text-xs text-red-600">· {f}</li>)}
              </ul>
            </div>
          )}
          {summary?.aiReport && summary.aiReport.considerations.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a5a8a]">Considerations (review required)</p>
              <ul className="mt-1 space-y-0.5">
                {summary.aiReport.considerations.map((c, i) => <li key={i} className="text-xs text-[#5a4570]">· {c}</li>)}
              </ul>
            </div>
          )}
          {summary?.abnormalHighlights && summary.abnormalHighlights.length > 0 && (
            <p className="mt-2 text-xs text-red-600">Report flags: {summary.abnormalHighlights.join("; ")}</p>
          )}
          <p className="mt-2 text-[10px] text-[#9773a4]">AI-generated · review required · not a diagnosis</p>
        </Card>
      )}

      {/* Internet research (with citations) */}
      {summary?.aiReport?.research && (
        <Card icon={Sparkles} title="AI internet research">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#41627a]">{summary.aiReport.research}</p>
          <p className="mt-2 text-[10px] text-[#9db3aa]">Sourced from the web via AI · verify all sources · not a diagnosis</p>
        </Card>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Conditions / history */}
        <Card icon={Activity} title="Conditions & history">
          {ctx.conditions.length ? ctx.conditions.map((c) => (
            <Row key={c.id} main={c.name} sub={humanize(c.status)} />
          )) : <Empty>No active conditions on record.</Empty>}
        </Card>

        {/* Current treatment (medications) */}
        <Card icon={Pill} title="Current treatment">
          {ctx.medications.length ? ctx.medications.map((m) => (
            <Row key={m.id} main={m.name} sub={[m.dose, m.frequency].filter(Boolean).join(" · ")} />
          )) : <Empty>No active medications.</Empty>}
        </Card>

        {/* Allergies */}
        <Card icon={HeartPulse} title="Allergies">
          {ctx.allergies.length ? ctx.allergies.map((a) => (
            <Row key={a.id} main={a.allergen} sub={`${humanize(a.severity)}${a.reaction ? ` · ${a.reaction}` : ""}`} danger={a.severity === "severe"} />
          )) : <Empty>No known allergies.</Empty>}
        </Card>

        {/* Next visit advised */}
        <Card icon={Activity} title="Next visit advised">
          {nextVisit ? (
            <>
              <Row main={nextVisit.title} sub={`Due ${nextVisit.dueDate} · ${humanize(nextVisit.priority)}`} />
              {ctx.followUps.slice(1).map((f) => <Row key={f.id} main={f.title} sub={`Due ${f.dueDate}`} />)}
            </>
          ) : <Empty>No follow-up scheduled.</Empty>}
        </Card>
      </div>

      {/* Reports + AI findings */}
      <Card icon={FileText} title="Reports">
        {ctx.reports.length ? ctx.reports.map((r) => {
          const finding = summary?.reports.find((x) => x.id === r.id)?.findings ?? null;
          return (
            <div key={r.id} className="border-b border-[#f2f6f4] py-2 last:border-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#24443f]">{r.title}</p>
                <span className="text-[11px] text-[#8a9e98]">{r.type} · {r.date}</span>
              </div>
              {finding?.overallImpression && <p className="mt-1 text-xs text-[#5f7c70]">{finding.overallImpression}</p>}
              {finding && finding.abnormal.length > 0 && <p className="mt-0.5 text-xs text-red-600">Abnormal: {finding.abnormal.join("; ")}</p>}
            </div>
          );
        }) : <Empty>No reports uploaded.</Empty>}
      </Card>

      {/* Bills */}
      <Card icon={Receipt} title="Billing history">
        {bills.length ? bills.map((b) => (
          <div key={b.id} className="border-b border-[#f2f6f4] py-2 last:border-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#8a9e98]">{b.createdAt?.slice(0, 10)}</p>
              <p className="text-sm font-bold text-[#24443f]">{formatINR(b.total)}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-[#5f7c70]">{b.items.map((i) => i.description).join(", ")}</p>
          </div>
        )) : <Empty>No bills yet.</Empty>}
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, children, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; tone?: "purple" }) {
  return (
    <div className={`mt-3 rounded-2xl border p-4 ${tone === "purple" ? "border-[#d8d0e8] bg-[#f4eef7]" : "border-[#e1e9e5] bg-white"}`}>
      <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${tone === "purple" ? "text-[#7a5a8a]" : "text-[#5a967e]"}`}><Icon className="h-3.5 w-3.5" /> {title}</p>
      {children}
    </div>
  );
}
function Row({ main, sub, danger }: { main: string; sub?: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f2f6f4] py-1.5 last:border-0">
      <span className={`text-sm font-semibold ${danger ? "text-red-600" : "text-[#24443f]"}`}>{main}</span>
      {sub && <span className="text-[11px] text-[#8a9e98]">{sub}</span>}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-xs text-[#9db3aa]">{children}</p>;
}
