"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Pill,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

type Patient = {
  id: string;
  initials: string;
  name: string;
  age: number;
  reason: string;
  time: string;
  status: "Ready" | "Waiting" | "In review";
  tone: string;
};

const patients: Patient[] = [
  { id: "RS-042", initials: "RS", name: "Rahul Sharma", age: 42, reason: "Hypertension follow-up", time: "09:30 AM", status: "Ready", tone: "bg-emerald-100 text-emerald-700" },
  { id: "AK-118", initials: "AK", name: "Ananya Kapoor", age: 35, reason: "Annual wellness review", time: "10:00 AM", status: "Waiting", tone: "bg-amber-100 text-amber-700" },
  { id: "VN-306", initials: "VN", name: "Vikram Nair", age: 58, reason: "Lab results review", time: "10:30 AM", status: "In review", tone: "bg-sky-100 text-sky-700" },
  { id: "SP-077", initials: "SP", name: "Sneha Patel", age: 29, reason: "Medication check-in", time: "11:00 AM", status: "Waiting", tone: "bg-amber-100 text-amber-700" },
];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays },
  { label: "Patients", icon: Users },
  { label: "Reports", icon: FileText },
  { label: "Prescriptions", icon: Pill },
  { label: "AI Inbox", icon: MessageSquareText, count: 4 },
  { label: "Follow-ups", icon: ClipboardList, count: 7 },
];

const patientTabs = ["Overview", "Timeline", "Reports", "Prescriptions", "Follow-ups"];

