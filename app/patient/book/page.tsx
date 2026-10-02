"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, User, ArrowRight, ArrowLeft, Check, Phone, UserPlus, Search, Loader2, MapPin } from "lucide-react";

type Patient = {
  id: string;
  name: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  patientType?: string;
};
type RecentAppt = { appointmentDate?: string; appointmentTime?: string; reason?: string; status?: string };

type Step = "identity" | "lookup" | "register" | "type" | "date" | "confirm" | "done";

const VISIT_TYPES = [
  { value: "new_complaint", label: "New complaint or symptom", desc: "A new health concern" },
  { value: "follow_up", label: "Follow-up visit", desc: "Continue treatment or check progress" },
  { value: "wellness", label: "Wellness check-up", desc: "Routine health screening" },
  { value: "report_review", label: "Report review", desc: "Discuss lab or imaging reports" },
];

// Next 5 bookable days starting today — patients can never pick a past date.
const DATES = Array.from({ length: 5 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d.toISOString().slice(0, 10);
});
const TIMES = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "2:00 PM", "2:30 PM", "3:00 PM"];

function ageFromDob(dob?: string): string {
  if (!dob) return "";
  const y = Number(dob.slice(0, 4));
  if (!y) return "";
  return String(new Date().getFullYear() - y);
}

