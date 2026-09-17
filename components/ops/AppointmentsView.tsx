"use client";

import { useState } from "react";
import { CalendarClock, ChevronRight, Plus, UserPlus } from "lucide-react";
import PatientIntakeChat from "./PatientIntakeChat";
import { useCreateAppointmentMutation, useGetAppointmentsQuery, useGetPatientsQuery } from "@/lib/apiSlice";
import { inr, Patient, priorityTone, todayISO, tone, visitTypeTone } from "./shared";

type Tab = "today" | "all" | "new" | "followup";

export default function AppointmentsView({ openPatient, initialTab = "today" }: { openPatient: (patientId: string) => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notice, setNotice] = useState("");
  const { data, isLoading } = useGetAppointmentsQuery();
  const appointments = data?.appointments ?? [];

  const today = appointments.filter((a) => a.date === todayISO());
  const visible = tab === "today" ? today : appointments;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={CalendarClock} label={`Today's schedule (${today.length})`} />
        <TabButton active={tab === "all"} onClick={() => setTab("all")} icon={ChevronRight} label={`All appointments (${appointments.length})`} />
        <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={UserPlus} label="New patient" />
        <TabButton active={tab === "followup"} onClick={() => setTab("followup")} icon={Plus} label="Follow-up" />
      </div>

      {notice && <p className="rounded-xl border p-3 text-sm" style={{ borderColor: tone.border, background: tone.successBg, color: tone.success }}>{notice}</p>}

      {tab === "new" && <PatientIntakeChat onComplete={({ patient }) => { setNotice(`${patient.name} added to today's queue.`); setTab("today"); }} />}

      {tab === "followup" && <FollowUpForm onCreated={() => { setNotice("Follow-up appointment scheduled."); setTab("today"); }} />}

      {(tab === "today" || tab === "all") && (isLoading ? <p className="text-sm" style={{ color: tone.muted }}>Loading appointments…</p> : visible.length === 0 ? <p className="rounded-xl border p-5 text-sm" style={{ borderColor: tone.border, background: tone.card, color: tone.muted }}>No appointments {tab === "today" ? "today" : "yet"}.</p> : <div className="space-y-3">
        {visible.map((appt) => <div key={appt.id} className="rounded-2xl border p-4" style={{ borderColor: tone.border, background: tone.card }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button onClick={() => openPatient(appt.patientId)} className="text-sm font-bold hover:underline" style={{ color: tone.ink }}>{appt.patientName}</button>
              <p className="mt-1 text-xs" style={{ color: tone.muted }}>{appt.date} · {appt.time} · {appt.channel} · Queue #{appt.queuePosition}</p>
              <p className="mt-1 text-xs" style={{ color: tone.inkSoft }}>{appt.reason}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${visitTypeTone[appt.visitType]}`}>{appt.visitType}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${priorityTone[appt.priority]}`}>{appt.priority}</span>
              <span className="text-xs font-semibold" style={{ color: tone.inkSoft }}>{inr(appt.consultationFee)}</span>
            </div>
          </div>
        </div>)}
      </div>)}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof CalendarClock; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition" style={active ? { borderColor: tone.primary, background: tone.primary, color: "#fff" } : { borderColor: tone.border, background: tone.card, color: tone.inkSoft }}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function FollowUpForm({ onCreated }: { onCreated: () => void }) {
  const { data } = useGetPatientsQuery();
  const patients: Patient[] = data?.patients ?? [];
  const [createAppointment, { isLoading: saving }] = useCreateAppointmentMutation();
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [errorText, setErrorText] = useState("");

  async function submit() {
    if (!patientId || !reason.trim() || !time.trim()) { setErrorText("Select a patient and fill in reason and time."); return; }
    setErrorText("");
    try {
      const patient = patients.find((p) => p.id === patientId);
      await createAppointment({ patientId, patientName: patient?.name, channel: "Mobile app", visitType: "Follow-up", priority: "Follow-up", date, time, reason, consultationFee: 400 }).unwrap();
      onCreated();
      setReason(""); setTime("");
    } catch (err: unknown) {
      setErrorText(err instanceof Error ? err.message : "Could not schedule follow-up.");
    }
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: tone.border, background: tone.card }}>
      <h3 className="text-sm font-bold" style={{ color: tone.ink }}>Schedule a follow-up</h3>
      <p className="mt-1 text-xs" style={{ color: tone.muted }}>For a known patient. Their history loads automatically in Patient 360 — only ask what&apos;s changed.</p>
      {errorText && <p className="mt-3 rounded-lg p-2 text-xs" style={{ background: tone.dangerBg, color: tone.danger }}>{errorText}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select value={patientId} onChange={(event) => setPatientId(event.target.value)} className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }}>
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for follow-up" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
        <input value={time} onChange={(event) => setTime(event.target.value)} placeholder="Time (e.g. 4:30 PM)" className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />
      </div>
      <button onClick={submit} disabled={saving} className="mt-4 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>{saving ? "Scheduling…" : "Schedule follow-up"}</button>
    </div>
  );
}
