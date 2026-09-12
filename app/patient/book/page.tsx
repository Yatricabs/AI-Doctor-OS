"use client";

import { useState } from "react";
import { Calendar, Clock, User, ArrowRight, Check } from "lucide-react";
import Link from "next/link";

export default function BookAppointmentPage() {
  const [step, setStep] = useState<"type" | "date" | "confirm">("type");
  const [visitType, setVisitType] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const visitTypes = [
    { value: "new_complaint", label: "New complaint or symptom", desc: "First visit for a new health concern" },
    { value: "follow_up", label: "Follow-up visit", desc: "Continue treatment or check progress" },
    { value: "wellness", label: "Wellness check-up", desc: "Routine health screening" },
    { value: "report_review", label: "Report review", desc: "Discuss lab or imaging reports" },
  ];

  const availableDates = [
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
  ];

  const availableTimes = [
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "2:00 PM",
    "2:30 PM",
    "3:00 PM",
  ];

  const handleBook = () => {
    if (step === "type" && visitType) {
      setStep("date");
    } else if (step === "date" && selectedDate && selectedTime) {
      setStep("confirm");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-[#e1e9e5] px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-sm text-[#07947f] hover:underline">← Back to home</Link>
          <h1 className="text-2xl font-bold text-[#1f3a37] mt-2">Book an appointment</h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {["Visit type", "Date & time", "Confirm"].map((label, idx) => (
            <div key={label} className="flex items-center flex-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                step === ["type", "date", "confirm"][idx] 
                  ? "bg-[#07947f] text-white" 
                  : ["type", "date", "confirm"].indexOf(step) > idx
                  ? "bg-emerald-100 text-[#07947f]"
                  : "bg-slate-200 text-slate-500"
              }`}>
                {["type", "date", "confirm"].indexOf(step) > idx ? <Check className="h-5 w-5" /> : idx + 1}
              </div>
              <p className="ml-3 text-sm font-semibold text-slate-700 hidden sm:block">{label}</p>
              {idx < 2 && <div className={`flex-1 h-0.5 mx-2 ${["type", "date", "confirm"].indexOf(step) > idx ? "bg-[#07947f]" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Visit Type */}
        {step === "type" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1f3a37]">What's the reason for your visit?</h2>
            <div className="grid gap-3">
              {visitTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setVisitType(type.value)}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    visitType === type.value
                      ? "border-[#07947f] bg-[#edf7f2]"
                      : "border-[#e1e9e5] bg-white hover:border-[#c2ddd5]"
                  }`}
                >
                  <p className="font-bold text-[#1f3a37]">{type.label}</p>
                  <p className="text-sm text-[#78908a]">{type.desc}</p>
                </button>
              ))}
            </div>
            <button
              onClick={handleBook}
              disabled={!visitType}
              className="w-full mt-6 py-3 rounded-lg bg-[#07947f] text-white font-bold disabled:opacity-50 hover:bg-[#066d66] transition flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === "date" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#1f3a37] mb-4">Select date</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {availableDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 rounded-lg border-2 font-semibold text-sm transition ${
                      selectedDate === date
                        ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]"
                        : "border-[#e1e9e5] bg-white text-[#5a967e] hover:border-[#c2ddd5]"
                    }`}
                  >
                    <Calendar className="h-4 w-4 mx-auto mb-1" />
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1f3a37] mb-4">Select time</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableTimes.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-3 rounded-lg border-2 font-semibold text-sm transition ${
                      selectedTime === time
                        ? "border-[#07947f] bg-[#edf7f2] text-[#07947f]"
                        : "border-[#e1e9e5] bg-white text-[#5a967e] hover:border-[#c2ddd5]"
                    }`}
                  >
                    <Clock className="h-4 w-4 mx-auto mb-1" />
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("type")}
                className="flex-1 py-3 rounded-lg border-2 border-[#e1e9e5] text-[#5a967e] font-bold hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleBook}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 py-3 rounded-lg bg-[#07947f] text-white font-bold disabled:opacity-50 hover:bg-[#066d66] transition flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-[#dce9e3] bg-[#f7faf8] p-6">
              <h2 className="text-xl font-bold text-[#1f3a37] mb-4">Confirm your booking</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-[#07947f]" />
                  <div>
                    <p className="text-sm text-[#78908a]">Visit type</p>
                    <p className="font-bold text-[#1f3a37]">{visitTypes.find(v => v.value === visitType)?.label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[#07947f]" />
                  <div>
                    <p className="text-sm text-[#78908a]">Date</p>
                    <p className="font-bold text-[#1f3a37]">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[#07947f]" />
                  <div>
                    <p className="text-sm text-[#78908a]">Time</p>
                    <p className="font-bold text-[#1f3a37]">{selectedTime}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">✓ Your appointment is confirmed. You'll receive a WhatsApp message with further instructions.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("date")}
                className="flex-1 py-3 rounded-lg border-2 border-[#e1e9e3] text-[#5a967e] font-bold hover:bg-slate-50"
              >
                Back
              </button>
              <Link
                href="/patient/portal"
                className="flex-1 py-3 rounded-lg bg-[#07947f] text-white font-bold hover:bg-[#066d66] transition text-center"
              >
                Go to my portal
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
