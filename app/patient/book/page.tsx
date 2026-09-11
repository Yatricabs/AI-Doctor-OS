"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Calendar, CheckCircle2, Clock, Stethoscope, User } from "lucide-react";

const VISIT_TYPES = [
  { value: "new_complaint", label: "New complaint", description: "First time visit for a new health concern" },
  { value: "follow_up", label: "Follow-up", description: "Continuing care from a previous visit" },
  { value: "wellness", label: "Wellness check", description: "Annual or routine health check-up" },
  { value: "report_review", label: "Report review", description: "Discuss test results or medical reports" },
  { value: "procedure", label: "Procedure / injection", description: "Minor procedure or treatment" },
];

const TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

type BookingStep = "patient" | "visit_type" | "datetime" | "reason" | "confirm" | "done";

export default function BookAppointmentPage() {
  const [step, setStep] = useState<BookingStep>("patient");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [visitType, setVisitType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookedAppointment, setBookedAppointment] = useState<Record<string, unknown> | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function lookupPatient() {
    if (!patientId.trim()) { setError("Enter your patient ID."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(patientId)}`);
      const payload = await res.json() as { ok: boolean; data: { patients: { name: string; id: string }[] } };
      if (payload.ok && payload.data.patients.length > 0) {
        setPatientName(payload.data.patients[0].name);
        setStep("visit_type");
      } else {
        // New patient — allow them to continue
        setPatientName(`New Patient`);
        setStep("visit_type");
      }
    } catch { setError("Could not look up patient."); }
    finally { setLoading(false); }
  }

  async function confirm() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, visitType, appointmentDate: date, appointmentTime: time, reason, channel: "web" }),
      });
      const payload = await res.json() as { ok: boolean; data: { appointment: Record<string, unknown> }; error?: { message: string } };
      if (payload.ok) { setBookedAppointment(payload.data.appointment); setStep("done"); }
      else setError(payload.error?.message ?? "Booking failed.");
    } catch { setError("Could not book appointment."); }
    finally { setLoading(false); }
  }

  const selectedVisitType = VISIT_TYPES.find((v) => v.value === visitType);

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      {/* Header */}
      <header className="border-b border-[#e4ebe7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078d79] text-white"><Stethoscope className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight text-[#193d3a]">AI UPCHAR</span>
          </Link>
          <Link href="/patient/portal" className="text-xs font-semibold text-[#5a967e] hover:underline">Patient portal →</Link>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Patient Access</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">Book an appointment</h1>
          <p className="mt-1 text-sm text-[#78908a]">Quick and simple — takes less than 3 minutes.</p>
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center gap-1">
          {(["patient", "visit_type", "datetime", "reason", "confirm"] as BookingStep[]).map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${["patient", "visit_type", "datetime", "reason", "confirm", "done"].indexOf(step) > i ? "bg-[#07947f]" : s === step ? "bg-[#a0d9cc]" : "bg-[#e1e9e5]"}`} />
          ))}
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Step 1: Patient ID */}
        {step === "patient" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h2 className="text-lg font-bold text-[#244642]">Who is this appointment for?</h2>
            <p className="mt-1 text-sm text-[#78908a]">Enter your patient ID, or continue as a new patient.</p>
            <div className="mt-5 space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8da09b]" />
                <input value={patientId} onChange={(e) => setPatientId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void lookupPatient()} placeholder="Patient ID (e.g. RM-102)" className="w-full rounded-lg border border-[#dce9e3] py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#07947f]" />
              </div>
              <p className="text-xs text-[#78908a]">Don&apos;t have an ID? Type your name and we&apos;ll create a new record.</p>
              <button onClick={() => void lookupPatient()} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Visit Type */}
        {step === "visit_type" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h2 className="text-lg font-bold text-[#244642]">What is this visit for?</h2>
            {patientName && <p className="mt-1 text-sm text-[#5a967e]">Welcome, {patientName}</p>}
            <div className="mt-4 space-y-2">
              {VISIT_TYPES.map((vt) => (
                <button key={vt.value} onClick={() => { setVisitType(vt.value); setStep("datetime"); }} className={`w-full text-left rounded-xl border p-4 transition ${visitType === vt.value ? "border-[#07947f] bg-[#edf7f2]" : "border-[#e1e9e5] hover:border-[#9ac8b8]"}`}>
                  <p className="text-sm font-semibold text-[#244642]">{vt.label}</p>
                  <p className="text-xs text-[#78908a] mt-0.5">{vt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h2 className="text-lg font-bold text-[#244642]">Choose a date and time</h2>
            <p className="mt-1 text-sm text-[#78908a]">Visit type: <strong>{selectedVisitType?.label}</strong></p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e] flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date</label>
                <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
              </div>
              {date && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e] flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time slot</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button key={slot} onClick={() => setTime(slot)} className={`rounded-lg border py-2 text-sm font-semibold transition ${time === slot ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]" : "border-[#e1e9e5] hover:border-[#9ac8b8]"}`}>{slot}</button>
                    ))}
                  </div>
                </div>
              )}
              {date && time && (
                <button onClick={() => setStep("reason")} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Reason */}
        {step === "reason" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h2 className="text-lg font-bold text-[#244642]">Briefly describe your concern</h2>
            <p className="mt-1 text-sm text-[#78908a]">This helps the doctor prepare before your visit.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Persistent headache for 3 days, mild fever…" className="mt-4 h-28 w-full rounded-lg border border-[#dce9e3] p-3 text-sm outline-none focus:border-[#07947f]" />
            <button onClick={() => setStep("confirm")} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">
              Review booking <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setStep("confirm")} className="mt-2 w-full text-center text-xs text-[#78908a] hover:underline">Skip — no details</button>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === "confirm" && (
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
            <h2 className="text-lg font-bold text-[#244642]">Confirm appointment</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-[#f0f4f2] pb-3">
                <span className="text-[#78908a]">Patient</span>
                <span className="font-semibold">{patientName} ({patientId})</span>
              </div>
              <div className="flex justify-between border-b border-[#f0f4f2] pb-3">
                <span className="text-[#78908a]">Visit type</span>
                <span className="font-semibold">{selectedVisitType?.label}</span>
              </div>
              <div className="flex justify-between border-b border-[#f0f4f2] pb-3">
                <span className="text-[#78908a]">Date & time</span>
                <span className="font-semibold">{date} at {time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78908a]">Doctor</span>
                <span className="font-semibold">Dr. Ananya Arya</span>
              </div>
              {reason && <p className="rounded-lg bg-[#f7faf8] p-3 text-xs text-[#5a7a6e] italic">&ldquo;{reason}&rdquo;</p>}
            </div>
            <button onClick={() => void confirm()} disabled={loading} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
              {loading ? "Booking…" : "Confirm booking"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="rounded-2xl border border-[#b9decf] bg-[#f0faf5] p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#07947f]" />
            <h2 className="text-xl font-bold text-[#1f6a4a]">Appointment confirmed!</h2>
            <p className="mt-2 text-sm text-[#317b67]">Your appointment has been booked for {date} at {time}.</p>
            <p className="mt-1 text-xs text-[#5a967e]">You will receive a reminder before your appointment.</p>
            <div className="mt-6 space-y-2">
              <Link href="/patient/intake" className="block w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white text-center">
                Complete pre-visit intake →
              </Link>
              <Link href="/patient/portal" className="block w-full rounded-xl border border-[#c2ddd5] py-3 text-sm font-semibold text-[#317b67] text-center">
                Go to patient portal
              </Link>
            </div>
            {bookedAppointment && <p className="mt-3 text-[10px] text-[#5a967e] font-mono">Ref: {String(bookedAppointment.id)}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