export default function BookAppointmentPage() {
  const [step, setStep] = useState<Step>("identity");
  const [isReturning, setIsReturning] = useState(false);

  // Identity / patient
  const [lookupPhone, setLookupPhone] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [recent, setRecent] = useState<RecentAppt[]>([]);
  const [reg, setReg] = useState({ name: "", phone: "", age: "", gender: "Male", location: "" });

  // Booking
  const [visitType, setVisitType] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tokenNo, setTokenNo] = useState("");

  // ── Existing patient: look up by mobile ──
  async function lookup() {
    const digits = lookupPhone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/patients?phone=${encodeURIComponent(lookupPhone)}`);
      const payload = await res.json() as { ok: boolean; data?: { found: boolean; patient: Patient | null; recentAppointments?: RecentAppt[] } };
      if (payload.ok && payload.data?.found && payload.data.patient) {
        setPatient(payload.data.patient);
        setRecent(payload.data.recentAppointments ?? []);
        setVisitType("follow_up");
      } else {
        setError("No patient found with this mobile number. You can register as a new patient instead.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  // ── New patient: register ──
  async function register() {
    if (!reg.name.trim()) { setError("Name is required."); return; }
    const digits = reg.phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number."); return; }
    if (!reg.age || Number(reg.age) <= 0) { setError("Enter a valid age."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reg.name,
          phone: reg.phone,
          age: Number(reg.age),
          gender: reg.gender,
          address: reg.location,
        }),
      });
      const payload = await res.json() as { ok: boolean; data?: { patient: Patient }; error?: { message: string } };
      if (payload.ok && payload.data?.patient) {
        setPatient(payload.data.patient);
        setVisitType("new_complaint");
        setStep("type");
      } else {
        setError(payload.error?.message ?? "Could not register. Please try again.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  // ── Create the appointment ──
  async function confirmBooking() {
    if (!patient || !selectedDate || !selectedTime) return;
    setBusy(true); setError("");
    // Convert "10:30 AM" -> "10:30" (24h-ish) for the API's time field.
    const time24 = to24h(selectedTime);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          appointmentDate: selectedDate,
          appointmentTime: time24,
          visitType: visitType || "new_complaint",
          channel: "web",
          reason: VISIT_TYPES.find((v) => v.value === visitType)?.label,
        }),
      });
      const payload = await res.json() as { ok: boolean; data?: { appointment: { id: string } }; error?: { message: string } };
      if (payload.ok && payload.data?.appointment) {
        setTokenNo(`#${Math.floor(5 + Math.random() * 20)}`);
        setStep("done");
      } else {
        setError(payload.error?.message ?? "Could not book the appointment. Please pick another slot.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  function to24h(t: string): string {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return t;
    let h = Number(m[1]);
    const min = m[2];
    const ap = m[3].toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  const bookingSteps: Step[] = ["type", "date", "confirm"];
  const showProgress = bookingSteps.includes(step);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b border-[#e1e9e5] bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm text-[#07947f] hover:underline">← Back to home</Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1f3a37]">Book an appointment</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Booking progress (only during the booking steps) */}
        {showProgress && (
          <div className="mb-8 flex items-center justify-between">
            {["Visit type", "Date & time", "Confirm"].map((label, idx) => {
              const pos = bookingSteps.indexOf(step);
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${pos === idx ? "bg-[#07947f] text-white" : pos > idx ? "bg-emerald-100 text-[#07947f]" : "bg-slate-200 text-slate-500"
                    }`}>
                    {pos > idx ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <p className="ml-2 hidden text-sm font-semibold text-slate-700 sm:block">{label}</p>
                  {idx < 2 && <div className={`mx-2 h-0.5 flex-1 ${pos > idx ? "bg-[#07947f]" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 0: Identity ── */}
        {step === "identity" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1f3a37]">Have you visited us before?</h2>
            <p className="text-sm text-[#78908a]">This helps us pull up your records or set you up as a new patient.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => { setIsReturning(true); setStep("lookup"); setError(""); }}
                className="flex flex-col items-start gap-2 rounded-xl border-2 border-[#e1e9e5] bg-white p-5 text-left transition hover:border-[#07947f]"
              >
                <Phone className="h-6 w-6 text-[#07947f]" />
                <p className="font-bold text-[#1f3a37]">Existing patient</p>
                <p className="text-sm text-[#78908a]">I&apos;ve been here before — find me by my mobile number.</p>
              </button>
              <button
                onClick={() => { setIsReturning(false); setStep("register"); setError(""); }}
                className="flex flex-col items-start gap-2 rounded-xl border-2 border-[#e1e9e5] bg-white p-5 text-left transition hover:border-[#07947f]"
              >
                <UserPlus className="h-6 w-6 text-[#07947f]" />
                <p className="font-bold text-[#1f3a37]">New patient</p>
                <p className="text-sm text-[#78908a]">First time here — register with a few details.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── Existing: lookup by mobile ── */}
        {step === "lookup" && (
          <div className="space-y-5">
            <button onClick={() => { setStep("identity"); setPatient(null); setError(""); }} className="flex items-center gap-1 text-sm font-semibold text-[#5a967e]">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
              <h2 className="text-xl font-bold text-[#1f3a37]">Find your record</h2>
              <p className="mt-1 text-sm text-[#78908a]">Enter the mobile number registered with us.</p>
              <div className="mt-5 flex gap-2">
                <input
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()}
                  placeholder="e.g. 9876543210"
                  inputMode="tel"
                  className="min-w-0 flex-1 rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]"
                />
                <button onClick={() => void lookup()} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#07947f] px-4 text-sm font-bold text-white disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
                </button>
              </div>
              <p className="mt-3 text-xs text-[#8aa39a]">Tip (demo): try 9876543210 (Rohan Mehta) or 9876543211 (Ananya Kapoor).</p>
            </div>

            {/* Found patient card */}
            {patient && (
              <div className="rounded-2xl border-2 border-[#b9decf] bg-[#f0faf5] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#07947f] text-sm font-bold text-white">
                    {patient.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-bold text-[#1f3a37]">{patient.name}</p>
                    <p className="text-xs text-[#5a967e]">
                      {patient.id}{ageFromDob(patient.dateOfBirth) ? ` · ${ageFromDob(patient.dateOfBirth)} yrs` : ""}{patient.gender ? ` · ${patient.gender}` : ""}
                    </p>
                  </div>
                </div>
                {recent.length > 0 && (
                  <div className="mt-4 border-t border-[#c8e5d8] pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a967e]">Recent visits</p>
                    {recent.slice(0, 2).map((a, i) => (
                      <p key={i} className="mt-1 text-xs text-[#3f6b5c]">{a.appointmentDate} · {a.reason ?? "Visit"}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => { setStep("type"); setError(""); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">
                  Continue as {patient.name.split(/\s+/)[0]} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── New: registration form ── */}
        {step === "register" && (
          <div className="space-y-5">
            <button onClick={() => { setStep("identity"); setError(""); }} className="flex items-center gap-1 text-sm font-semibold text-[#5a967e]">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">
              <h2 className="text-xl font-bold text-[#1f3a37]">Register as a new patient</h2>
              <p className="mt-1 text-sm text-[#78908a]">Just a few details to create your record.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Full name</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 focus-within:border-[#07947f]">
                    <User className="h-4 w-4 text-[#9ab5aa]" />
                    <input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="e.g. Sunita Verma" className="flex-1 py-2.5 text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Mobile number</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 focus-within:border-[#07947f]">
                    <Phone className="h-4 w-4 text-[#9ab5aa]" />
                    <input value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="e.g. 9876500000" inputMode="tel" className="flex-1 py-2.5 text-sm outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Age</label>
                    <input value={reg.age} onChange={(e) => setReg({ ...reg, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="e.g. 34" inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Sex</label>
                    <select value={reg.gender} onChange={(e) => setReg({ ...reg, gender: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none focus:border-[#07947f]">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5a967e]">Location</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 focus-within:border-[#07947f]">
                    <MapPin className="h-4 w-4 text-[#9ab5aa]" />
                    <input value={reg.location} onChange={(e) => setReg({ ...reg, location: e.target.value })} placeholder="City / area" className="flex-1 py-2.5 text-sm outline-none" />
                  </div>
                </div>
              </div>
              <button onClick={() => void register()} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create record &amp; continue
              </button>
            </div>
          </div>
        )}

        {/* ── Visit type ── */}
        {step === "type" && (
          <div className="space-y-4">
            {patient && (
              <p className="rounded-lg bg-[#edf7f2] px-4 py-2.5 text-sm text-[#317b67]">
                Booking for <strong>{patient.name}</strong>{isReturning ? " (returning patient)" : " (new patient)"}
              </p>
            )}
            <h2 className="text-xl font-bold text-[#1f3a37]">What&apos;s the reason for your visit?</h2>
            <div className="grid gap-3">
              {VISIT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setVisitType(type.value)}
                  className={`rounded-lg border-2 p-4 text-left transition ${visitType === type.value ? "border-[#07947f] bg-[#edf7f2]" : "border-[#e1e9e5] bg-white hover:border-[#c2ddd5]"
                    }`}
                >
                  <p className="font-bold text-[#1f3a37]">{type.label}</p>
                  <p className="text-sm text-[#78908a]">{type.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(isReturning ? "lookup" : "register")} className="flex-1 rounded-lg border-2 border-[#e1e9e5] py-3 font-bold text-[#5a967e] hover:bg-slate-50">Back</button>
              <button onClick={() => setStep("date")} disabled={!visitType} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#07947f] py-3 font-bold text-white transition hover:bg-[#066d66] disabled:opacity-50">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Date & time ── */}
        {step === "date" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-xl font-bold text-[#1f3a37]">Select date</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {DATES.map((date) => (
                  <button key={date} onClick={() => setSelectedDate(date)} className={`rounded-lg border-2 p-3 text-sm font-semibold transition ${selectedDate === date ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]" : "border-[#e1e9e5] bg-white text-[#5a967e] hover:border-[#c2ddd5]"}`}>
                    <Calendar className="mx-auto mb-1 h-4 w-4" />
                    {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-4 text-xl font-bold text-[#1f3a37]">Select time</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIMES.map((time) => (
                  <button key={time} onClick={() => setSelectedTime(time)} className={`rounded-lg border-2 p-3 text-sm font-semibold transition ${selectedTime === time ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]" : "border-[#e1e9e5] bg-white text-[#5a967e] hover:border-[#c2ddd5]"}`}>
                    <Clock className="mx-auto mb-1 h-4 w-4" />
                    {time}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("type")} className="flex-1 rounded-lg border-2 border-[#e1e9e5] py-3 font-bold text-[#5a967e] hover:bg-slate-50">Back</button>
              <button onClick={() => setStep("confirm")} disabled={!selectedDate || !selectedTime} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#07947f] py-3 font-bold text-white transition hover:bg-[#066d66] disabled:opacity-50">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Confirm ── */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-[#dce9e3] bg-[#f7faf8] p-6">
              <h2 className="mb-4 text-xl font-bold text-[#1f3a37]">Confirm your booking</h2>
              <div className="space-y-4">
                <Row icon={<User className="h-5 w-5 text-[#07947f]" />} label="Patient" value={patient?.name ?? "—"} />
                <Row icon={<User className="h-5 w-5 text-[#07947f]" />} label="Visit type" value={VISIT_TYPES.find((v) => v.value === visitType)?.label ?? "—"} />
                <Row icon={<Calendar className="h-5 w-5 text-[#07947f]" />} label="Date" value={selectedDate ? new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "—"} />
                <Row icon={<Clock className="h-5 w-5 text-[#07947f]" />} label="Time" value={selectedTime} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("date")} className="flex-1 rounded-lg border-2 border-[#e1e9e5] py-3 font-bold text-[#5a967e] hover:bg-slate-50">Back</button>
              <button onClick={() => void confirmBooking()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#07947f] py-3 font-bold text-white transition hover:bg-[#066d66] disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm booking
              </button>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="rounded-2xl border-2 border-[#b9decf] bg-[#f0faf5] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#07947f]">
              <Check className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#1f6a4a]">Appointment confirmed!</h2>
            <p className="mt-2 text-sm text-[#317b67]">
              {patient?.name}, your visit is booked for {selectedDate && new Date(selectedDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })} at {selectedTime}.
              You&apos;ll receive a WhatsApp confirmation shortly.
            </p>
            {tokenNo && <p className="mt-3 text-sm text-[#3f6b5c]">Your appointment number is <strong>{tokenNo}</strong>.</p>}
            <div className="mt-6 space-y-2">
              <Link href="/patient/intake" className="block w-full rounded-xl bg-[#07947f] py-3 text-sm font-bold text-white">
                Complete pre-visit intake →
              </Link>
              <Link href="/patient/portal" className="block w-full rounded-xl border border-[#c2ddd5] py-3 text-sm font-semibold text-[#317b67]">
                Go to my portal
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-sm text-[#78908a]">{label}</p>
        <p className="font-bold text-[#1f3a37]">{value}</p>
      </div>
    </div>
  );
}
