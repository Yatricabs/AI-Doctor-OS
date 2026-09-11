"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Clock, FileText, MessageSquare, Pill, Stethoscope, User } from "lucide-react";

type PatientContext = {
  patient: { id: string; name: string; initials: string; dateOfBirth?: string; gender?: string; bloodGroup?: string; phone?: string };
  medications: { id: string; name: string; dose?: string; frequency?: string }[];
  allergies: { id: string; allergen: string; severity: string }[];
  conditions: { id: string; name: string; status: string }[];
  reports: { id: string; title: string; type: string; date: string; status: string }[];
  followUps: { id: string; title: string; dueDate: string; priority: string }[];
  upcomingAppointments: { id: string; appointmentDate: string; appointmentTime: string; visitType: string; status: string }[];
  recentMessages: { id: string; content: string; channel: string; direction: string; createdAt: string }[];
};

const DEMO_PATIENT_ID = "RM-102";

export default function PatientPortalPage() {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID);
  const [searched, setSearched] = useState(false);

  async function load(id: string) {
    setLoading(true); setError(""); setSearched(true);
    try {
      const res = await fetch(`/api/patients/context?patientId=${encodeURIComponent(id)}`);
      const payload = await res.json() as { ok: boolean; data: PatientContext; error?: { message: string } };
      if (payload.ok) setContext(payload.data);
      else setError(payload.error?.message ?? "Patient not found.");
    } catch { setError("Could not load patient data."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(DEMO_PATIENT_ID); }, []);

  const p = context?.patient;

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/patient/book" className="rounded-lg bg-[#07947f] px-3 py-1.5 text-xs font-bold text-white">Book appointment</Link>
            <Link href="/patient/intake" className="rounded-lg border border-[#dce9e3] px-3 py-1.5 text-xs font-semibold text-[#54716d]">Complete intake</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        {/* Search */}
        <div className="mb-5 flex gap-2">
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Patient ID (e.g. RM-102)" onKeyDown={(e) => e.key === "Enter" && void load(patientId)} className="flex-1 rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
          <button onClick={() => void load(patientId)} className="rounded-lg bg-[#07947f] px-4 py-2 text-sm font-bold text-white">Search</button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        {loading && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading patient portal…</p>}

        {context && p && (
          <>
            {/* Patient Header */}
            <div className="mb-5 flex items-center gap-4 rounded-2xl bg-[#124b47] p-5 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1f6b65] text-lg font-bold">{p.initials}</div>
              <div>
                <h1 className="text-xl font-bold">{p.name}</h1>
                <p className="text-sm text-[#a0e4cf]">{p.gender ?? "—"} · {p.dateOfBirth ? `DOB: ${p.dateOfBirth}` : "DOB not on file"} · Blood: {p.bloodGroup ?? "—"}</p>
                <p className="text-xs text-[#6dd4bc] mt-0.5">ID: {p.id} · {p.phone ?? "Phone not on file"}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Upcoming Appointments */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#244642]"><Calendar className="h-4 w-4 text-[#5a967e]" /> Upcoming appointments</h2>
                  <Link href="/patient/book" className="text-xs font-semibold text-[#5a967e] hover:underline">Book new →</Link>
                </div>
                {context.upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-[#78908a]">No upcoming appointments. <Link href="/patient/book" className="text-[#07947f] hover:underline">Book now →</Link></p>
                ) : context.upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="rounded-lg border border-[#eef2ef] p-3 mb-2">
                    <p className="text-sm font-semibold text-[#244642]">{appt.appointmentDate} at {appt.appointmentTime}</p>
                    <p className="text-xs text-[#78908a]">{appt.visitType.replace("_", " ")} · {appt.status}</p>
                  </div>
                ))}
              </section>

              {/* Active Medications */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><Pill className="h-4 w-4 text-[#9773a4]" /> Active medications</h2>
                {context.medications.length === 0 ? (
                  <p className="text-sm text-[#78908a]">No active medications on file.</p>
                ) : context.medications.map((med) => (
                  <div key={med.id} className="flex items-center justify-between py-2 border-b border-[#f0f4f2] last:border-0">
                    <p className="text-sm font-semibold text-[#244642]">{med.name}</p>
                    <p className="text-xs text-[#78908a]">{med.dose} · {med.frequency}</p>
                  </div>
                ))}
              </section>

              {/* Conditions & Allergies */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><User className="h-4 w-4 text-[#6682a5]" /> Health summary</h2>
                {context.conditions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#5a967e] mb-1.5">Conditions</p>
                    {context.conditions.map((c) => (
                      <span key={c.id} className="mr-1.5 mb-1.5 inline-block rounded-full bg-[#edf7f2] px-3 py-1 text-xs font-semibold text-[#317b67]">{c.name}</span>
                    ))}
                  </div>
                )}
                {context.allergies.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1.5">Allergies</p>
                    {context.allergies.map((a) => (
                      <span key={a.id} className={`mr-1.5 mb-1.5 inline-block rounded-full px-3 py-1 text-xs font-semibold ${a.severity === "severe" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>{a.allergen} ({a.severity})</span>
                    ))}
                  </div>
                )}
              </section>

              {/* Reports */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><FileText className="h-4 w-4 text-[#b07d4a]" /> Recent reports</h2>
                {context.reports.length === 0 ? (
                  <p className="text-sm text-[#78908a]">No reports on file.</p>
                ) : context.reports.map((r) => (
                  <div key={r.id} className="flex items-start justify-between py-2 border-b border-[#f0f4f2] last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-[#244642]">{r.title}</p>
                      <p className="text-xs text-[#78908a]">{r.type} · {r.date}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "Reviewed" ? "bg-[#edf7f2] text-[#4e927d]" : "bg-amber-100 text-amber-600"}`}>{r.status}</span>
                  </div>
                ))}
              </section>

              {/* Follow-ups */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><Clock className="h-4 w-4 text-[#b07d4a]" /> Pending follow-ups</h2>
                {context.followUps.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-[#5a9b6a]"><CheckCircle2 className="h-4 w-4" /> No pending follow-ups</div>
                ) : context.followUps.map((fu) => (
                  <div key={fu.id} className="py-2 border-b border-[#f0f4f2] last:border-0">
                    <p className="text-sm font-semibold text-[#244642]">{fu.title}</p>
                    <p className="text-xs text-[#78908a]">Due: {fu.dueDate} · {fu.priority} priority</p>
                  </div>
                ))}
              </section>

              {/* Messages */}
              <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#244642] mb-3"><MessageSquare className="h-4 w-4 text-[#6682a5]" /> Recent messages</h2>
                {context.recentMessages.length === 0 ? (
                  <p className="text-sm text-[#78908a]">No recent messages.</p>
                ) : context.recentMessages.map((m) => (
                  <div key={m.id} className={`rounded-lg p-3 mb-2 text-sm ${m.direction === "inbound" ? "bg-[#edf7f2] text-[#244642]" : "bg-[#f0f4f8] text-[#3a4a6a]"}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#78908a] mb-1">{m.direction === "inbound" ? "You" : "Clinic"} · {m.channel}</p>
                    <p className="line-clamp-2">{m.content}</p>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