export default function DoctorWorkspace() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState("RS-042");
  const [activeTab, setActiveTab] = useState("Overview");
  const [briefReviewed, setBriefReviewed] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const filteredPatients = patients.filter((patient) => patient.name.toLowerCase().includes(search.toLowerCase()));

  function selectPatient(patient: Patient) {
    setSelectedPatientId(patient.id);
    setActiveTab("Overview");
    setBriefReviewed(false);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f7] text-slate-900">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-sm"><Stethoscope className="h-5 w-5" /></div>
          <div><p className="text-sm font-bold tracking-tight text-slate-900">AI Doctor OS</p><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Clinical workspace</p></div>
        </div>
        <div className="hidden items-center gap-4 md:flex"><Link href="/demo" className="text-xs font-bold text-[#0f766e] hover:underline">Open demo workspace</Link><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-xs font-medium text-slate-500">All systems operational</span></span></div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNotificationOpen(!notificationOpen); setMenuOpen(false); }} aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" /></button>
          <button onClick={() => { setMenuOpen(!menuOpen); setNotificationOpen(false); }} className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition hover:bg-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7efeb] text-xs font-bold text-[#0f766e]">DS</span><span className="hidden text-xs font-semibold text-slate-700 sm:block">Dr. Sharma</span></button>
          {notificationOpen && <div className="absolute right-5 top-14 w-72 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl"><p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Notifications</p><button onClick={() => setNotificationOpen(false)} className="w-full rounded-lg bg-rose-50 p-3 text-left hover:bg-rose-100"><span className="block text-xs font-bold text-rose-700">Priority alert</span><span className="mt-1 block text-xs text-slate-600">1 report needs review for today&apos;s queue.</span></button><button onClick={() => setNotificationOpen(false)} className="mt-2 w-full rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100"><span className="block text-xs font-bold text-slate-700">Follow-up reminder</span><span className="mt-1 block text-xs text-slate-500">2 follow-ups are due this week.</span></button></div>}{menuOpen && <div className="absolute right-5 top-14 w-44 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl"><button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"><Settings className="h-4 w-4" /> Account settings</button><button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" /> Security</button></div>}
        </div>
      </header>
      {mobileNavOpen && <div className="fixed inset-x-0 top-16 z-30 border-b border-slate-200 bg-white p-3 shadow-lg lg:hidden"><div className="grid grid-cols-2 gap-1">{[...navItems, { label: "Analytics", icon: Activity }, { label: "Settings", icon: Settings }].map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveNav(label); setMobileNavOpen(false); }} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${activeNav === label ? "bg-[#e3f3f0] text-[#0f766e]" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{label}</button>)}</div></div>}

      <div className="mx-auto flex max-w-[1540px]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-5 lg:block">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => setActiveNav(label)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${activeNav === label ? "bg-[#e3f3f0] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><span className="flex items-center gap-3"><Icon className="h-[17px] w-[17px]" />{label}</span>{count && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{count}</span>}</button>)}
          </nav>
          <div className="mt-8 border-t border-slate-100 pt-5"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Practice</p><button onClick={() => setActiveNav("Analytics")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${activeNav === "Analytics" ? "bg-[#e3f3f0] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"}`}><Activity className="h-[17px] w-[17px]" />Analytics</button><button onClick={() => setActiveNav("Settings")} className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${activeNav === "Settings" ? "bg-[#e3f3f0] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"}`}><Settings className="h-[17px] w-[17px]" />Settings</button></div>
          <div className="mt-12 rounded-xl bg-[#f0f9f7] p-3"><div className="flex items-center gap-2 text-xs font-bold text-[#0f766e]"><ShieldCheck className="h-4 w-4" /> Doctor controlled</div><p className="mt-2 text-[11px] leading-relaxed text-slate-500">AI suggestions are always reviewed before they become clinical actions.</p></div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">Thursday, 10 September 2026</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Good morning, Dr. Sharma</h1><p className="mt-1 text-sm text-slate-500">Your clinic has 24 consultations scheduled today.</p></div><button onClick={() => setShowNewAppointment(true)} className="flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b625b]"><Plus className="h-4 w-4" /> New appointment</button></div>

          {activeNav === "Dashboard" && <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Today&apos;s patients" value="24" detail="+3 from last Thursday" tone="teal" icon={Users} /><MetricCard label="Follow-ups due" value="7" detail="2 need attention" tone="amber" icon={ClipboardList} /><MetricCard label="Reports to review" value="3" detail="1 high priority" tone="sky" icon={FileText} /><MetricCard label="Avg. consult time" value="18m" detail="4m faster this week" tone="violet" icon={HeartPulse} /></div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.65fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Today&apos;s queue</h2><p className="mt-0.5 text-xs text-slate-500">{patients.length} appointments · 2 completed</p></div><button onClick={() => setActiveNav("Appointments")} className="text-xs font-bold text-[#0f766e] hover:underline">View calendar</button></div><div className="relative mt-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search today&apos;s patients" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#0f766e]" /></div><div className="mt-3 space-y-1">{filteredPatients.map((patient) => <button key={patient.id} onClick={() => selectPatient(patient)} className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition ${patient.id === selectedPatientId ? "bg-[#eaf7f4]" : "hover:bg-slate-50"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${patient.tone}`}>{patient.initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{patient.name}</span><span className="block truncate text-[11px] text-slate-500">{patient.reason}</span></span><span className="text-right"><span className="block text-[11px] font-semibold text-slate-700">{patient.time}</span><span className={`text-[10px] font-medium ${patient.status === "Ready" ? "text-emerald-600" : patient.status === "In review" ? "text-sky-600" : "text-amber-600"}`}>{patient.status}</span></span></button>)}</div></section>

            <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${selectedPatient.tone}`}>{selectedPatient.initials}</span><div><div className="flex items-center gap-2"><h2 className="font-bold text-slate-900">{selectedPatient.name}</h2><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{selectedPatient.id}</span></div><p className="mt-0.5 text-xs text-slate-500">{selectedPatient.age} years · {selectedPatient.reason} · Last visit 28 Aug 2026</p></div></div><button onClick={() => setBriefReviewed(!briefReviewed)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${briefReviewed ? "bg-emerald-50 text-emerald-700" : "bg-[#0f766e] text-white hover:bg-[#0b625b]"}`}>{briefReviewed ? <Check className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}{briefReviewed ? "Brief reviewed" : "Review patient brief"}</button></div><div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4">{patientTabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${activeTab === tab ? "border-[#0f766e] text-[#0f766e]" : "border-transparent text-slate-400 hover:text-slate-700"}`}>{tab}</button>)}</div><PatientPanel tab={activeTab} reviewed={briefReviewed} /><PatientCopilot key={selectedPatient.id} patient={selectedPatient} activeTab={activeTab} /></section>
          </div>
          </>}

          {activeNav !== "Dashboard" && <WorkspaceView activeNav={activeNav} onNewAppointment={() => setShowNewAppointment(true)} />}
        </section>
      </div>

      {showNewAppointment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">New appointment</h2><p className="mt-1 text-sm text-slate-500">Add a patient to today&apos;s clinic queue.</p></div><button onClick={() => setShowNewAppointment(false)} aria-label="Close appointment dialog" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-3"><input placeholder="Patient name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0f766e]" /><div className="grid grid-cols-2 gap-3"><input type="date" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-[#0f766e]" /><input type="time" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-[#0f766e]" /></div><button onClick={() => setShowNewAppointment(false)} className="mt-2 w-full rounded-lg bg-[#0f766e] py-2.5 text-sm font-bold text-white hover:bg-[#0b625b]">Add to queue</button></div></div></div>}
    </main>
  );
}

function MetricCard({ label, value, detail, tone, icon: Icon }: { label: string; value: string; detail: string; tone: string; icon: typeof Users }) {
  const tones: Record<string, string> = { teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700", sky: "bg-sky-50 text-sky-700", violet: "bg-violet-50 text-violet-700" };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[11px] font-medium text-slate-400">{detail}</p></div>;
}

function PatientCopilot({ patient, activeTab }: { patient: Patient; activeTab: string }) {
  const [messages, setMessages] = useState<{ role: "doctor" | "ai"; text: string }[]>([
    { role: "ai", text: `I am reviewing ${patient.name}'s authorized record, including the ${patient.reason.toLowerCase()} context. Ask me about the diagnosis, reports, risks, or possible next steps.` },
  ]);
  const [draft, setDraft] = useState("");
  const [researchMode, setResearchMode] = useState(false);
  const [researching, setResearching] = useState(false);

  function askCopilot(prompt: string) {
    if (!prompt.trim()) return;
    setMessages((current) => [...current, { role: "doctor", text: prompt }, { role: "ai", text: researchMode ? `Deep research brief for ${patient.name}: the available record supports reviewing the current trend, confirming missing history, and checking guideline-aligned options. Any external evidence should be verified by the treating clinician before action.` : `Based on the available ${patient.name} record and the current ${activeTab.toLowerCase()} view, consider confirming the latest home readings, checking adherence and contraindications, and documenting the clinical reasoning before changing the plan. I can help compare a specific report or draft questions for the next visit.` }]);
    setDraft("");
  }

  function runResearch() {
    setResearching(true);
    window.setTimeout(() => {
      setResearching(false);
      setMessages((current) => [...current, { role: "ai", text: `Research scan completed for ${patient.name}: 3 relevant evidence areas found. Review current guidelines, compare the patient's trend against treatment targets, and verify contraindications before making a clinical decision. Sources are suggestions for review, not a diagnosis or prescription.` }]);
    }, 700);
  }

  return <section className="mt-5 overflow-hidden rounded-xl border border-[#b9ded8] bg-[#f8fcfb] shadow-sm"><div className="flex flex-col gap-3 border-b border-[#d8eeea] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#dff3ef] p-2 text-[#0f766e]"><BrainCircuit className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><h3 className="font-bold text-slate-900">AI Clinical Copilot</h3><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">PATIENT-SCOPED</span></div><p className="mt-0.5 text-xs text-slate-500">Discuss diagnosis, reports, risks and next steps with the record in context.</p></div></div><button onClick={() => setResearchMode(!researchMode)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${researchMode ? "bg-[#0f766e] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[#0f766e]"}`}><BookOpen className="h-3.5 w-3.5" />{researchMode ? "Deep research on" : "Deep research"}</button></div><div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]"><div className="border-b border-[#d8eeea] lg:border-b-0 lg:border-r"><div className="max-h-64 space-y-3 overflow-y-auto p-4">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "doctor" ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-xl px-3 py-2.5 text-xs leading-relaxed ${message.role === "doctor" ? "bg-[#0f766e] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{message.text}</div></div>)}</div><div className="flex flex-wrap gap-2 border-t border-[#d8eeea] px-4 py-3"><button onClick={() => askCopilot("What should I verify before the next clinical decision?")} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-[#0f766e]">What should I verify?</button><button onClick={() => askCopilot("Compare the latest reports and explain what changed.")} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-[#0f766e]">Compare reports</button><button onClick={() => askCopilot("What safety risks or missing information should I check?")} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-[#0f766e]">Safety review</button></div><form onSubmit={(event) => { event.preventDefault(); askCopilot(draft); }} className="flex gap-2 border-t border-[#d8eeea] bg-white p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Ask about ${patient.name}'s record...`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-[#0f766e]" /><button type="submit" aria-label="Send message to AI Copilot" className="rounded-lg bg-[#0f766e] p-2.5 text-white hover:bg-[#0b625b]"><Send className="h-4 w-4" /></button></form></div><div className="space-y-4 p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f766e]">Decision support</p><p className="mt-1 text-xs leading-relaxed text-slate-500">AI suggestions are draft guidance only. Doctor review is required before diagnosis, prescription, record change, or patient communication.</p></div><div className="rounded-lg bg-white p-3 ring-1 ring-slate-200"><p className="text-xs font-bold text-slate-800">Suggested next checks</p><ul className="mt-2 space-y-2 text-[11px] text-slate-500"><li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />Confirm current symptoms and home readings</li><li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />Review recent medication adherence</li><li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />Document rationale for the care plan</li></ul></div><button onClick={runResearch} disabled={researching} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#b9ded8] bg-white px-3 py-2.5 text-xs font-bold text-[#0f766e] hover:bg-[#effaf8] disabled:opacity-60"><BookOpen className="h-3.5 w-3.5" />{researching ? "Researching evidence..." : "Run evidence research"}</button></div></div></section>;
}

function WorkspaceView({ activeNav, onNewAppointment }: { activeNav: string; onNewAppointment: () => void }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("This week");
  const [completed, setCompleted] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ reminders: true, aiReview: true, messages: false });

  function toggleItem(id: string, setter: (value: string[]) => void, values: string[]) {
    setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  const title = activeNav === "AI Inbox" ? "AI Inbox" : activeNav;
  const description = activeNav === "AI Inbox" ? "Review messages, reports and tasks that need a human decision." : "Keep the clinic moving with a clear, reviewable workflow.";

  if (activeNav === "Appointments") return <WorkspaceFrame title="Appointments" description="Plan the day, manage check-ins and keep the live queue moving." action="New appointment" onAction={onNewAppointment}><div className="mb-5 flex flex-wrap gap-2"><FilterButton label="Today · 10 Sep" active /><FilterButton label="All providers" /><FilterButton label="All statuses" /></div><div className="overflow-hidden rounded-xl border border-slate-200"><ListHeader labels={["Patient", "Visit type", "Time", "Status", ""]} />{patients.map((patient) => <div key={patient.id} className="grid grid-cols-[1.5fr_1.3fr_0.8fr_0.9fr_32px] items-center gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm"><span className="font-semibold text-slate-800">{patient.name}<small className="mt-0.5 block text-[11px] font-normal text-slate-400">{patient.id}</small></span><span className="text-xs text-slate-500">{patient.reason}</span><span className="text-xs font-semibold text-slate-700">{patient.time}</span><button onClick={() => toggleItem(patient.id, setCompleted, completed)} className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${completed.includes(patient.id) ? "bg-emerald-100 text-emerald-700" : patient.status === "Ready" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{completed.includes(patient.id) ? "Checked in" : patient.status}</button><button onClick={() => setQuery(`Actions for ${patient.name}`)} aria-label={`More actions for ${patient.name}`} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><MoreHorizontal className="h-4 w-4" /></button></div>)}</div></WorkspaceFrame>;

  if (activeNav === "Patients") return <WorkspaceFrame title="Patients" description="Search and open the longitudinal record for any patient in your clinic." action="Register patient" onAction={() => setQuery("Registering a new patient...")}><div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by patient name or ID" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0f766e]" /></div><div className="grid gap-3 md:grid-cols-2">{patients.filter((patient) => `${patient.name} ${patient.id}`.toLowerCase().includes(query.toLowerCase())).map((patient) => <button key={patient.id} onClick={() => setQuery(`Opened ${patient.name}`)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#9bd3ca] hover:shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${patient.tone}`}>{patient.initials}</span><span className="flex-1"><span className="block font-semibold text-slate-800">{patient.name}</span><span className="mt-1 block text-xs text-slate-500">{patient.age} years · {patient.reason}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}</div></WorkspaceFrame>;

  if (activeNav === "Reports") return <WorkspaceFrame title="Reports" description="Review extracted results and keep every document linked to the patient story." action="Upload report" onAction={() => setReviewed([...reviewed, "upload"])}><div className="mb-5 flex flex-wrap gap-2"><FilterButton label="All reports" active /><FilterButton label="Needs review" /><FilterButton label="Reviewed" /></div><div className="grid gap-3 md:grid-cols-2">{["Lipid profile · Rahul Sharma", "CBC · Vikram Nair", "HbA1c · Ananya Kapoor", "Thyroid panel · Sneha Patel"].map((report, index) => { const id = `report-${index}`; return <div key={report} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-600"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{report}</p><p className="mt-1 text-xs text-slate-400">Extracted today · Source document attached</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${reviewed.includes(id) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{reviewed.includes(id) ? "Reviewed" : "Needs review"}</span></div><button onClick={() => toggleItem(id, setReviewed, reviewed)} className="mt-4 flex items-center gap-2 text-xs font-bold text-[#0f766e] hover:underline">{reviewed.includes(id) ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{reviewed.includes(id) ? "Mark for re-review" : "Review extracted values"}</button></div>; })}</div></WorkspaceFrame>;

  if (activeNav === "Prescriptions") return <WorkspaceFrame title="Prescriptions" description="Review safety checks before an authorized doctor signs a prescription." action="New prescription" onAction={() => setReviewed([...reviewed, "new"])}><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-sm font-bold text-amber-900">2 prescriptions need review</p><p className="mt-1 text-xs text-amber-800/80">AI can prepare and check prescriptions, but a doctor must review and sign.</p></div></div></div><div className="mt-4 space-y-3">{["Rahul Sharma · Amlodipine 5 mg", "Vikram Nair · Metformin 500 mg", "Sneha Patel · Cetirizine 10 mg"].map((prescription, index) => { const id = `rx-${index}`; return <div key={prescription} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><Pill className="h-4 w-4" /></span><span className="min-w-[180px] flex-1"><span className="block text-sm font-bold text-slate-800">{prescription}</span><span className="mt-1 block text-xs text-slate-400">Allergy and interaction check complete</span></span><span className="text-[10px] font-bold text-emerald-600">No alerts</span><button onClick={() => toggleItem(id, setReviewed, reviewed)} className={`rounded-lg px-3 py-2 text-xs font-bold ${reviewed.includes(id) ? "bg-emerald-100 text-emerald-700" : "bg-[#0f766e] text-white hover:bg-[#0b625b]"}`}>{reviewed.includes(id) ? "Reviewed" : "Review & sign"}</button></div>; })}</div></WorkspaceFrame>;

  if (activeNav === "Follow-ups") return <WorkspaceFrame title="Follow-ups" description="Make sure every next step stays connected to the patient story." action="Create follow-up" onAction={() => setCompleted([...completed, "new-follow-up"])}><div className="grid gap-4 md:grid-cols-3"><MetricCard label="Due this week" value="7" detail="2 overdue" tone="amber" icon={ClipboardList} /><MetricCard label="Completed" value="18" detail="92% completion rate" tone="teal" icon={Check} /><MetricCard label="Referrals open" value="3" detail="1 awaiting consent" tone="sky" icon={FileText} /></div><div className="mt-5 space-y-3">{["Blood pressure review · Rahul Sharma", "Repeat lipid profile · Vikram Nair", "Specialist referral consent · Sneha Patel"].map((followUp, index) => { const id = `follow-${index}`; return <button key={followUp} onClick={() => toggleItem(id, setCompleted, completed)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#9bd3ca]"><span className={`h-2.5 w-2.5 rounded-full ${completed.includes(id) ? "bg-emerald-500" : index === 0 ? "bg-rose-500" : "bg-amber-400"}`} /><span className="flex-1"><span className={`block text-sm font-bold ${completed.includes(id) ? "text-slate-400 line-through" : "text-slate-800"}`}>{followUp}</span><span className="mt-1 block text-xs text-slate-400">{completed.includes(id) ? "Completed just now" : index === 0 ? "Due today" : "Due in 4 days"}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>; })}</div></WorkspaceFrame>;

  if (activeNav === "Analytics") return <WorkspaceFrame title="Practice analytics" description="Understand patient flow, clinical workload and task completion." action="Export report" onAction={() => setPeriod("Export ready")}><div className="mb-5 flex gap-2">{["This week", "This month", "This quarter"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${period === item ? "bg-[#0f766e] text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{item}</button>)}</div><div className="grid gap-4 md:grid-cols-3"><MetricCard label="Consultations" value="118" detail="+12% vs previous period" tone="teal" icon={Users} /><MetricCard label="Avg. wait time" value="14m" detail="-6m vs previous period" tone="sky" icon={CalendarDays} /><MetricCard label="Task completion" value="92%" detail="+4% vs previous period" tone="violet" icon={Activity} /></div><div className="mt-5 rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Consultation volume</h3><span className="text-xs text-slate-400">{period}</span></div><div className="mt-6 flex h-40 items-end gap-3">{[46, 62, 54, 82, 68, 94, 76].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-[#9bd3ca] transition hover:bg-[#0f766e]" style={{ height: `${height}%` }} /><span className="text-[10px] text-slate-400">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>)}</div></div></WorkspaceFrame>;

  if (activeNav === "Settings") return <WorkspaceFrame title="Settings & governance" description="Control clinic access, AI review rules and communication preferences." action="Save changes" onAction={() => setCompleted([...completed, "settings"])}><div className="max-w-2xl divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{[{ id: "aiReview", title: "Require human review for AI output", detail: "AI-generated notes and messages stay drafts until authorized review." }, { id: "reminders", title: "Follow-up reminders", detail: "Notify assigned staff when a follow-up is due or overdue." }, { id: "messages", title: "Patient message suggestions", detail: "Allow AI to prepare replies for review in the inbox." }].map((setting) => <div key={setting.id} className="flex items-center gap-4 p-4"><span className="flex-1"><span className="block text-sm font-bold text-slate-800">{setting.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{setting.detail}</span></span><button onClick={() => setEnabled({ ...enabled, [setting.id]: !enabled[setting.id] })} aria-label={`Toggle ${setting.title}`} className={`relative h-6 w-11 rounded-full transition ${enabled[setting.id] ? "bg-[#0f766e]" : "bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled[setting.id] ? "left-6" : "left-1"}`} /></button></div>)}</div></WorkspaceFrame>;

  return <WorkspaceFrame title={title} description={description} action="Open priority item" onAction={() => setCompleted([...completed, "inbox"])}><div className="space-y-3">{["Lab report needs review · Rahul Sharma", "Patient message awaiting response · Ananya Kapoor", "Referral document ready for approval · Sneha Patel", "Follow-up task overdue · Vikram Nair"].map((item, index) => { const id = `inbox-${index}`; return <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className={`rounded-lg p-2 ${index === 0 ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600"}`}><MessageSquareText className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-bold text-slate-800">{item}</span><span className="mt-1 block text-xs text-slate-400">{index === 0 ? "Urgent · 8 minutes ago" : "Clinical · Today"}</span></span><button onClick={() => toggleItem(id, setCompleted, completed)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#9bd3ca] hover:text-[#0f766e]">{completed.includes(id) ? "Resolved" : "Open"}</button></div>; })}</div></WorkspaceFrame>;
}

function WorkspaceFrame({ title, description, action, onAction, children }: { title: string; description: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <div><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">Workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={onAction} className="flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0b625b]"><Plus className="h-4 w-4" />{action}</button></div>{children}</div>;
}

function FilterButton({ label, active = false }: { label: string; active?: boolean }) { const [selected, setSelected] = useState(active); return <button onClick={() => setSelected(!selected)} className={`rounded-lg px-3 py-2 text-xs font-bold ${selected ? "bg-[#e3f3f0] text-[#0f766e]" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"}`}>{label}</button>; }
function ListHeader({ labels }: { labels: string[] }) { return <div className="grid grid-cols-[1.5fr_1.3fr_0.8fr_0.9fr_32px] gap-3 bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{labels.map((label) => <span key={label}>{label}</span>)}</div>; }

function PatientPanel({ tab, reviewed }: { tab: string; reviewed: boolean }) {
  if (tab === "Timeline") return <div className="space-y-4 p-5"><PanelTitle title="Longitudinal timeline" action="Add event" /><TimelineItem date="28 Aug 2026" title="Follow-up consultation" detail="Blood pressure trending down. Medication adherence discussed." /><TimelineItem date="14 Jul 2026" title="Lab report reviewed" detail="Lipid profile added to patient record and compared with May results." /><TimelineItem date="02 Jun 2026" title="Prescription updated" detail="Amlodipine 5mg continued. Next review scheduled." /></div>;
  if (tab === "Reports") return <div className="space-y-3 p-5"><PanelTitle title="Reports & lab results" action="Upload report" /><ReportRow title="Complete blood count" date="28 Aug 2026" status="Reviewed" /><ReportRow title="Lipid profile" date="28 Aug 2026" status="Needs review" /><ReportRow title="HbA1c" date="14 Jul 2026" status="Reviewed" /></div>;
  if (tab === "Prescriptions") return <div className="space-y-3 p-5"><PanelTitle title="Current medications" action="Add medication" /><MedicationRow name="Amlodipine" detail="5 mg · Once daily · Active" safe /><MedicationRow name="Atorvastatin" detail="10 mg · At night · Active" safe /><div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700"><ShieldCheck className="h-4 w-4" /> No interaction alerts for current medications</div></div>;
  if (tab === "Follow-ups") return <div className="space-y-3 p-5"><PanelTitle title="Follow-up plan" action="Schedule follow-up" /><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Due 24 Sep 2026</p><p className="mt-1 text-sm font-semibold text-slate-800">Blood pressure review</p><p className="mt-1 text-xs text-slate-500">Check home readings and medication adherence.</p></div></div>;
  return <div className="grid gap-5 p-5 md:grid-cols-[1.3fr_0.7fr]"><div><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f766e]">AI patient brief</p><h3 className="mt-1 text-base font-bold text-slate-900">A stable follow-up with one item to verify</h3></div>{reviewed ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check className="h-3.5 w-3.5" /> Reviewed</span> : <span className="rounded bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">AI-GENERATED</span>}</div><p className="mt-3 text-sm leading-relaxed text-slate-600">Rahul&apos;s blood pressure has improved across the last three visits. Current medication appears well tolerated. Confirm home readings before deciding whether the current plan should continue.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Source-linked · 3 visits</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Confidence · High</span></div></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Vitals snapshot</p><div className="mt-3 space-y-3"><Vital label="Blood pressure" value="128/82" change="-8 / -4" /><Vital label="Heart rate" value="74 bpm" change="Stable" /><Vital label="Weight" value="78.4 kg" change="-1.2 kg" /></div></div></div>;
}

function PanelTitle({ title, action }: { title: string; action: string }) { const [clicked, setClicked] = useState(false); return <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">{title}</h3><button onClick={() => setClicked(!clicked)} className="flex items-center gap-1 text-xs font-bold text-[#0f766e] hover:underline"><Plus className="h-3.5 w-3.5" />{clicked ? "Ready" : action}</button></div>; }
function TimelineItem({ date, title, detail }: { date: string; title: string; detail: string }) { return <div className="relative border-l-2 border-[#cde8e3] pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#0f766e]" /><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{date}</p><p className="mt-1 text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function ReportRow({ title, date, status }: { title: string; date: string; status: string }) { const [opened, setOpened] = useState(false); return <button onClick={() => setOpened(!opened)} className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"><span className="rounded-lg bg-sky-50 p-2 text-sky-600"><FileText className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="block text-[11px] text-slate-400">Uploaded {date}</span></span><span className={`text-[10px] font-bold ${opened || status === "Reviewed" ? "text-emerald-600" : "text-amber-600"}`}>{opened ? "Opened" : status}</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>; }
function MedicationRow({ name, detail, safe }: { name: string; detail: string; safe: boolean }) { return <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><Pill className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-semibold text-slate-800">{name}</span><span className="block text-[11px] text-slate-400">{detail}</span></span>{safe && <ShieldCheck className="h-4 w-4 text-emerald-500" />}</div>; }
function Vital({ label, value, change }: { label: string; value: string; change: string }) { return <div className="flex items-end justify-between"><span className="text-xs text-slate-500">{label}</span><span className="text-right"><span className="block text-sm font-bold text-slate-800">{value}</span><span className="text-[10px] font-semibold text-emerald-600">{change}</span></span></div>; }






