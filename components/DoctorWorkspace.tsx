"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import {
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Languages,
  Mic,
  NotebookTabs,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

const stats = [
  { label: "Patients today", value: "12", detail: "↗ 18% vs last Tuesday", icon: Users, tone: "bg-[#eef7f2] text-[#4f9d78]" },
  { label: "Notes completed", value: "08", detail: "↗ 24% this week", icon: FileText, tone: "bg-[#f6f0e9] text-[#bd865b]" },
  { label: "Time saved", value: "2h 14m", detail: "AI-assisted documentation", icon: Clock3, tone: "bg-[#edf2f8] text-[#6682a5]" },
  { label: "Next appointment", value: "10:30 AM", detail: "Rohan Mehta · Follow-up", icon: CalendarDays, tone: "bg-[#f4eef7] text-[#9773a4]" },
];

const waveform = [18, 34, 27, 45, 22, 38, 31, 52, 24, 40, 29, 47, 20, 35, 26, 44, 30, 55, 23, 39, 28, 48, 21, 34, 27, 43, 19, 37];

export default function DoctorWorkspace() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [language, setLanguage] = useState("हिन्दी");
  const [search, setSearch] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [symptomResult, setSymptomResult] = useState("");
  const [question, setQuestion] = useState("");
  const [copilotResult, setCopilotResult] = useState("");
  const [uploadedFile, setUploadedFile] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function checkSymptoms() {
    if (!symptoms.trim()) return;
    setSymptomResult("Demo guidance ready: review duration, severity, and red-flag symptoms with the patient.");
  }

  function WorkspaceScreen({ activeNav, onNavigate }: { activeNav: string; onNavigate: (nav: string) => void }) {
    const [query, setQuery] = useState("");
    const [added, setAdded] = useState(false);
    const [saved, setSaved] = useState(false);
    const [revisitReport, setRevisitReport] = useState("");
    const [reportUpdated, setReportUpdated] = useState(false);
    const [reportAnalyzed, setReportAnalyzed] = useState(false);
    const [reportSummary, setReportSummary] = useState(false);
    const revisitFileInput = useRef<HTMLInputElement>(null);

    const screenData: Record<string, { eyebrow: string; title: string; description: string }> = {
      Patients: { eyebrow: "PATIENT DIRECTORY", title: "Patients", description: "Review patient records, appointments, and care status." },
      "AI Scribe": { eyebrow: "CLINICAL DOCUMENTATION", title: "AI Scribe", description: "Capture a consultation and turn it into a structured SOAP note." },
      "Clinical insights": { eyebrow: "CLINICAL INTELLIGENCE", title: "Clinical insights", description: "Explore evidence-linked summaries and decision support." },
      "Symptom checker": { eyebrow: "PATIENT-FACING AI", title: "Symptom checker", description: "Organise symptoms before a visit for a focused consultation." },
      "Medical records": { eyebrow: "DOCUMENT INTELLIGENCE", title: "Medical records", description: "Find reports, prescriptions, and source-linked clinical documents." },
    };
    const data = screenData[activeNav] ?? screenData.Patients;

    return (
      <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-8 md:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-[#e2ebe6] pb-8 lg:flex-row lg:items-end">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5a9b88]">{data.eyebrow}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[#173f3c]">{data.title}</h1><p className="mt-2 text-sm text-[#78908a]">{data.description}</p></div>
          <button onClick={() => setAdded(!added)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-3 text-sm font-bold text-white hover:bg-[#057e6d]"><Plus className="h-4 w-4" /> {added ? "Added to workspace" : activeNav === "Patients" ? "Add patient" : "Create new"}</button>
        </div>

        {activeNav === "Patients" && <section className="mt-8 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#e1e9e5] bg-white px-4 py-3"><Search className="h-4 w-4 text-[#91a49e]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name or ID" className="flex-1 text-sm outline-none placeholder:text-[#a0b0ab]" /></div>
          {[
            ["Rohan Mehta", "RM-102", "Follow-up today · 10:30 AM", "Stable"],
            ["Ananya Kapoor", "AK-118", "Annual wellness review · 11:00 AM", "Waiting"],
            ["Vikram Nair", "VN-306", "Lab results review · 11:30 AM", "In review"],
          ].filter(([name, id]) => `${name} ${id}`.toLowerCase().includes(query.toLowerCase())).map(([name, id, detail, status]) => <button key={id} onClick={() => onNavigate("Medical records")} className="flex w-full items-center gap-4 rounded-xl border border-[#e1e9e5] bg-white p-4 text-left hover:border-[#9ac8b8]"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f3ed] text-sm font-bold text-[#4e927d]">{name.split(" ").map((part) => part[0]).join("")}</span><span className="flex-1"><strong className="block text-sm text-[#244642]">{name}</strong><span className="mt-1 block text-xs text-[#82958f]">{id} · {detail}</span></span><span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[11px] font-bold text-[#5a967e]">{status}</span><ChevronRight className="h-4 w-4 text-[#9ab0a9]" /></button>)}
        </section>}

        {activeNav === "AI Scribe" && <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl bg-[#124b47] p-7 text-white"><Mic className="h-7 w-7 text-[#9be2cb]" /><h2 className="mt-6 text-2xl font-bold">Ready to capture your consultation</h2><p className="mt-2 text-sm text-[#b8d2ce]">Start recording when the patient is ready. You can review every generated section before saving.</p><div className="mt-10 flex items-center gap-3"><button onClick={() => setSaved(!saved)} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#124b47]">{saved ? "Recording saved" : "Start recording"}</button><span className="text-xs text-[#a7d9cd]">Demo mode - no audio is stored</span></div></div><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h3 className="font-bold text-[#244642]">SOAP note preview</h3><div className="mt-5 space-y-4 text-sm"><p><strong className="text-[#5a967e]">Subjective</strong><br /><span className="text-[#82958f]">Patient reports improved symptoms since last visit.</span></p><p><strong className="text-[#5a967e]">Objective</strong><br /><span className="text-[#82958f]">Vitals and examination findings will appear here.</span></p><p><strong className="text-[#5a967e]">Assessment and plan</strong><br /><span className="text-[#82958f]">Review and approve AI suggestions before signing.</span></p></div></div></section>}

        {(activeNav === "Clinical insights" || activeNav === "Symptom checker" || activeNav === "Medical records") && <section className="mt-8 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h2 className="text-lg font-bold text-[#244642]">{activeNav === "Medical records" ? "Recent documents" : activeNav === "Symptom checker" ? "Patient symptom intake" : "Today's clinical brief"}</h2><p className="mt-2 text-sm leading-6 text-[#82958f]">{activeNav === "Medical records" ? "CBC, lipid profile, prescriptions, and referral notes are ready to review." : activeNav === "Symptom checker" ? "Enter symptoms to create a structured pre-visit summary." : "Three follow-ups need review. One report has a new source-linked insight."}</p>{activeNav === "Symptom checker" ? <textarea placeholder="Describe symptoms, duration, and severity..." className="mt-5 h-28 w-full rounded-lg border border-[#e1e9e5] p-3 text-sm outline-none focus:border-[#8fc5b3]" /> : <button onClick={() => setSaved(!saved)} className="mt-6 rounded-lg bg-[#eaf6f0] px-4 py-2 text-xs font-bold text-[#4f927a]">{saved ? "Marked reviewed" : "Mark as reviewed"}</button>}</div><div className="rounded-2xl bg-[#e6f4ee] p-6"><ShieldCheck className="h-6 w-6 text-[#4f927a]" /><h3 className="mt-5 font-bold text-[#244642]">Human review remains in control</h3><p className="mt-2 text-sm leading-6 text-[#6f8d83]">AI suggestions are illustrative. Verify source records before taking clinical action.</p></div></section>}

        {activeNav === "Medical records" && <section className="mt-4 rounded-2xl border border-[#e1e9e5] bg-white p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b0805e]">REVISIT WORKFLOW</p><h2 className="mt-2 text-xl font-bold text-[#244642]">Update and analyse Rohan&apos;s latest test report</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#82958f]">Upload the report from today&apos;s revisit. The system keeps it linked to the patient timeline, compares it with the previous result, and prepares a reviewable doctor summary.</p></div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${reportUpdated ? "bg-[#e3f5ec] text-[#4f927a]" : "bg-[#f5f0e9] text-[#a27d5b]"}`}>{reportUpdated ? "Record updated" : "Awaiting report"}</span>
          </div>
          <input ref={revisitFileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setRevisitReport(event.target.files?.[0]?.name ?? "")} className="hidden" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <button onClick={() => revisitFileInput.current?.click()} className="flex min-h-[112px] items-center gap-4 rounded-xl border border-dashed border-[#cbded5] bg-[#f8fcfa] p-5 text-left hover:border-[#75b79d]"><span className="rounded-xl bg-[#e7f4ed] p-3 text-[#5a967e]"><UploadCloud className="h-5 w-5" /></span><span><strong className="block text-sm text-[#315a52]">{revisitReport || "Upload a new test report"}</strong><span className="mt-1 block text-xs text-[#82958f]">PDF or image · CBC, lipid profile, HbA1c, or other revisit report</span></span></button>
            <button disabled={!revisitReport} onClick={() => setReportUpdated(true)} className="rounded-xl bg-[#eaf6f0] px-5 py-3 text-xs font-bold text-[#4f927a] enabled:hover:bg-[#dcefe5] disabled:cursor-not-allowed disabled:opacity-50">{reportUpdated ? "Updated in timeline" : "Update patient record"}</button>
          </div>
          {reportUpdated && <div className="mt-5 rounded-xl border border-[#d9e9e1] bg-[#fbfdfc] p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-xs font-bold text-[#315a52]">{revisitReport}</p><p className="mt-1 text-[11px] text-[#82958f]">Added to Rohan Mehta&apos;s revisit · Previous report: 28 Aug 2026</p></div><span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[10px] font-bold text-[#5a967e]">New result</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setReportAnalyzed(true)} className="rounded-lg bg-[#124b47] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d3e3b]">{reportAnalyzed ? "Analysis complete" : "Analyse changes"}</button><button disabled={!reportAnalyzed} onClick={() => setReportSummary(true)} className="rounded-lg border border-[#cbded5] px-4 py-2 text-xs font-bold text-[#4f927a] enabled:hover:bg-[#edf7f2] disabled:cursor-not-allowed disabled:opacity-50">{reportSummary ? "Summary ready" : "Summarise for doctor"}</button></div>{reportAnalyzed && <div className="mt-4 grid gap-3 rounded-lg bg-[#f1f7f3] p-4 text-xs text-[#5f7c70] md:grid-cols-3"><span><strong className="block text-[#315a52]">Trend</strong>HbA1c improved by 0.6%</span><span><strong className="block text-[#315a52]">Flag</strong>LDL remains above target</span><span><strong className="block text-[#315a52]">Confidence</strong>High · 2 linked reports</span></div>}{reportSummary && <div className="mt-4 rounded-lg border-l-4 border-[#65a889] bg-white p-4 text-sm leading-6 text-[#527167]"><strong className="text-[#315a52]">Doctor summary:</strong> Compared with the previous report, glycaemic control is improving. LDL remains elevated and should be reviewed alongside adherence, diet, and the current statin plan at today&apos;s revisit.</div>}</div>}
        </section>}
      </div>
    );
  }

  function askCopilot() {
    if (!question.trim()) return;
    setCopilotResult("Start with the patient timeline, current medications, and any red flags before deciding next steps.");
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setUploadedFile(file.name);
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[292px] md:px-6 md:py-9">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#078d79] text-white shadow-[0_8px_16px_rgba(7,141,121,0.18)]"><Stethoscope className="h-6 w-6" /></span>
          <span className="hidden text-[23px] font-bold tracking-[-0.06em] text-[#193d3a] md:inline">AI Doctor <span className="text-[#07947f]">OS</span></span>
        </Link>
        <p className="mt-10 hidden px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#86a09a] md:mt-16 md:block">Workspace</p>
        <nav className="mt-5 space-y-2">
          {[
            { label: "Overview", icon: LayoutDashboard },
            { label: "Patients", icon: Users },
            { label: "AI Scribe", icon: Mic },
            { label: "Clinical insights", icon: BrainCircuit, badge: "NEW" },
            { label: "Symptom checker", icon: HeartPulse },
            { label: "Medical records", icon: NotebookTabs },
          ].map(({ label, icon: Icon, badge }) => (
            <button key={label} onClick={() => setActiveNav(label)} aria-label={label} className={`flex w-full items-center justify-center gap-4 rounded-xl px-3 py-3.5 text-left text-[16px] font-semibold transition md:justify-start md:px-4 ${activeNav === label ? "bg-[#153f3c] text-white shadow-[0_10px_20px_rgba(21,63,60,0.14)]" : "text-[#6c8782] hover:bg-white/60 hover:text-[#315d57]"}`}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden flex-1 md:inline">{label}</span>
              {badge && <span className="hidden rounded bg-[#a9e6d2] px-1.5 py-0.5 text-[9px] font-bold text-[#27806b] md:inline">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <button aria-label="Demo workspace" className="w-full rounded-xl border border-[#c5e9dd] bg-[#d8f3e8] p-3 text-left transition hover:bg-[#cceee0] md:p-4">
            <span className="flex items-center justify-center gap-3 text-sm font-bold text-[#078b78] md:justify-start"><Sparkles className="h-5 w-5" /><span className="hidden md:inline">Demo workspace</span></span>
            <span className="mt-1 hidden pl-8 text-xs text-[#6d958b] md:block">Explore AI UPCHAR</span>
          </button>
          <button aria-label="Dr. Ananya Arya profile" className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl p-1 text-left hover:bg-white/60 md:justify-start">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d5eee4] text-xs font-bold text-[#277a6b]">DA</span>
            <span className="hidden flex-1 md:block"><strong className="block text-sm text-[#214440]">Dr. Ananya Arya</strong><span className="mt-1 block text-xs text-[#78918c]">General Medicine</span></span>
            <ChevronRight className="h-5 w-5 text-[#87aaa0]" />
          </button>
        </div>
      </aside>

      <div className="ml-[78px] md:ml-[292px]">
      <header className="border-b border-[#e4ebe7] bg-[#fbfdfc]">
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-3 px-3 sm:gap-5 sm:px-5 md:px-10">
          <Link href="/" className="hidden shrink-0 items-center text-[17px] font-bold tracking-[-0.04em] sm:flex">
            AI Doctor <span className="text-[#07947f]">&nbsp;OS</span>
          </Link>
          <div className="relative flex max-w-[430px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8da09b]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search patients or records" placeholder="Search patients or records" className="h-10 w-full rounded-xl border-0 bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-[#94a39f]" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setLanguage(language === "हिन्दी" ? "English" : "हिन्दी")} aria-label="Change language" className="flex items-center gap-2 rounded-lg border border-[#e4ebe7] px-2.5 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3] sm:px-3"><Languages className="h-4 w-4" /><span className="hidden sm:inline">{language}</span></button>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#164642] text-xs font-bold text-white">DA</span>
          </div>
        </div>
      </header>

      {activeNav === "Overview" ? <div className="mx-auto max-w-[1280px] overflow-hidden px-4 pb-12 pt-6 sm:px-5 md:px-10 md:pt-8">
        <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78908a]">Tuesday, 24 June 2025 <span className="mx-2 text-[#0b9c87]">•</span> Live clinic</p>
            <h1 className="mt-3 text-[28px] font-bold tracking-[-0.05em] text-[#173f3c] sm:text-3xl md:text-[40px]">Good morning, Dr. Arya</h1>
            <p className="mt-2 text-sm text-[#78908a]">Here&apos;s what&apos;s happening in your clinic today.</p>
          </div>
          <button onClick={() => setSessionStarted(!sessionStarted)} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#07947f] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(7,148,127,0.18)] transition hover:bg-[#057e6d] lg:w-fit">
            {sessionStarted ? <Check className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {sessionStarted ? "Session active" : "Start new session"}
            {sessionStarted ? <X className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </button>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className={`relative h-[121px] rounded-xl border border-[#e1e9e5] p-4 ${label === "Next appointment" ? "bg-[#dff4ec]" : "bg-white"}`}>
              <div className="flex items-start justify-between"><p className="text-xs font-semibold text-[#6d827c]">{label}</p><span className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></span></div>
              <p className="absolute left-4 top-[52px] text-2xl font-bold tracking-[-0.03em] text-[#173f3c]">{value}</p>
              <p className="absolute bottom-4 left-4 text-[11px] text-[#77908a]">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold tracking-[-0.03em]">Your clinical command centre</h2><p className="mt-1 text-sm text-[#818b85]">Everything you need, in one calm place.</p></div><button onClick={() => setActiveNav("Patients")} className="hidden items-center gap-1 text-xs font-semibold text-[#56896d] hover:underline sm:flex">View all <ChevronRight className="h-3.5 w-3.5" /></button></div>

          <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <article className="min-h-[235px] rounded-2xl bg-[#124b47] p-6 text-white">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8bd4be]">Live scribe</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Stay present. Let AI take notes.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#b8d2ce]">Turn your consultation into a structured SOAP note in seconds.</p></div><span className="rounded-full bg-[#2c7069] p-4 text-[#a5e4d0]"><Mic className="h-5 w-5" /></span></div>
              <div className="mt-8 flex h-14 items-center gap-1" role="img" aria-label={scribeOpen ? "Voice recording in progress" : "Voice frequency preview"}>
                {waveform.map((height, index) => <span key={`${height}-${index}`} className={`w-1 rounded-full transition-all duration-300 ${index % 3 === 0 ? "bg-[#4fc4a7]" : "bg-[#8ed8c2]"} ${scribeOpen ? "animate-pulse" : ""}`} style={{ height: `${height}px`, animationDelay: `${index * 45}ms` }} />)}
              </div>
              <div className="mt-4 border-t border-[#39706a] pt-4 flex items-center justify-between"><span className={`flex items-center gap-2 text-xs font-semibold ${scribeOpen ? "text-[#a7e4cb]" : "text-[#b8d2ce]"}`}><span className={`h-2 w-2 rounded-full ${scribeOpen ? "bg-[#72e5b5]" : "bg-[#79b6a7]"}`} />{scribeOpen ? "Listening to consultation" : "Ready to listen"}</span><button onClick={() => setScribeOpen(!scribeOpen)} className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#124b47] hover:bg-[#e6f5f0]">{scribeOpen ? "Pause scribe" : "Open scribe"} <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div>
            </article>

            <article className="min-h-[235px] rounded-2xl bg-[#f1e8df] p-6">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#b0805e]">Patient snapshot</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Rohan Mehta</h3><p className="mt-1 text-sm text-[#8d837a]">32 years · Male · Patient since 2023</p></div><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dfc6b0] text-xs font-bold text-[#8b654d]">RM</span></div>
              <div className="mt-6 grid grid-cols-2 gap-y-3 text-xs"><span className="text-[#a09083]">Last visit <strong className="mt-1 block font-semibold text-[#655e57]">18 Jun 2025</strong></span><span className="text-[#a09083]">Blood group <strong className="mt-1 block font-semibold text-[#655e57]">B+</strong></span><span className="text-[#a09083]">Follow-up scheduled <strong className="mt-1 block font-semibold text-[#655e57]">Today, 10:30 AM</strong></span><span className="text-[#a09083]">Prescription updated <strong className="mt-1 block font-semibold text-[#655e57]">18 Jun 2025</strong></span></div>
              <button onClick={() => setActiveNav("Patients")} className="mt-5 flex items-center gap-1 text-xs font-bold text-[#9b704f] hover:underline">Open patient record <ChevronRight className="h-3.5 w-3.5" /></button>
            </article>

            <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#7ca28d]">Patient-facing AI</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Symptom checker</h3><p className="mt-2 text-sm text-[#818b85]">Help patients organise what they&apos;re feeling before a visit.</p></div><HeartPulse className="h-5 w-5 text-[#82ae96]" /></div>
              <div className="mt-6 flex gap-2"><input value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="e.g. headache, mild fever for two days..." className="min-w-0 flex-1 rounded-lg border border-[#e5e8e3] bg-[#fbfcfa] px-3 py-2.5 text-xs outline-none focus:border-[#9fbea9]" /><button onClick={checkSymptoms} className="rounded-lg bg-[#ebf4ed] px-3 text-xs font-bold text-[#5c916e] hover:bg-[#dceee1]">Check symptoms</button></div>
              {symptomResult && <p className="mt-3 rounded-lg bg-[#f1f7f2] p-3 text-xs leading-5 text-[#65806e]">{symptomResult}</p>}
            </article>

            <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8a91b2]">Clinical intelligence</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Ask your medical copilot</h3><p className="mt-2 text-sm text-[#818b85]">Structure a question and get a clear starting point.</p></div><BrainCircuit className="h-5 w-5 text-[#8995bf]" /></div>
              <div className="mt-6 flex rounded-lg border border-[#e5e8e3] bg-[#fbfcfa] p-1"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && askCopilot()} placeholder="Ask about a case or guideline..." className="min-w-0 flex-1 bg-transparent px-2 text-xs outline-none" /><button onClick={askCopilot} aria-label="Ask copilot" className="rounded-md bg-[#e9edf7] p-2 text-[#6b7eac] hover:bg-[#dfe6f5]"><Send className="h-3.5 w-3.5" /></button></div>
              <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => setQuestion("Respiratory follow-up")} className="rounded-full bg-[#f5f5fa] px-3 py-1.5 text-[10px] font-semibold text-[#7b82a1]">Respiratory follow-up</button><button onClick={() => setQuestion("Red flags to document")} className="rounded-full bg-[#f5f5fa] px-3 py-1.5 text-[10px] font-semibold text-[#7b82a1]">Red flags to document</button></div>
              {copilotResult && <p className="mt-3 rounded-lg bg-[#f3f4fa] p-3 text-xs leading-5 text-[#687493]">{copilotResult}</p>}
            </article>

            <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6 lg:col-span-2">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#af8b66]">Document intelligence</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Summarise a medical document</h3><p className="mt-2 text-sm text-[#818b85]">Upload a PDF and get the key points at a glance.</p></div><FileText className="h-5 w-5 text-[#bd956d]" /></div>
              <input ref={fileInput} type="file" accept=".pdf,application/pdf" onChange={handleFile} className="hidden" />
              <button onClick={() => fileInput.current?.click()} className="mt-6 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#d9ddd7] bg-[#fbfcfa] px-4 py-7 text-center hover:border-[#a9c0ae]"><UploadCloud className="h-6 w-6 text-[#a8b8ad]" /><span className="mt-2 text-xs font-semibold text-[#7d8b82]">{uploadedFile || "Drop a PDF here or browse"}</span><span className="mt-1 text-[10px] text-[#a4ada7]">PDF up to 10 MB · DEMO MODE</span></button>
              <div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] text-[#8b958e]"><ShieldCheck className="h-4 w-4 text-[#76a287]" /> Your data stays private</span><button disabled={!uploadedFile} onClick={() => setSymptomResult(`Summary ready for ${uploadedFile}. Key findings are available for clinician review.`)} className="rounded-lg bg-[#f2eee8] px-4 py-2 text-xs font-bold text-[#a2876c] enabled:hover:bg-[#e9dfd2] disabled:cursor-not-allowed disabled:opacity-50">Summarise document</button></div>
            </article>
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-2 border-t border-[#e8e8e2] pt-6 text-xs text-[#9aa39d] sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 font-semibold text-[#707b74]"><HeartPulse className="h-4 w-4 text-[#76a287]" /> AI UPCHAR</span><span>Designed for focused care <span className="text-[#d89182]">♥</span></span><span>DEMO MODE · AI responses are simulated</span></footer>
      </div> : <WorkspaceScreen activeNav={activeNav} onNavigate={setActiveNav} />}
      </div>
    </main>
  );
}
