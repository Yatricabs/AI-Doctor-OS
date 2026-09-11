"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BellRing, CalendarDays, CheckCircle2,
  ChevronRight, Clock, FileText, LayoutDashboard, ListTodo,
  Mic, RefreshCw, Stethoscope, Users, AlertCircle, Inbox
} from "lucide-react";

type Stat = { label: string; value: string; detail: string };
type Appointment = { id: string; patientId: string; patientName?: string; appointmentTime: string; visitType: string; status: string; reason?: string };
type InboxItem = { id: string; title: string; detail: string; priority: string; category: string; patientName?: string };
type FollowUp = { id: string; title: string; dueDate: string; priority: string; patientId: string; patientName?: string };
type Note = { id: string; patientId: string; status: string; subjective: string };

type BriefData = {
  date: string;
  stats: Stat[];
  appointments: Appointment[];
  nextAppointment?: Appointment;
  nextPatient?: { name: string; initials: string };
  urgentItems: InboxItem[];
  pendingInbox: InboxItem[];
  overdueFollowUps: FollowUp[];
  pendingNotes: Note[];
  clinicalBrief: string;
  metrics: Record<string, number>;
};

export default function MorningBriefPage() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/briefs/morning");
      const payload = await res.json() as { ok: boolean; data: BriefData };
      if (payload.ok) setBrief(payload.data);
      else setError("Could not load morning brief.");
    } catch { setError("Network error loading morning brief."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[260px] md:px-6 md:py-8">
        <Link href="/demo" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#078d79] text-white"><Stethoscope className="h-5 w-5" /></span>
          <span className="hidden text-[20px] font-bold tracking-[-0.05em] text-[#193d3a] md:inline">AI UPCHAR</span>
        </Link>
        <nav className="mt-8 space-y-1">
          {[
            { label: "Morning Brief", icon: LayoutDashboard, href: "/doctor/morning-brief", active: true },
            { label: "Queue", icon: Users, href: "/doctor/queue" },
            { label: "AI Inbox", icon: Inbox, href: "/doctor/inbox" },
            { label: "Follow-ups", icon: ListTodo, href: "/doctor/follow-ups" },
            { label: "Workspace", icon: Stethoscope, href: "/demo" },
          ].map(({ label, icon: Icon, href, active }) => (
            <Link key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-[#153f3c] text-white" : "text-[#6c8782] hover:bg-white/70 hover:text-[#315d57]"}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden md:block">
          <div className="rounded-xl border border-[#c5e9dd] bg-white p-3 text-xs text-[#6d958b]">
            <p className="font-bold text-[#078b78]">Dr. Ananya Arya</p>
            <p>General Medicine</p>
            <p className="mt-1 opacity-70">AI UPCHAR Demo Clinic</p>
          </div>
        </div>
      </aside>

      <div className="ml-[78px] md:ml-[260px]">
        <header className="sticky top-0 z-30 border-b border-[#e4ebe7] bg-[#fbfdfc] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#78908a]">Morning Brief · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f3c]">{greeting}, Dr. Arya</h1>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#dce9e3] px-3 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3]">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 md:px-8">
          {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading && !brief && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading your morning brief…</p>}

          {brief && (
            <>
              {/* Clinical Brief Banner */}
              {brief.clinicalBrief && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#c2ddd5] bg-[#edf7f2] px-4 py-3">
                  <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#2a8f6a]" />
                  <p className="text-sm font-medium text-[#1f6a4a]">{brief.clinicalBrief}</p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {brief.stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-[#e1e9e5] bg-white p-4">
                    <p className="text-xs text-[#78908a]">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#173f3c]">{stat.value}</p>
                    <p className="mt-1 text-[11px] text-[#8a9e98]">{stat.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {/* Today's Appointments */}
                <section className="lg:col-span-2 rounded-2xl border border-[#e1e9e5] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#244642]">Today&apos;s appointments</h2>
                    <Link href="/reception/checkin" className="text-xs font-semibold text-[#5a967e] hover:underline flex items-center gap-1">Check-in <ChevronRight className="h-3 w-3" /></Link>
                  </div>
                  <div className="mt-4 space-y-2">
                    {brief.appointments.length === 0 && <p className="text-sm text-[#78908a]">No appointments scheduled.</p>}
                    {brief.appointments.map((appt) => (
                      <div key={appt.id} className="flex items-center gap-3 rounded-lg border border-[#eef2ef] p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4f3ed] text-xs font-bold text-[#4e927d]">
                          {appt.patientName?.slice(0, 2).toUpperCase() ?? "??"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#244642] truncate">{appt.patientName ?? appt.patientId}</p>
                          <p className="text-xs text-[#78908a] truncate">{appt.appointmentTime} · {appt.visitType.replace("_", " ")} · {appt.reason ?? ""}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          appt.status === "in_consultation" ? "bg-[#07947f] text-white" :
                          appt.status === "checked_in" ? "bg-yellow-100 text-yellow-700" :
                          appt.status === "completed" ? "bg-gray-100 text-gray-500" :
                          "bg-[#edf7f2] text-[#4e927d]"
                        }`}>{appt.status.replace("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Urgent Items */}
                <section className="rounded-2xl border border-[#fde8e5] bg-[#fff8f7] p-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#c0503e]" />
                    <h2 className="text-base font-bold text-[#7a2d22]">Urgent items</h2>
                    {brief.urgentItems.length > 0 && <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{brief.urgentItems.length}</span>}
                  </div>
                  <div className="mt-4 space-y-3">
                    {brief.urgentItems.length === 0 && (
                      <div className="flex items-center gap-2 text-sm text-[#5a9b6a]">
                        <CheckCircle2 className="h-4 w-4" /> No urgent items
                      </div>
                    )}
                    {brief.urgentItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-lg border border-red-100 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-red-500">{item.category}</p>
                        <p className="mt-1 text-sm font-semibold text-[#7a2d22]">{item.title}</p>
                        <p className="mt-0.5 text-xs text-[#a07a74] line-clamp-2">{item.detail}</p>
                      </div>
                    ))}
                    {brief.urgentItems.length > 0 && (
                      <Link href="/doctor/inbox" className="flex items-center gap-1 text-xs font-bold text-[#c0503e] hover:underline">
                        View all inbox <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {/* Overdue Follow-ups */}
                <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#b07d4a]" />
                      <h2 className="text-base font-bold text-[#244642]">Overdue follow-ups</h2>
                      {brief.overdueFollowUps.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">{brief.overdueFollowUps.length}</span>}
                    </div>
                    <Link href="/doctor/follow-ups" className="text-xs font-semibold text-[#5a967e] hover:underline">View all</Link>
                  </div>
                  <div className="mt-4 space-y-2">
                    {brief.overdueFollowUps.length === 0 && <p className="text-sm text-[#5a9b6a] flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> All follow-ups on track</p>}
                    {brief.overdueFollowUps.slice(0, 4).map((fu) => (
                      <div key={fu.id} className="flex items-start justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-[#7a5c2a]">{fu.title}</p>
                          <p className="text-xs text-[#a08040]">Due: {fu.dueDate} · {fu.patientName ?? fu.patientId}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">{fu.priority}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Pending Notes */}
                <section className="rounded-2xl border border-[#e1e9e5] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#6682a5]" />
                      <h2 className="text-base font-bold text-[#244642]">Notes pending approval</h2>
                      {brief.pendingNotes.length > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">{brief.pendingNotes.length}</span>}
                    </div>
                    <Link href="/demo" className="text-xs font-semibold text-[#5a967e] hover:underline">Open workspace</Link>
                  </div>
                  <div className="mt-4 space-y-2">
                    {brief.pendingNotes.length === 0 && <p className="text-sm text-[#5a9b6a] flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> All notes approved</p>}
                    {brief.pendingNotes.slice(0, 4).map((note) => (
                      <div key={note.id} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#2c4a7a]">Patient: {note.patientId}</p>
                          <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">DRAFT</span>
                        </div>
                        <p className="mt-1 text-xs text-[#4a6090] line-clamp-2">{note.subjective}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Quick Actions */}
              <section className="mt-5 rounded-2xl bg-[#124b47] p-5 text-white">
                <h2 className="text-base font-bold text-[#a0e4cf]">Quick actions</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "View queue", icon: Users, href: "/doctor/queue" },
                    { label: "AI Inbox", icon: Inbox, href: "/doctor/inbox" },
                    { label: "Follow-ups", icon: ListTodo, href: "/doctor/follow-ups" },
                    { label: "Workspace", icon: Stethoscope, href: "/demo" },
                  ].map(({ label, icon: Icon, href }) => (
                    <Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-[#2f6b67] bg-[#1c5e59] p-3 text-sm font-semibold text-white hover:bg-[#245d58] transition">
                      <Icon className="h-4 w-4 text-[#6dd4bc]" />{label}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
