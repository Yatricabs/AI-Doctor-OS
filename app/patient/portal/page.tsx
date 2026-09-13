"use client";

import { Calendar, FileText, Pill, Clock, LogOut } from "lucide-react";
import Link from "next/link";
import PortalVisitHistory from "@/components/PortalVisitHistory";

const PORTAL_PATIENT_ID = "RM-102";

export default function PatientPortalPage() {
  const appointments = [
    { date: "2026-09-15", time: "10:30 AM", doctor: "Dr. Ananya Arya", status: "Confirmed" },
    { date: "2026-09-08", time: "3:00 PM", doctor: "Dr. Ananya Arya", status: "Completed" },
  ];

  const prescriptions = [
    { id: "RX-001", date: "2026-09-08", items: 2, status: "Dispatched" },
    { id: "RX-002", date: "2026-09-01", items: 3, status: "Completed" },
  ];

  const followUps = [
    { title: "HbA1c repeat test", dueDate: "2026-09-25", status: "Pending" },
    { title: "Thyroid recheck", dueDate: "2026-10-01", status: "Pending" },
  ];

  return (
    <main className="min-h-screen bg-[#f7faf8]">
      {/* Header */}
      <header className="bg-white border-b border-[#e1e9e5] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#07947f] flex items-center justify-center">
              <span className="text-white font-bold">RM</span>
            </div>
            <div>
              <h1 className="font-bold text-[#1f3a37]">Rohan Mehta</h1>
              <p className="text-xs text-[#78908a]">Patient ID: RM-102</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#dce9e3] text-[#5a967e] hover:bg-[#f0f6f3]">
            <LogOut className="h-4 w-4" /> Sign out
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Appointments */}
          <div className="rounded-2xl border border-[#dce9e3] bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-[#07947f]" />
              <h2 className="font-bold text-[#1f3a37]">Appointments</h2>
            </div>
            <div className="space-y-3">
              {appointments.map((apt, idx) => (
                <div key={idx} className="rounded-lg bg-[#f7faf8] p-3 border border-[#e1e9e5]">
                  <p className="text-sm font-bold text-[#1f3a37]">{apt.date} • {apt.time}</p>
                  <p className="text-xs text-[#78908a]">{apt.doctor}</p>
                  <span className={`inline-block text-[10px] font-bold rounded px-2 py-1 mt-2 ${apt.status === "Confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {apt.status}
                  </span>
                </div>
              ))}
              <Link href="/patient/book" className="block w-full mt-4 rounded-lg bg-[#07947f] py-2 text-center text-sm font-bold text-white hover:bg-[#066d66]">
                Book new appointment
              </Link>
            </div>
          </div>

          {/* Prescriptions */}
          <div className="rounded-2xl border border-[#dce9e3] bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Pill className="h-5 w-5 text-[#07947f]" />
              <h2 className="font-bold text-[#1f3a37]">Prescriptions</h2>
            </div>
            <div className="space-y-3">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rounded-lg bg-[#f7faf8] p-3 border border-[#e1e9e5]">
                  <p className="text-sm font-bold text-[#1f3a37]">{rx.id}</p>
                  <p className="text-xs text-[#78908a]">{rx.date} • {rx.items} medications</p>
                  <span className={`inline-block text-[10px] font-bold rounded px-2 py-1 mt-2 ${rx.status === "Dispatched" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {rx.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="rounded-2xl border border-[#dce9e3] bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-[#07947f]" />
              <h2 className="font-bold text-[#1f3a37]">Follow-ups</h2>
            </div>
            <div className="space-y-3">
              {followUps.map((fu, idx) => (
                <div key={idx} className="rounded-lg bg-[#f7faf8] p-3 border border-[#e1e9e5]">
                  <p className="text-sm font-bold text-[#1f3a37]">{fu.title}</p>
                  <p className="text-xs text-[#78908a]">Due: {fu.dueDate}</p>
                  <span className="inline-block text-[10px] font-bold rounded px-2 py-1 mt-2 bg-amber-100 text-amber-700">
                    {fu.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Medical Records */}
        <div className="mt-8 rounded-2xl border border-[#dce9e3] bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-[#07947f]" />
            <h2 className="font-bold text-[#1f3a37]">Medical Records</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dce9e3] p-4 hover:bg-[#f7faf8] cursor-pointer transition">
              <p className="text-sm font-bold text-[#1f3a37]">CBC and Lipid Profile</p>
              <p className="text-xs text-[#78908a]">Lab Report • Sep 10, 2026</p>
            </div>
            <div className="rounded-lg border border-[#dce9e3] p-4 hover:bg-[#f7faf8] cursor-pointer transition">
              <p className="text-sm font-bold text-[#1f3a37]">Thyroid Panel</p>
              <p className="text-xs text-[#78908a]">Lab Report • Sep 09, 2026</p>
            </div>
            <div className="rounded-lg border border-[#dce9e3] p-4 hover:bg-[#f7faf8] cursor-pointer transition">
              <p className="text-sm font-bold text-[#1f3a37]">Active Medications</p>
              <p className="text-xs text-[#78908a]">Prescription • Sep 08, 2026</p>
            </div>
          </div>
        </div>

        {/* Per-appointment chat history + prescriptions */}
        <PortalVisitHistory patientId={PORTAL_PATIENT_ID} />
      </div>
    </main>
  );
}
