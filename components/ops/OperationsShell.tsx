"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
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
  const { data: session } = useSession();
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
            <div className="relative group">
              <button className="cw-bell" aria-label="Notifications">
                <Bell size={18} />
                <span className="cw-bell-badge">3</span>
              </button>
              
              {/* Notification Dropdown (Hover) */}
              <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                  <span className="text-xs text-primary-600 cursor-pointer hover:underline">Mark all as read</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition">
                    <p className="text-sm font-medium text-slate-800">New patient intake completed</p>
                    <p className="text-xs text-slate-500 mt-1">Rajkumar just finished the AI intake flow.</p>
                    <p className="text-[10px] text-slate-400 mt-1">2 mins ago</p>
                  </div>
                  <div className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition">
                    <p className="text-sm font-medium text-slate-800">System Update</p>
                    <p className="text-xs text-slate-500 mt-1">Auth & V2 configurations are fully deployed.</p>
                    <p className="text-[10px] text-slate-400 mt-1">15 mins ago</p>
                  </div>
                  <div className="p-3 hover:bg-slate-50 cursor-pointer transition">
                    <p className="text-sm font-medium text-slate-800">Database connected</p>
                    <p className="text-xs text-slate-500 mt-1">Supabase connection established successfully.</p>
                    <p className="text-[10px] text-slate-400 mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative group">
              <div className="cw-profile cursor-pointer hover:bg-slate-200/50 transition rounded-lg pr-2">
                <span className="cw-profile-avatar">{session?.user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "DR"}</span>
                <span>
                  <span className="cw-profile-name" style={{ display: "block" }}>{session?.user?.name || "Dr. User"}</span>
                  <span className="cw-profile-role">{(session?.user as any)?.role || "General Physician"}</span>
                </span>
              </div>
              
              {/* Dropdown Menu (Hover) */}
              <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{session?.user?.name || "Dr. User"}</p>
                  <p className="text-xs text-slate-500">{session?.user?.email}</p>
                </div>
                <div className="p-1.5">
                  <button onClick={() => navigate("Settings")} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors">
                    Account Settings
                  </button>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors">
                    Sign Out
                  </button>
                </div>
              </div>
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
