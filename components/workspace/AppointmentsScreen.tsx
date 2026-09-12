"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, Plus, Search, User, X } from "lucide-react";
import { apiGet, apiSend } from "./api";
import { humanize } from "@/lib/format";

type Appt = {
  id: string; patientId: string; patientName?: string; patientInitials?: string; patientPhone?: string;
  visitType: string; appointmentDate: string; appointmentTime: string; status: string; reason?: string;
};

const FOLLOWUP_TYPES = new Set(["follow_up", "report_review", "wellness"]);
function isFollowUp(v: string) { return FOLLOWUP_TYPES.has(v); }

const FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "follow", label: "Follow-up" },
] as const;

export default function AppointmentsScreen({ onOpenPatient }: { onOpenPatient?: (id: string) => void }) {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "follow">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAppts((await apiGet<{ appointments: Appt[] }>("/api/appointments")).appointments); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load appointments."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const total = appts.length;
  const newCount = appts.filter((a) => !isFollowUp(a.visitType)).length;
  const followCount = appts.filter((a) => isFollowUp(a.visitType)).length;
  const visible = appts.filter((a) => filter === "all" || (filter === "follow" ? isFollowUp(a.visitType) : !isFollowUp(a.visitType)));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173f3c]">Appointments</h1>
          <p className="mt-1 text-sm text-[#78908a]">Schedule and manage new and follow-up appointments.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#066d66]">
          <Plus className="h-4 w-4" /> New appointment
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Total" value={total} tone="bg-[#eef7f2] text-[#4f9d78]" />
        <Stat label="New" value={newCount} tone="bg-[#edf2f8] text-[#6682a5]" />
        <Stat label="Follow-up" value={followCount} tone="bg-[#f4eef7] text-[#9773a4]" />
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === f.key ? "bg-[#153f3c] text-white" : "border border-[#dce9e3] text-[#5a7a6e] hover:bg-[#f0f6f3]"}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-[#5a967e]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="mt-5 space-y-2">
          {visible.map((a) => (
            <button key={a.id} onClick={() => onOpenPatient?.(a.patientId)} className="flex w-full items-center gap-3 rounded-xl border border-[#e1e9e5] bg-white px-4 py-3 text-left hover:border-[#c2ddd5] hover:bg-[#f7faf8]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d5eee4] text-xs font-bold text-[#277a6b]">{a.patientInitials ?? a.patientName?.slice(0, 2).toUpperCase() ?? "?"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#24443f]">{a.patientName ?? a.patientId}</p>
                <p className="text-[11px] text-[#8a9e98]">{a.reason ?? humanize(a.visitType)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#24443f]">{a.appointmentTime}</p>
                <p className="text-[11px] text-[#8a9e98]">{a.appointmentDate}</p>
              </div>
              <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isFollowUp(a.visitType) ? "bg-[#f4eef7] text-[#9773a4]" : "bg-[#edf2f8] text-[#6682a5]"}`}>{isFollowUp(a.visitType) ? "Follow-up" : "New"}</span>
            </button>
          ))}
          {visible.length === 0 && <p className="rounded-xl border border-[#e1e9e5] bg-white px-4 py-10 text-center text-sm text-[#8a9e98]"><CalendarDays className="mx-auto mb-2 h-6 w-6 text-[#c2ddd5]" />No appointments.</p>}
        </div>
      )}

      {showForm && <NewAppointmentModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e9e5] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6d827c]">{label}</p>
        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#173f3c]">{String(value).padStart(2, "0")}</p>
    </div>
  );
}

type Patient = { id: string; name: string; phone?: string };

function NewAppointmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  // new patient
  const [np, setNp] = useState({ name: "", phone: "", age: "", sex: "Male", location: "" });
  // appointment
  const [visitType, setVisitType] = useState("new_complaint");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    if (!phone.trim()) return;
    setSearching(true); setLookupMsg(""); setFound(null);
    try {
      const data = await apiGet<{ found: boolean; patient?: Patient }>(`/api/patients?phone=${encodeURIComponent(phone.trim())}`);
      if (data.found && data.patient) { setFound(data.patient); setVisitType("follow_up"); }
      else setLookupMsg("No patient found with this number. Switch to 'New patient' to register.");
    } catch (e) { setLookupMsg(e instanceof Error ? e.message : "Lookup failed."); }
    finally { setSearching(false); }
  }

  async function save() {
    setSaving(true); setError("");
    try {
      let patientId = found?.id ?? "";
      if (mode === "new") {
        if (!np.name.trim() || !np.phone.trim()) throw new Error("Name and mobile number are required.");
        const created = await apiSend<{ patient: { id: string } }>("/api/patients", "POST", {
          name: np.name, phone: np.phone, gender: np.sex, address: np.location, patientType: "new",
          age: np.age ? Number(np.age) : undefined,
        });
        patientId = created.patient.id;
      }
      if (!patientId) throw new Error("Select or register a patient first.");
      await apiSend("/api/appointments", "POST", {
        patientId, visitType, appointmentDate: date, appointmentTime: time, reason,
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create appointment."); }
    finally { setSaving(false); }
  }

  const canSave = mode === "existing" ? Boolean(found) : Boolean(np.name.trim() && np.phone.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#eef4f1] px-6 py-4">
          <h2 className="text-lg font-bold text-[#173f3c]">New appointment</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#8a9e98]" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">{error}</div>}

          <div className="flex gap-2">
            <button onClick={() => setMode("existing")} className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === "existing" ? "bg-[#153f3c] text-white" : "border border-[#dce9e3] text-[#5a7a6e]"}`}>Existing patient</button>
            <button onClick={() => setMode("new")} className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === "new" ? "bg-[#153f3c] text-white" : "border border-[#dce9e3] text-[#5a7a6e]"}`}>New patient</button>
          </div>

          {mode === "existing" ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">Mobile number</label>
              <div className="flex gap-2">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} placeholder="+91-9876543210" className="flex-1 rounded-lg border border-[#dce9e3] px-3 py-2 text-sm outline-none focus:border-[#07947f]" />
                <button onClick={() => void lookup()} disabled={searching} className="flex items-center gap-1 rounded-lg bg-[#ebf4ed] px-3 text-xs font-bold text-[#5c916e]">{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Find</button>
              </div>
              {found && <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#c2ddd5] bg-[#f1f7f2] px-3 py-2 text-sm text-[#317b67]"><User className="h-4 w-4" /> {found.name} · {found.id}</div>}
              {lookupMsg && <p className="mt-2 text-xs text-amber-600">{lookupMsg}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" full><input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} className="in" /></Field>
              <Field label="Mobile"><input value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} className="in" /></Field>
              <Field label="Age"><input type="number" value={np.age} onChange={(e) => setNp({ ...np, age: e.target.value })} className="in" /></Field>
              <Field label="Sex">
                <select value={np.sex} onChange={(e) => setNp({ ...np, sex: e.target.value })} className="in"><option>Male</option><option>Female</option><option>Other</option></select>
              </Field>
              <Field label="Location"><input value={np.location} onChange={(e) => setNp({ ...np, location: e.target.value })} className="in" /></Field>
            </div>
          )}

          <div className="border-t border-[#eef4f1] pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Visit type" full>
                <select value={visitType} onChange={(e) => setVisitType(e.target.value)} className="in">
                  <option value="new_complaint">New complaint</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="report_review">Report review</option>
                  <option value="wellness">Wellness</option>
                </select>
              </Field>
              <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="in" /></Field>
              <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="in" /></Field>
              <Field label="Reason" full><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diabetes follow-up" className="in" /></Field>
            </div>
          </div>
        </div>

        <div className="border-t border-[#eef4f1] px-6 py-4">
          <button onClick={() => void save()} disabled={saving || !canSave} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create appointment
          </button>
        </div>
      </div>

      <style jsx>{`
        .in { width: 100%; border: 1px solid #dce9e3; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .in:focus { border-color: #07947f; }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5a967e]">{label}</span>
      {children}
    </label>
  );
}
