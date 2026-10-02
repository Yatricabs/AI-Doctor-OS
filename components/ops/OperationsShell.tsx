"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Bell, Boxes, CalendarClock, FileText, IndianRupee, LayoutDashboard, Search, Settings, Stethoscope, Users } from "lucide-react";
import "@/styles/consultation.css";
import DashboardView from "./DashboardView";
import AppointmentsView from "./AppointmentsView";
import PatientsView from "./PatientsView";
import ReportsView from "./ReportsView";
import InventoryView from "./InventoryView";
import BillingView from "./BillingView";
import AnalyticsView from "./AnalyticsView";
import SettingsView from "./SettingsView";
import { tone } from "./shared";

const sections = [
  { key: "Dashboard", icon: LayoutDashboard },
  { key: "Appointments", icon: CalendarClock },
  { key: "Patients", icon: Users },
  { key: "Reports & Documents", icon: FileText },
  { key: "Inventory", icon: Boxes },
  { key: "Billing", icon: IndianRupee },
  { key: "Analytics", icon: BarChart3 },
  { key: "Settings", icon: Settings },
] as const;

type SectionKey = (typeof sections)[number]["key"];

export default function OperationsShell() {
  const [section, setSection] = useState<SectionKey>("Dashboard");
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  const [appointmentsTab, setAppointmentsTab] = useState<"today" | "all" | "new" | "followup">("today");

  function openPatient(patientId: string) {
    setOpenPatientId(patientId);
    setSection("Patients");
  }

  function navigate(key: string) {
    setOpenPatientId(null);
    if (key === "Appointments:new" || key === "Appointments:followup") {
      setAppointmentsTab(key.split(":")[1] as "new" | "followup");
      setSection("Appointments");
      return;
    }
    setSection(key as SectionKey);
  }

  return (
    <div className="flex min-h-screen" style={{ background: tone.bg }}>
      <aside className="sticky top-0 flex h-screen w-16 flex-col items-center gap-1 border-r py-5 md:w-60 md:items-stretch md:px-4" style={{ borderColor: tone.border, background: "#f0f4f2" }}>
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 px-2 md:justify-start">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: tone.primaryDark }}><Stethoscope className="h-5 w-5" /></span>
          <span className="hidden text-sm font-extrabold md:inline" style={{ color: tone.ink }}>AI UPCHAR</span>
        </Link>
        <nav className="space-y-1">
          {sections.map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => navigate(key)} className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition md:justify-start" style={section === key ? { background: tone.primaryDark, color: "#fff" } : { color: "#6c8782" }}>
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden md:inline">{key}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-2 text-[10px] md:block" style={{ color: tone.muted }}>Patient &amp; Operations · Demo V2</div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Global top bar */}
        <header className="cw-topbar">
          <div className="cw-topbar-search">
            <Search size={16} style={{ color: "#78908a" }} />
            <input placeholder="Search patients, appointments, reports…" />
            <span className="cw-kbd">Ctrl K</span>
          </div>
          <div className="cw-topbar-right">
            <button className="cw-bell" aria-label="Notifications"><Bell size={18} /><span className="cw-bell-badge">1</span></button>
            <div className="cw-profile">
              <span className="cw-profile-avatar">RK</span>
              <span>
                <span className="cw-profile-name" style={{ display: "block" }}>Dr. Raj Kumar</span>
                <span className="cw-profile-role">General Physician</span>
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 md:px-10">
          <div className="mx-auto max-w-[1280px]">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: tone.ink }}>{section}</h1>
            <p className="mt-1 text-sm" style={{ color: tone.muted }}>{descriptionFor(section)}</p>
            <div className="mt-6">
              {section === "Dashboard" && <DashboardView navigate={navigate} />}
              {section === "Appointments" && <AppointmentsView openPatient={openPatient} initialTab={appointmentsTab} />}
              {section === "Patients" && <PatientsView openPatientId={openPatientId} onOpenPatient={setOpenPatientId} />}
              {section === "Reports & Documents" && <ReportsView openPatient={openPatient} />}
              {section === "Inventory" && <InventoryView />}
              {section === "Billing" && <BillingView openPatient={openPatient} />}
              {section === "Analytics" && <AnalyticsView />}
              {section === "Settings" && <SettingsView />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function descriptionFor(section: SectionKey): string {
  switch (section) {
    case "Dashboard": return "Today's schedule, revenue, and what needs attention.";
    case "Appointments": return "Today's schedule, all appointments, and new patient / follow-up booking.";
    case "Patients": return "Every patient on file, with the complete Patient 360 record.";
    case "Reports & Documents": return "Lab reports, prescriptions, and referrals across all patients.";
    case "Inventory": return "Medicine stock and the tests/scans catalogue.";
    case "Billing": return "Revenue and every billing transaction, linked to patients and appointments.";
    case "Analytics": return "Operational and revenue analytics from live data.";
    case "Settings": return "Clinician profile, availability, and notifications.";
  }
}
