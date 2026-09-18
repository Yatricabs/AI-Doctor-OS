"use client";

import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useGetPatient360Query, useGetPatientsQuery } from "@/lib/apiSlice";
import { inr, tone, visitTypeTone } from "./shared";

export default function PatientsView({ openPatientId, onOpenPatient }: { openPatientId: string | null; onOpenPatient: (patientId: string | null) => void }) {
  if (openPatientId) return <PatientDetail patientId={openPatientId} onBack={() => onOpenPatient(null)} />;
  return <PatientList onOpenPatient={onOpenPatient} />;
}

function PatientList({ onOpenPatient }: { onOpenPatient: (patientId: string) => void }) {
  const { data, isLoading } = useGetPatientsQuery();
  const patients = data?.patients ?? [];
  const [query, setQuery] = useState("");

  const filtered = patients.filter((p) => `${p.name} ${p.id} ${p.phone ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: tone.border, background: tone.card }}>
        <Search className="h-4 w-4" style={{ color: tone.muted }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, or phone" className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      {isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading patients…</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((patient) => <button key={patient.id} onClick={() => onOpenPatient(patient.id)} className="rounded-2xl border p-4 text-left transition hover:shadow-sm" style={{ borderColor: tone.border, background: tone.card }}>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: tone.successBg, color: tone.success }}>{patient.initials}</span><div><p className="text-sm font-bold" style={{ color: tone.ink }}>{patient.name}</p><p className="text-xs" style={{ color: tone.muted }}>{patient.id} · {patient.age ? `${patient.age} yrs, ` : ""}{patient.sex}</p></div></div>
          <p className="mt-3 text-xs" style={{ color: tone.inkSoft }}>{patient.appointment}</p>
          {patient.location && <p className="mt-1 text-xs" style={{ color: tone.muted }}>{patient.location}</p>}
        </button>)}
      </div>}
    </div>
  );
}

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data, isLoading } = useGetPatient360Query(patientId);
  const [tab, setTab] = useState<"overview" | "appointments" | "reports" | "prescriptions" | "billing">("overview");

  if (isLoading) return <p className="text-sm" style={{ color: tone.muted }}>Loading patient record…</p>;
  if (!data) return <p className="text-sm" style={{ color: tone.danger }}>Could not load this patient.</p>;

  const { patient, appointments, reports, prescriptions, billing, aiSummary, nextFollowUp } = data;
  const tabs: { key: typeof tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "appointments", label: `Appointments (${appointments.length})` },
    { key: "reports", label: `Reports (${reports.length})` },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})` },
    { key: "billing", label: `Billing (${inr(billing.total)})` },
  ];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold hover:underline" style={{ color: tone.primary }}><ArrowLeft className="h-3.5 w-3.5" /> Back to patients</button>

      <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold" style={{ background: tone.successBg, color: tone.success }}>{patient.initials}</span><div><h2 className="text-lg font-bold" style={{ color: tone.ink }}>{patient.name}</h2><p className="text-xs" style={{ color: tone.muted }}>{patient.id} · {patient.age ? `${patient.age} yrs, ` : ""}{patient.sex} · {patient.location}</p><p className="text-xs" style={{ color: tone.muted }}>{patient.phone}</p></div></div>
          {nextFollowUp && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: tone.accentGoldBg, color: tone.accentGold }}>Next follow-up: {nextFollowUp.date} · {nextFollowUp.time}</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className="rounded-full border px-4 py-2 text-xs font-bold" style={tab === t.key ? { borderColor: tone.primary, background: tone.primary, color: "#fff" } : { borderColor: tone.border, color: tone.inkSoft }}>{t.label}</button>)}
      </div>

      {tab === "overview" && <div className="space-y-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
          <h3 className="text-sm font-bold" style={{ color: tone.ink }}>✦ AI Summary — last visit</h3>
          {aiSummary ? <div className="mt-3 space-y-2 text-sm" style={{ color: tone.inkSoft }}>
            <p><span className="font-bold" style={{ color: tone.ink }}>Problem: </span>{aiSummary.problemSummary}</p>
            <p><span className="font-bold" style={{ color: tone.ink }}>Provisional diagnosis: </span>{aiSummary.provisionalDiagnosis}</p>
            <p><span className="font-bold" style={{ color: tone.ink }}>Further tests: </span>{aiSummary.furtherTestsNeeded}</p>
            <p className="text-[11px]" style={{ color: tone.muted }}>{aiSummary.aiGenerated ? "AI-generated — doctor to confirm." : "Not AI-generated for this visit."}</p>
          </div> : <p className="mt-3 text-sm" style={{ color: tone.muted }}>No AI pre-visit summary on file yet.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}><h3 className="text-sm font-bold" style={{ color: tone.ink }}>Latest appointment</h3>{appointments[0] ? <div className="mt-2 text-sm" style={{ color: tone.inkSoft }}><p>{appointments[0].date} · {appointments[0].time}</p><p className="mt-1">{appointments[0].reason}</p></div> : <p className="mt-2 text-sm" style={{ color: tone.muted }}>No appointments yet.</p>}</div>
          <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}><h3 className="text-sm font-bold" style={{ color: tone.ink }}>Billing so far</h3><p className="mt-2 text-2xl font-bold" style={{ color: tone.ink }}>{inr(billing.total)}</p><p className="text-xs" style={{ color: tone.muted }}>{billing.transactions.length} transaction(s)</p></div>
        </div>
      </div>}

      {tab === "appointments" && <div className="space-y-3">{appointments.length === 0 ? <p className="text-sm" style={{ color: tone.muted }}>No appointments yet.</p> : appointments.map((appt) => <div key={appt.id} className="rounded-2xl border p-4" style={{ borderColor: tone.border, background: tone.card }}>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold" style={{ color: tone.ink }}>{appt.date} · {appt.time}</p><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${visitTypeTone[appt.visitType]}`}>{appt.visitType}</span></div>
        <p className="mt-1 text-xs" style={{ color: tone.inkSoft }}>{appt.reason}</p>
        {appt.qaLog && appt.qaLog.length > 0 && <details className="mt-2 text-xs" style={{ color: tone.muted }}><summary className="cursor-pointer font-semibold">Intake conversation ({appt.qaLog.length} Q&amp;A)</summary><div className="mt-2 space-y-1.5">{appt.qaLog.map((qa, i) => <p key={i}><span className="font-semibold">{qa.question}</span> — {qa.answer}</p>)}</div></details>}
      </div>)}</div>}

      {tab === "reports" && <div className="space-y-2">{reports.length === 0 ? <p className="text-sm" style={{ color: tone.muted }}>No reports yet.</p> : reports.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: tone.border, background: tone.card }}><span style={{ color: tone.ink }}>{r.title}</span><span className="text-xs" style={{ color: tone.muted }}>{r.type} · {r.date}</span></div>)}</div>}

      {tab === "prescriptions" && <div className="space-y-2">{prescriptions.length === 0 ? <p className="text-sm" style={{ color: tone.muted }}>No prescriptions yet.</p> : prescriptions.map((rx) => <div key={rx.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: tone.border, background: tone.card }}><p style={{ color: tone.ink }}>{rx.medication} — {rx.dosage}</p><p className="text-xs" style={{ color: tone.muted }}>{rx.status}</p></div>)}</div>}

      {tab === "billing" && <div className="space-y-2">{billing.transactions.length === 0 ? <p className="text-sm" style={{ color: tone.muted }}>No billing history yet.</p> : billing.transactions.map((tx) => <div key={tx.id} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: tone.border, background: tone.card }}><div><p style={{ color: tone.ink }}>{tx.description}</p><p className="text-xs" style={{ color: tone.muted }}>{tx.type} · {tx.date}</p></div><span className="font-bold" style={{ color: tone.ink }}>{inr(tx.amount)}</span></div>)}</div>}
    </div>
  );
}
