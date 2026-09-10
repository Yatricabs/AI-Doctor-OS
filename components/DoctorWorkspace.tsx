"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
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
  Settings,
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

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message: string } };

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "The demo service could not complete this request.");
  return payload.data;
}

export default function DoctorWorkspace() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [selectedPatientId, setSelectedPatientId] = useState("RM-102");
  const [language, setLanguage] = useState("हिन्दी");
  const [search, setSearch] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [symptomResult, setSymptomResult] = useState("");
  const [question, setQuestion] = useState("");
  const [copilotResult, setCopilotResult] = useState("");
  const [uploadedFile, setUploadedFile] = useState("");
  const [documentSummary, setDocumentSummary] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [summaryStats, setSummaryStats] = useState<typeof stats>(stats);
  const [serviceError, setServiceError] = useState("");

  useEffect(() => {
    apiRequest<{ summary: { stats: { label: string; value: string; detail: string }[] } }>("/api/workspace/summary")
      .then(({ summary }) => setSummaryStats(summary.stats.map((item, index) => ({ ...stats[index], ...item }))))
      .catch((error: unknown) => setServiceError(error instanceof Error ? error.message : "Workspace data is unavailable."));
  }, []);

  async function checkSymptoms() {
    if (!symptoms.trim()) return;
    try {
      const { analysis } = await apiRequest<{ analysis: { input: string; questions: string[]; triage: string; redFlags: string } }>("/api/symptom-analysis", { method: "POST", body: JSON.stringify({ symptoms }) });
      setSymptomResult(`For "${analysis.input}", ${analysis.questions.join(" ")} Demo triage: ${analysis.triage}. ${analysis.redFlags}`);
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Symptom analysis failed.");
    }
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
    const [profileSection, setProfileSection] = useState("Overview");
    const [patients, setPatients] = useState<{ id: string; name: string; initials: string; appointment: string; status: string }[]>([]);
    const [reports, setReports] = useState<{ id: string; patientId: string; title: string; type: string; date: string; status: string }[]>([]);
    const [screenLoading, setScreenLoading] = useState(false);
    const [screenError, setScreenError] = useState("");
    const [transcript, setTranscript] = useState("");
    const [scribeNote, setScribeNote] = useState("");
    const [insights, setInsights] = useState<{ id: string; title: string; detail: string; priority: string }[]>([]);
    const [profileForm, setProfileForm] = useState({ fullName: "Dr. Ananya Arya", specialty: "General Medicine", clinicBio: "Clinician focused on practical, preventive adult care." });
    const [accountForm, setAccountForm] = useState({ urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true });

    useEffect(() => {
      setScreenError("");
      if (activeNav === "Patients") {
        setScreenLoading(true);
        apiRequest<{ patients: typeof patients }>("/api/patients").then(({ patients: data }) => setPatients(data)).catch((error: unknown) => setScreenError(error instanceof Error ? error.message : "Patients could not be loaded.")).finally(() => setScreenLoading(false));
      }
      if (activeNav === "Medical records") {
        setScreenLoading(true);
        apiRequest<{ reports: typeof reports }>(`/api/medical-records/reports?patientId=${selectedPatientId}`).then(({ reports: data }) => setReports(data)).catch((error: unknown) => setScreenError(error instanceof Error ? error.message : "Medical records could not be loaded.")).finally(() => setScreenLoading(false));
      }
      if (activeNav === "Clinical insights") {
        setScreenLoading(true);
        apiRequest<{ insights: typeof insights }>("/api/insights").then(({ insights: data }) => setInsights(data)).catch((error: unknown) => setScreenError(error instanceof Error ? error.message : "Clinical insights could not be loaded.")).finally(() => setScreenLoading(false));
      }
      if (activeNav === "Profile") {
        apiRequest<{ settings: { fullName: string; specialty: string; clinicBio: string; notifications: typeof accountForm } }>("/api/profile/settings")
          .then(({ settings }) => { setProfileForm({ fullName: settings.fullName, specialty: settings.specialty, clinicBio: settings.clinicBio }); setAccountForm(settings.notifications); })
          .catch((error: unknown) => setScreenError(error instanceof Error ? error.message : "Profile settings could not be loaded."));
      }
    }, [activeNav, selectedPatientId]);

    async function queueWorkspaceAction(action: string) {
      try {
        await apiRequest("/api/workspace/actions", { method: "POST", body: JSON.stringify({ action }) });
        setAdded(true);
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Workspace action failed.");
      }
    }

    async function saveProfileSettings() {
      try {
        await apiRequest("/api/profile/settings", { method: "PATCH", body: JSON.stringify(profileForm) });
        setProfileSection("Overview");
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Profile settings could not be saved.");
      }
    }

    async function saveAccountSettings() {
      try {
        await apiRequest("/api/profile/settings", { method: "PATCH", body: JSON.stringify({ notifications: accountForm }) });
        setProfileSection("Overview");
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Account settings could not be saved.");
      }
    }

    async function generateScribeNote() {
      if (!transcript.trim()) return;
      setScreenLoading(true);
      try {
        const { note } = await apiRequest<{ note: { subjective: string; objective: string; assessment: string; plan: string } }>("/api/scribe", { method: "POST", body: JSON.stringify({ transcript, patientId: "RM-102" }) });
        setScribeNote(`${note.subjective} ${note.objective} ${note.assessment} ${note.plan}`);
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Scribe generation failed.");
      } finally {
        setScreenLoading(false);
      }
    }

    async function analyzeReport(reportId: string) {
      setReportAnalyzed(false);
      try {
        const { analysis } = await apiRequest<{ analysis: { trend: string; flag: string; confidence: string; summary: string } }>("/api/medical-records/analyze", { method: "POST", body: JSON.stringify({ patientId: selectedPatientId, reportId }) });
        setRevisitReport(`${analysis.trend} ${analysis.flag} ${analysis.confidence}`);
        setReportAnalyzed(true);
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Report analysis failed.");
      }
    }

    async function summarizeReport(reportId: string, title: string) {
      try {
        await apiRequest("/api/medical-records/summarize", { method: "POST", body: JSON.stringify({ reportId, title }) });
        setReportSummary(true);
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Report summary failed.");
      }
    }

    async function updateRevisitRecord() {
      const title = revisitFileInput.current?.files?.[0]?.name;
      if (!title) return;
      try {
        await apiRequest("/api/medical-records/reports", { method: "POST", body: JSON.stringify({ patientId: selectedPatientId, title, type: "Lab report" }) });
        setRevisitReport(title);
        setReportUpdated(true);
      } catch (error: unknown) {
        setScreenError(error instanceof Error ? error.message : "Report upload failed.");
      }
    }

    const screenData: Record<string, { eyebrow: string; title: string; description: string }> = {
      Patients: { eyebrow: "PATIENT DIRECTORY", title: "Patients", description: "Review patient records, appointments, and care status." },
      "AI Scribe": { eyebrow: "CLINICAL DOCUMENTATION", title: "AI Scribe", description: "Capture a consultation and turn it into a structured SOAP note." },
      "Clinical insights": { eyebrow: "CLINICAL INTELLIGENCE", title: "Clinical insights", description: "Explore evidence-linked summaries and decision support." },
      "Symptom checker": { eyebrow: "PATIENT-FACING AI", title: "Symptom checker", description: "Organise symptoms before a visit for a focused consultation." },
      "Medical records": { eyebrow: "DOCUMENT INTELLIGENCE", title: "Medical records", description: "Find reports, prescriptions, and source-linked clinical documents." },
      Profile: { eyebrow: "CLINICIAN PROFILE", title: "Dr. Ananya Arya", description: "Manage your professional profile, clinic preferences, and account settings." },
    };
    const data = screenData[activeNav] ?? screenData.Patients;

    return (
      <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-8 md:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-[#e2ebe6] pb-8 lg:flex-row lg:items-end">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5a9b88]">{data.eyebrow}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[#173f3c]">{data.title}</h1><p className="mt-2 text-sm text-[#78908a]">{data.description}</p></div>
          <button onClick={() => queueWorkspaceAction(activeNav === "Patients" ? "Add patient" : `Create ${activeNav}`)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-3 text-sm font-bold text-white hover:bg-[#057e6d]"><Plus className="h-4 w-4" /> {added ? "Action queued" : activeNav === "Patients" ? "Add patient" : "Create new"}</button>
        </div>

        {activeNav === "Patients" && <section className="mt-8 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#e1e9e5] bg-white px-4 py-3"><Search className="h-4 w-4 text-[#91a49e]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name or ID" className="flex-1 text-sm outline-none placeholder:text-[#a0b0ab]" /></div>
          {screenLoading && <p className="rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading patient directory from the clinic service...</p>}
          {patients.filter(({ name, id }) => `${name} ${id}`.toLowerCase().includes(query.toLowerCase())).map(({ name, id, appointment: detail, status, initials }) => <button key={id} onClick={() => { setSelectedPatientId(id); onNavigate("Medical records"); }} className="flex w-full items-center gap-4 rounded-xl border border-[#e1e9e5] bg-white p-4 text-left hover:border-[#9ac8b8]"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f3ed] text-sm font-bold text-[#4e927d]">{initials}</span><span className="flex-1"><strong className="block text-sm text-[#244642]">{name}</strong><span className="mt-1 block text-xs text-[#82958f]">{id} · {detail}</span></span><span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[11px] font-bold text-[#5a967e]">{status}</span><ChevronRight className="h-4 w-4 text-[#9ab0a9]" /></button>)}
        </section>}

        {activeNav === "Profile" && <section className="mt-8 grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-[#e1e9e5] bg-white p-4">
            <div className="flex items-center gap-3 border-b border-[#edf1ee] pb-5"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d5eee4] text-lg font-bold text-[#277a6b]">DA</span><div><strong className="block text-sm text-[#244642]">Dr. Ananya Arya</strong><span className="text-xs text-[#82958f]">General Medicine</span></div></div>
            <nav className="mt-4 space-y-1">{["Overview", "Profile settings", "Account settings"].map((section) => <button key={section} onClick={() => setProfileSection(section)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${profileSection === section ? "bg-[#e8f5ef] text-[#27806b]" : "text-[#78908a] hover:bg-[#f4f8f5]"}`}><Settings className="h-4 w-4" />{section}</button>)}</nav>
          </aside>
          <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6 md:p-8">
            {profileSection === "Overview" && <><div className="flex flex-col justify-between gap-4 border-b border-[#edf1ee] pb-6 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a9b88]">Professional profile</p><h2 className="mt-2 text-2xl font-bold text-[#244642]">Dr. Ananya Arya, MBBS, MD</h2><p className="mt-1 text-sm text-[#82958f]">General Medicine · 12 years of clinical experience</p></div><button onClick={() => setProfileSection("Profile settings")} className="rounded-lg bg-[#07947f] px-4 py-2 text-xs font-bold text-white hover:bg-[#057e6d]">Edit profile</button></div><div className="mt-6 grid gap-5 md:grid-cols-2"><div><h3 className="font-bold text-[#315a52]">Education & qualifications</h3><p className="mt-2 text-sm leading-6 text-[#82958f]">MBBS, AIIMS New Delhi · 2010<br />MD, Internal Medicine, PGIMER Chandigarh · 2014<br />Certificate in Diabetes Care · 2018</p></div><div><h3 className="font-bold text-[#315a52]">Specialities</h3><p className="mt-2 text-sm leading-6 text-[#82958f]">Preventive care, diabetes management, hypertension, thyroid disorders, and adult wellness.</p></div><div><h3 className="font-bold text-[#315a52]">Experience & clinic history</h3><p className="mt-2 text-sm leading-6 text-[#82958f]">Lead physician at AI UPCHAR Care Clinic since 2019. Previously consultant at CityCare Hospital, Bengaluru.</p></div><div><h3 className="font-bold text-[#315a52]">Achievements</h3><p className="mt-2 text-sm leading-6 text-[#82958f]">15,000+ consultations · 3 published clinical audits · 2024 Patient Care Excellence award.</p></div></div></>}
            {profileSection === "Profile settings" && <div><h2 className="text-xl font-bold text-[#244642]">Profile settings</h2><p className="mt-1 text-sm text-[#82958f]">Update the details shown to your care team and patients.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-[#5f7c70]">Full name<input value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} className="mt-2 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm font-normal text-[#244642] outline-none focus:border-[#8fc5b3]" /></label><label className="text-xs font-semibold text-[#5f7c70]">Speciality<input value={profileForm.specialty} onChange={(event) => setProfileForm({ ...profileForm, specialty: event.target.value })} className="mt-2 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm font-normal text-[#244642] outline-none focus:border-[#8fc5b3]" /></label><label className="text-xs font-semibold text-[#5f7c70] sm:col-span-2">Clinic bio<textarea value={profileForm.clinicBio} onChange={(event) => setProfileForm({ ...profileForm, clinicBio: event.target.value })} className="mt-2 h-24 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm font-normal text-[#244642] outline-none focus:border-[#8fc5b3]" /></label></div><button onClick={saveProfileSettings} className="mt-6 rounded-lg bg-[#07947f] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#057e6d]">Save profile changes</button></div>}
            {profileSection === "Account settings" && <div><h2 className="text-xl font-bold text-[#244642]">Account settings</h2><p className="mt-1 text-sm text-[#82958f]">Control sign-in, notifications, and workspace preferences.</p><div className="mt-6 space-y-3"><label className="flex items-center justify-between rounded-xl border border-[#edf1ee] p-4 text-sm text-[#315a52]"><span>Email notifications for urgent follow-ups</span><input type="checkbox" checked={accountForm.urgentFollowUps} onChange={(event) => setAccountForm({ ...accountForm, urgentFollowUps: event.target.checked })} className="h-4 w-4 accent-[#07947f]" /></label><label className="flex items-center justify-between rounded-xl border border-[#edf1ee] p-4 text-sm text-[#315a52]"><span>Weekly clinic performance summary</span><input type="checkbox" checked={accountForm.weeklySummary} onChange={(event) => setAccountForm({ ...accountForm, weeklySummary: event.target.checked })} className="h-4 w-4 accent-[#07947f]" /></label><label className="flex items-center justify-between rounded-xl border border-[#edf1ee] p-4 text-sm text-[#315a52]"><span>Two-step sign-in protection</span><input type="checkbox" checked={accountForm.twoStepSignIn} onChange={(event) => setAccountForm({ ...accountForm, twoStepSignIn: event.target.checked })} className="h-4 w-4 accent-[#07947f]" /></label></div><button onClick={saveAccountSettings} className="mt-6 rounded-lg bg-[#07947f] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#057e6d]">Save account settings</button></div>}
          </div>
        </section>}

        {activeNav === "AI Scribe" && <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl bg-[#124b47] p-7 text-white"><Mic className="h-7 w-7 text-[#9be2cb]" /><h2 className="mt-6 text-2xl font-bold">Ready to capture your consultation</h2><p className="mt-2 text-sm text-[#b8d2ce]">Send a consultation transcript to the serverless scribe service and review the generated SOAP draft.</p><textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste or dictate consultation notes..." className="mt-6 h-28 w-full rounded-lg border border-[#39706a] bg-[#0d3d3a] p-3 text-sm text-white outline-none placeholder:text-[#8bbeb1]" /><div className="mt-4 flex items-center gap-3"><button onClick={generateScribeNote} disabled={screenLoading || !transcript.trim()} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#124b47] disabled:cursor-not-allowed disabled:opacity-60">{screenLoading ? "Generating..." : "Generate SOAP draft"}</button><span className="text-xs text-[#a7d9cd]">Server response · clinician review required</span></div></div><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h3 className="font-bold text-[#244642]">SOAP note preview</h3><p className="mt-5 whitespace-pre-line text-sm leading-6 text-[#82958f]">{scribeNote || "Your server-generated draft will appear here after you submit a transcript."}</p></div></section>}

        {activeNav === "Clinical insights" && <section className="mt-8 grid gap-4 md:grid-cols-2">{insights.map((insight) => <article key={insight.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5a9b88]">{insight.priority} priority</p><h2 className="mt-2 text-lg font-bold text-[#244642]">{insight.title}</h2><p className="mt-2 text-sm leading-6 text-[#82958f]">{insight.detail}</p></div><button onClick={() => apiRequest("/api/insights", { method: "POST", body: JSON.stringify({ insightId: insight.id }) }).then(() => setInsights((current) => current.filter((item) => item.id !== insight.id))).catch((error: unknown) => setScreenError(error instanceof Error ? error.message : "Insight review failed."))} className="shrink-0 rounded-lg bg-[#eaf6f0] px-3 py-2 text-xs font-bold text-[#4f927a]">Mark reviewed</button></div></article>)}</section>}
        {activeNav === "Symptom checker" && <section className="mt-8 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h2 className="text-lg font-bold text-[#244642]">Patient symptom intake</h2><p className="mt-2 text-sm leading-6 text-[#82958f]">Enter symptoms to create a structured pre-visit summary from the serverless analysis endpoint.</p><textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Describe symptoms, duration, and severity..." className="mt-5 h-28 w-full rounded-lg border border-[#e1e9e5] p-3 text-sm outline-none focus:border-[#8fc5b3]" /><button onClick={checkSymptoms} className="mt-4 rounded-lg bg-[#07947f] px-4 py-2 text-xs font-bold text-white">Analyse symptoms</button>{symptomResult && <p className="mt-4 rounded-lg bg-[#f1f7f2] p-3 text-xs leading-5 text-[#65806e]">{symptomResult}</p>}</div><div className="rounded-2xl bg-[#e6f4ee] p-6"><ShieldCheck className="h-6 w-6 text-[#4f927a]" /><h3 className="mt-5 font-bold text-[#244642]">Human review remains in control</h3><p className="mt-2 text-sm leading-6 text-[#6f8d83]">The API organises information and triage prompts; it does not diagnose or replace clinical judgment.</p></div></section>}
        {activeNav === "Medical records" && <section className="mt-8 space-y-4"><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h2 className="text-lg font-bold text-[#244642]">Recent documents</h2><p className="mt-2 text-sm text-[#82958f]">Reports loaded from the medical records service for Rohan Mehta.</p>{screenLoading && <p className="mt-4 text-sm text-[#5a967e]">Loading records...</p>}{reports.map((report) => <div key={report.id} className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-[#edf1ee] p-4 sm:flex-row sm:items-center"><div><strong className="block text-sm text-[#244642]">{report.title}</strong><span className="text-xs text-[#82958f]">{report.type} · {report.date} · {report.status}</span></div><button onClick={() => analyzeReport(report.id)} className="rounded-lg bg-[#124b47] px-3 py-2 text-xs font-bold text-white">Analyse report</button></div>)}{reportAnalyzed && <p className="mt-4 rounded-lg bg-[#f1f7f3] p-4 text-sm text-[#527167]">{revisitReport}</p>}</div></section>}
        {screenError && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{screenError}</p>}

        {activeNav === "Medical records" && <section className="mt-4 rounded-2xl border border-[#e1e9e5] bg-white p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b0805e]">REVISIT WORKFLOW</p><h2 className="mt-2 text-xl font-bold text-[#244642]">Update and analyse Rohan&apos;s latest test report</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#82958f]">Upload the report from today&apos;s revisit. The system keeps it linked to the patient timeline, compares it with the previous result, and prepares a reviewable doctor summary.</p></div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${reportUpdated ? "bg-[#e3f5ec] text-[#4f927a]" : "bg-[#f5f0e9] text-[#a27d5b]"}`}>{reportUpdated ? "Record updated" : "Awaiting report"}</span>
          </div>
          <input ref={revisitFileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setRevisitReport(event.target.files?.[0]?.name ?? "")} className="hidden" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <button onClick={() => revisitFileInput.current?.click()} className="flex min-h-[112px] items-center gap-4 rounded-xl border border-dashed border-[#cbded5] bg-[#f8fcfa] p-5 text-left hover:border-[#75b79d]"><span className="rounded-xl bg-[#e7f4ed] p-3 text-[#5a967e]"><UploadCloud className="h-5 w-5" /></span><span><strong className="block text-sm text-[#315a52]">{revisitReport || "Upload a new test report"}</strong><span className="mt-1 block text-xs text-[#82958f]">PDF or image · CBC, lipid profile, HbA1c, or other revisit report</span></span></button>
            <button disabled={!revisitReport || screenLoading} onClick={updateRevisitRecord} className="rounded-xl bg-[#eaf6f0] px-5 py-3 text-xs font-bold text-[#4f927a] enabled:hover:bg-[#dcefe5] disabled:cursor-not-allowed disabled:opacity-50">{reportUpdated ? "Updated in timeline" : "Update patient record"}</button>
          </div>
          {reportUpdated && <div className="mt-5 rounded-xl border border-[#d9e9e1] bg-[#fbfdfc] p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-xs font-bold text-[#315a52]">{revisitReport}</p><p className="mt-1 text-[11px] text-[#82958f]">Added to the selected patient&apos;s revisit</p></div><span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[10px] font-bold text-[#5a967e]">New result</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => analyzeReport(reports[0]?.id ?? "report-cbc-102")} className="rounded-lg bg-[#124b47] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d3e3b]">{reportAnalyzed ? "Analysis complete" : "Analyse changes"}</button><button disabled={!reportAnalyzed} onClick={() => summarizeReport(reports[0]?.id ?? "report-cbc-102", revisitReport)} className="rounded-lg border border-[#cbded5] px-4 py-2 text-xs font-bold text-[#4f927a] enabled:hover:bg-[#edf7f2] disabled:cursor-not-allowed disabled:opacity-50">{reportSummary ? "Summary ready" : "Summarise for doctor"}</button></div>{reportAnalyzed && <div className="mt-4 grid gap-3 rounded-lg bg-[#f1f7f3] p-4 text-xs text-[#5f7c70] md:grid-cols-3"><span><strong className="block text-[#315a52]">Trend</strong>HbA1c improved by 0.6%</span><span><strong className="block text-[#315a52]">Flag</strong>LDL remains above target</span><span><strong className="block text-[#315a52]">Confidence</strong>High · 2 linked reports</span></div>}{reportSummary && <div className="mt-4 rounded-lg border-l-4 border-[#65a889] bg-white p-4 text-sm leading-6 text-[#527167]"><strong className="text-[#315a52]">Doctor summary:</strong> Compared with the previous report, glycaemic control is improving. LDL remains elevated and should be reviewed alongside adherence, diet, and the current statin plan at today&apos;s revisit.</div>}</div>}
        </section>}
      </div>
    );
  }

  function askCopilot() {
    if (!question.trim()) return;
    apiRequest<{ response: string }>("/api/copilot", { method: "POST", body: JSON.stringify({ question, patientId: "RM-102" }) })
      .then(({ response }) => setCopilotResult(response))
      .catch((error: unknown) => setServiceError(error instanceof Error ? error.message : "Copilot request failed."));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file.name);
      apiRequest<{ report: { id: string } }>("/api/medical-records/reports", { method: "POST", body: JSON.stringify({ patientId: "RM-102", title: file.name, type: "Lab report" }) })
        .catch((error: unknown) => setServiceError(error instanceof Error ? error.message : "Document upload failed."));
    }
  }

  async function toggleSession() {
    const action = sessionStarted ? "stop" : "start";
    try {
      await apiRequest("/api/sessions", { method: "POST", body: JSON.stringify({ action }) });
      setSessionStarted(action === "start");
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Session service failed.");
    }
  }

  async function summarizeDocument() {
    if (!uploadedFile) return;
    try {
      const { summary } = await apiRequest<{ summary: { keyFindings: string[]; nextStep: string } }>("/api/medical-records/summarize", { method: "POST", body: JSON.stringify({ reportId: uploadedFile, title: uploadedFile }) });
      setDocumentSummary(`${summary.keyFindings.join(" · ")} Next step: ${summary.nextStep}`);
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Document summary failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[292px] md:px-6 md:py-9">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#078d79] text-white shadow-[0_8px_16px_rgba(7,141,121,0.18)]"><Stethoscope className="h-6 w-6" /></span>
          <span className="hidden text-[23px] font-bold tracking-[-0.06em] text-[#193d3a] md:inline">AI UPCHAR</span>
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
          <button onClick={() => setActiveNav("Overview")} aria-label="Demo workspace" className="w-full rounded-xl border border-[#c5e9dd] bg-[#d8f3e8] p-3 text-left transition hover:bg-[#cceee0] md:p-4">
            <span className="flex items-center justify-center gap-3 text-sm font-bold text-[#078b78] md:justify-start"><Sparkles className="h-5 w-5" /><span className="hidden md:inline">Demo workspace</span></span>
            <span className="mt-1 hidden pl-8 text-xs text-[#6d958b] md:block">Explore AI UPCHAR</span>
          </button>
          <button onClick={() => setActiveNav("Profile")} aria-label="Dr. Ananya Arya profile" className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl p-1 text-left hover:bg-white/60 md:justify-start">
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
            AI UPCHAR
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
          <button onClick={toggleSession} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#07947f] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(7,148,127,0.18)] transition hover:bg-[#057e6d] lg:w-fit">
            {sessionStarted ? <Check className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {sessionStarted ? "Session active" : "Start new session"}
            {sessionStarted ? <X className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </button>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {summaryStats.map(({ label, value, detail, icon: Icon, tone }) => (
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
              <div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] text-[#8b958e]"><ShieldCheck className="h-4 w-4 text-[#76a287]" /> Your data stays private</span><button disabled={!uploadedFile} onClick={summarizeDocument} className="rounded-lg bg-[#f2eee8] px-4 py-2 text-xs font-bold text-[#a2876c] enabled:hover:bg-[#e9dfd2] disabled:cursor-not-allowed disabled:opacity-50">Summarise document</button></div>
              {documentSummary && <p className="mt-4 rounded-lg bg-[#f6f2ec] p-3 text-xs leading-5 text-[#806c58]">{documentSummary}</p>}
            </article>
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-2 border-t border-[#e8e8e2] pt-6 text-xs text-[#9aa39d] sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 font-semibold text-[#707b74]"><HeartPulse className="h-4 w-4 text-[#76a287]" /> AI UPCHAR</span><span>Designed for focused care <span className="text-[#d89182]">♥</span></span><span>DEMO MODE · AI responses are simulated</span></footer>
      </div> : <WorkspaceScreen activeNav={activeNav} onNavigate={setActiveNav} />}
      </div>
    </main>
  );
}
