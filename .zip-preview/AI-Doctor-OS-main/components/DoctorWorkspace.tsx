"use client";

import Link from "next/link";
import { ChangeEvent, RefObject, useCallback, useEffect, useRef, useState } from "react";
import { askAIForJSON } from "@/lib/puter-ai";
import { detectRedFlags } from "@/lib/red-flag-keywords";
import {
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  Languages,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Mic,
  NotebookTabs,
  Phone,
  Pill,
  Plus,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Stethoscope,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Patient = { id: string; name: string; initials: string; appointment: string; status: string; phone?: string; age?: string; sex?: string; location?: string };
type Report = { id: string; patientId: string; title: string; type: string; date: string; status: string };
type Note = { id: string; patientId: string | null; status: string; subjective: string; objective: string; assessment: string; plan: string; disclaimer?: string };
type Insight = { id: string; title: string; detail: string; priority: string; status?: string };
type PreVisitReport = { problemSummary: string; fullHistory: string; provisionalDiagnosis: string; furtherTestsNeeded: string; recommendedTests: string[]; recommendedTreatment: string; urgency: "OPD" | "Admit for observation" | "Emergency"; surgeryLikely: string; aiGenerated: boolean };
type Appointment = { id: string; patientId: string; patientName: string; channel: "WhatsApp" | "Voice call" | "Mobile app" | "Walk-in"; date?: string; time: string; priority: "Urgent" | "Follow-up" | "Routine"; visitType?: "New" | "Follow-up"; reason?: string; consultationFee?: number; queuePosition: number; briefReady: boolean; briefSummary: string; missingInfo?: string; preVisitReport?: PreVisitReport };
type Prescription = { id: string; patientId: string; patientName: string; medication: string; dosage: string; status: "DRAFT" | "SAFETY_CHECK" | "NEEDS_REVIEW" | "APPROVED" | "DISPATCHED"; safetyFlags: string[]; overrideReason?: string; createdAt: string };
type InboxEntry = { id: string; type: "report_pending" | "duplicate_identity" | "conflict" | "red_flag" | "reschedule"; title: string; detail: string; patientId?: string; patientName?: string; status: "open" | "resolved"; createdAt: string };
type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message: string } };

const channelIcon: Record<Appointment["channel"], typeof MessageCircle> = { WhatsApp: MessageCircle, "Voice call": Phone, "Mobile app": Smartphone, "Walk-in": MapPin };
const priorityTone: Record<Appointment["priority"], string> = { Urgent: "bg-[#fdeceb] text-[#b3544a]", "Follow-up": "bg-[#f6efdd] text-[#a17a2d]", Routine: "bg-[#edf7f2] text-[#4f9d78]" };
const inboxTypeLabel: Record<InboxEntry["type"], string> = { red_flag: "Red-flag symptoms", duplicate_identity: "Duplicate identity", conflict: "Conflicting record", reschedule: "Reschedule needed", report_pending: "Report needs review" };
const inboxTypeTone: Record<InboxEntry["type"], string> = { red_flag: "bg-[#fdeceb] text-[#b3544a]", duplicate_identity: "bg-[#f6efdd] text-[#a17a2d]", conflict: "bg-[#f6efdd] text-[#a17a2d]", reschedule: "bg-[#edf2f8] text-[#6682a5]", report_pending: "bg-[#edf7f2] text-[#4f9d78]" };

const stats = [
  { label: "Patients today", value: "12", detail: "↗ 18% vs last Tuesday", icon: Users, tone: "bg-[#eef7f2] text-[#4f9d78]" },
  { label: "Notes completed", value: "08", detail: "↗ 24% this week", icon: FileText, tone: "bg-[#f6f0e9] text-[#bd865b]" },
  { label: "Time saved", value: "2h 14m", detail: "AI-assisted documentation", icon: Clock3, tone: "bg-[#edf2f8] text-[#6682a5]" },
  { label: "Next appointment", value: "10:30 AM", detail: "Rohan Mehta · Follow-up", icon: CalendarDays, tone: "bg-[#f4eef7] text-[#9773a4]" },
];
const waveform = [18, 34, 27, 45, 22, 38, 31, 52, 24, 40, 29, 47, 20, 35, 26, 44, 30, 55, 23, 39, 28, 48, 21, 34, 27, 43, 19, 37];
const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "New patient chat", icon: UserPlus },
  { label: "Appointments", icon: CalendarClock },
  { label: "AI Inbox", icon: Inbox },
  { label: "Patients", icon: Users },
  { label: "AI Scribe", icon: Mic },
  { label: "Copilot chat", icon: MessageSquareText },
  { label: "Clinical insights", icon: BrainCircuit, badge: "NEW" },
  { label: "Symptom checker", icon: HeartPulse },
  { label: "Prescriptions", icon: Pill },
  { label: "Medical records", icon: NotebookTabs },
];

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "The demo service could not complete this request.");
  }
  return payload.data;
}

export default function DoctorWorkspace() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [selectedPatientId, setSelectedPatientId] = useState("RM-102");
  const [language, setLanguage] = useState("हिन्दी");
  const [globalSearch, setGlobalSearch] = useState("");
  const [summaryStats, setSummaryStats] = useState(stats);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"microphone" | "demo" | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [symptoms, setSymptoms] = useState("");
  const [symptomResult, setSymptomResult] = useState("");
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [copilotResult, setCopilotResult] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState("");
  const [uploadedReportId, setUploadedReportId] = useState("");
  const [documentSummary, setDocumentSummary] = useState("");
  const [inboxCount, setInboxCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingChunks = useRef<Blob[]>([]);

  useEffect(() => {
    apiRequest<{ summary: { stats: { label: string; value: string; detail: string }[] } }>("/api/workspace/summary")
      .then(({ summary }) => setSummaryStats(summary.stats.map((item, index) => ({ ...stats[index], ...item }))))
      .catch((error: unknown) => setServiceError(error instanceof Error ? error.message : "Workspace data is unavailable."));
    apiRequest<{ items: unknown[]; total: number }>("/api/inbox").then(({ total }) => setInboxCount(total)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  function navigate(nav: string) {
    setServiceError("");
    setActiveNav(nav);
  }

  const loadPatients = useCallback(async () => {
    const { patients: data } = await apiRequest<{ patients: Patient[] }>("/api/patients");
    setPatients(data);
    return data;
  }, []);

  async function startRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    setServiceError("");
    setRecordingSeconds(0);
    try {
      await apiRequest("/api/sessions", { method: "POST", body: JSON.stringify({ action: "start" }) });
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone APIs are unavailable.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordingChunks.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunks.current.push(event.data); };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingMode("microphone");
    } catch {
      // A demo transcript keeps the core workflow usable when browser permission is denied.
      setRecordingMode("demo");
      setServiceError("Microphone permission is unavailable. Demo recording is active with a sample consultation.");
    }
    setRecording(true);
  }

  async function stopRecording() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setRecording(false);
    try {
      await apiRequest("/api/sessions", { method: "POST", body: JSON.stringify({ action: "stop" }) });
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Recording session could not be stopped.");
    }
  }

  async function checkSymptoms(input = symptoms) {
    if (!input.trim()) {
      setServiceError("Enter at least one symptom before checking.");
      return;
    }
    setSymptomLoading(true);
    setServiceError("");
    try {
      const { analysis } = await apiRequest<{ analysis: { duration: string; severity: string; associatedSymptoms: string; medicines: string; questions: string[]; triage: string; redFlags: string; aiGenerated?: boolean } }>("/api/symptom-analysis", {
        method: "POST",
        body: JSON.stringify({ symptoms: input, patientId: selectedPatientId }),
      });
      setSymptomResult(`${analysis.aiGenerated ? "✦ AI-generated follow-up questions" : "Demo follow-up questions (add a Puter AI token for real ones)"}\n\nDuration: ${analysis.duration} · Severity: ${analysis.severity}\n${analysis.associatedSymptoms} · Medicines: ${analysis.medicines}\n\nFollow-up: ${analysis.questions.join(" ")}\n\nTriage: ${analysis.triage}. ${analysis.redFlags}`);
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Symptom analysis failed.");
    } finally {
      setSymptomLoading(false);
    }
  }

  async function askCopilot() {
    if (!question.trim()) {
      setServiceError("Enter a question for the medical copilot.");
      return;
    }
    setCopilotLoading(true);
    setServiceError("");
    try {
      const { response, aiGenerated } = await apiRequest<{ response: string; aiGenerated?: boolean }>("/api/copilot", { method: "POST", body: JSON.stringify({ question, patientId: selectedPatientId }) });
      setCopilotResult(`${aiGenerated ? "✦ " : "(demo response — add a Puter AI token for real answers) "}${response}`);
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Copilot request failed.");
    } finally {
      setCopilotLoading(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    setUploadedReportId("");
    try {
      const { report } = await apiRequest<{ report: Report }>("/api/medical-records/reports", { method: "POST", body: JSON.stringify({ patientId: selectedPatientId, title: file.name, type: "Lab report" }) });
      setUploadedReportId(report.id);
      setServiceError("");
    } catch (error: unknown) {
      setUploadedFile("");
      setServiceError(error instanceof Error ? error.message : "Document upload failed.");
    }
  }

  async function summarizeDocument() {
    if (!uploadedReportId) return;
    try {
      const { summary } = await apiRequest<{ summary: { keyFindings: string[]; nextStep: string } }>("/api/medical-records/summarize", { method: "POST", body: JSON.stringify({ reportId: uploadedReportId, title: uploadedFile }) });
      setDocumentSummary(`${summary.keyFindings.join(" · ")} Next step: ${summary.nextStep}`);
    } catch (error: unknown) {
      setServiceError(error instanceof Error ? error.message : "Document summary failed.");
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

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#183b39]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[78px] flex-col border-r border-[#dce9e3] bg-[#edf8f3] px-3 py-5 md:w-[292px] md:px-6 md:py-9">
        <Link href="/" className="flex items-center gap-3 px-2"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#078d79] text-white"><Stethoscope className="h-6 w-6" /></span><span className="hidden text-[23px] font-bold tracking-[-0.06em] text-[#193d3a] md:inline">AI UPCHAR</span></Link>
        <p className="mt-10 hidden px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#86a09a] md:mt-16 md:block">Workspace</p>
        <nav className="mt-5 space-y-2">{navItems.map(({ label, icon: Icon, badge }) => <button key={label} onClick={() => navigate(label)} aria-label={label} className={`flex w-full items-center justify-center gap-4 rounded-xl px-3 py-3.5 text-left text-[16px] font-semibold transition md:justify-start md:px-4 ${activeNav === label ? "bg-[#153f3c] text-white shadow-[0_10px_20px_rgba(21,63,60,0.14)]" : "text-[#6c8782] hover:bg-white/60 hover:text-[#315d57]"}`}><Icon className="h-5 w-5 shrink-0" /><span className="hidden flex-1 md:inline">{label}</span>{label === "AI Inbox" && inboxCount > 0 ? <span className="hidden rounded bg-[#f7c9c2] px-1.5 py-0.5 text-[9px] font-bold text-[#a45649] md:inline">{inboxCount}</span> : badge && <span className="hidden rounded bg-[#a9e6d2] px-1.5 py-0.5 text-[9px] font-bold text-[#27806b] md:inline">{badge}</span>}</button>)}</nav>
        <div className="mt-auto"><button onClick={() => navigate("Overview")} className="w-full rounded-xl border border-[#c5e9dd] bg-[#d8f3e8] p-3 text-left hover:bg-[#cceee0] md:p-4"><span className="flex items-center justify-center gap-3 text-sm font-bold text-[#078b78] md:justify-start"><Sparkles className="h-5 w-5" /><span className="hidden md:inline">Demo workspace</span></span><span className="mt-1 hidden pl-8 text-xs text-[#6d958b] md:block">Explore AI UPCHAR</span></button><button onClick={() => navigate("Profile")} aria-label="Open clinician profile" className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl p-1 text-left hover:bg-white/60 md:justify-start"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d5eee4] text-xs font-bold text-[#277a6b]">DA</span><span className="hidden flex-1 md:block"><strong className="block text-sm text-[#214440]">Dr. Ananya Arya</strong><span className="mt-1 block text-xs text-[#78918c]">General Medicine</span></span><ChevronRight className="h-5 w-5 text-[#87aaa0]" /></button></div>
      </aside>

      <div className="ml-[78px] md:ml-[292px]">
        <header className="border-b border-[#e4ebe7] bg-[#fbfdfc]"><div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-3 px-3 sm:gap-5 sm:px-5 md:px-10"><Link href="/" className="hidden shrink-0 text-[17px] font-bold tracking-[-0.04em] sm:flex">AI UPCHAR</Link><div className="relative flex max-w-[430px] flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8da09b]" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") navigate("Patients"); }} aria-label="Search patients or records" placeholder="Search patients or records" className="h-10 w-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-[#94a39f]" /></div><div className="ml-auto flex items-center gap-3"><button onClick={() => setLanguage(language === "हिन्दी" ? "English" : "हिन्दी")} aria-label="Change language" className="flex items-center gap-2 rounded-lg border border-[#e4ebe7] px-2.5 py-2 text-xs font-semibold text-[#54716d] hover:bg-[#f0f6f3]"><Languages className="h-4 w-4" /><span className="hidden sm:inline">{language}</span></button><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#164642] text-xs font-bold text-white">DA</span></div></div></header>
        {serviceError && <div role="alert" className="mx-auto mt-4 flex max-w-[1280px] items-center justify-between gap-3 rounded-xl border border-[#efc7c0] bg-[#fff5f2] px-4 py-3 text-sm text-[#a45649] md:mx-10"><span>{serviceError}</span><button onClick={() => setServiceError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div>}
        {activeNav === "Overview" ? <Overview summaryStats={summaryStats} sessionStarted={sessionStarted} toggleSession={toggleSession} recording={recording} navigate={navigate} symptoms={symptoms} setSymptoms={setSymptoms} checkSymptoms={checkSymptoms} symptomResult={symptomResult} symptomLoading={symptomLoading} question={question} setQuestion={setQuestion} askCopilot={askCopilot} copilotResult={copilotResult} copilotLoading={copilotLoading} fileInput={fileInput} handleFile={handleFile} uploadedFile={uploadedFile} uploadedReportId={uploadedReportId} summarizeDocument={summarizeDocument} documentSummary={documentSummary} /> : <WorkspaceScreen activeNav={activeNav} navigate={navigate} selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId} patients={patients} loadPatients={loadPatients} recording={recording} recordingMode={recordingMode} recordingSeconds={recordingSeconds} startRecording={startRecording} stopRecording={stopRecording} globalSearch={globalSearch} /> }
      </div>
    </main>
  );
}

function Overview({ summaryStats, sessionStarted, toggleSession, recording, navigate, symptoms, setSymptoms, checkSymptoms, symptomResult, symptomLoading, question, setQuestion, askCopilot, copilotResult, copilotLoading, fileInput, handleFile, uploadedFile, uploadedReportId, summarizeDocument, documentSummary }: {
  summaryStats: typeof stats; sessionStarted: boolean; toggleSession: () => void; recording: boolean; navigate: (nav: string) => void; symptoms: string; setSymptoms: (value: string) => void; checkSymptoms: () => void; symptomResult: string; symptomLoading: boolean; question: string; setQuestion: (value: string) => void; askCopilot: () => void; copilotResult: string; copilotLoading: boolean;   fileInput: RefObject<HTMLInputElement>; handleFile: (event: ChangeEvent<HTMLInputElement>) => void; uploadedFile: string; uploadedReportId: string; summarizeDocument: () => void; documentSummary: string;
}) {
  const [queueTeaser, setQueueTeaser] = useState<Appointment[]>([]);
  useEffect(() => {
    apiRequest<{ appointments: Appointment[] }>("/api/appointments").then(({ appointments: data }) => setQueueTeaser(data.slice(0, 3))).catch(() => setQueueTeaser([]));
  }, []);
  return <div className="mx-auto max-w-[1280px] overflow-hidden px-4 pb-12 pt-6 sm:px-5 md:px-10 md:pt-8">
    <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78908a]">Live clinic <span className="mx-2 text-[#0b9c87]">•</span> Tuesday, 24 June 2025</p><h1 className="mt-3 text-[28px] font-bold tracking-[-0.05em] text-[#173f3c] sm:text-3xl md:text-[40px]">Good morning, Dr. Arya</h1><p className="mt-2 text-sm text-[#78908a]">Here&apos;s what&apos;s happening in your clinic today.</p></div><button onClick={toggleSession} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#07947f] px-5 py-3 text-sm font-bold text-white lg:w-fit">{sessionStarted ? <Check className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{sessionStarted ? "Session active · Stop" : "Start new session"}<ArrowUpRight className="h-4 w-4" /></button></section>
    <section className="mt-10 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">{summaryStats.map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="relative h-[121px] rounded-xl border border-[#e1e9e5] bg-white p-4"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-[#6d827c]">{label}</p><span className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></span></div><p className="absolute left-4 top-[52px] text-2xl font-bold text-[#173f3c]">{value}</p><p className="absolute bottom-4 left-4 text-[11px] text-[#77908a]">{detail}</p></div>)}</section>
    <section className="mt-12"><div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold">Your clinical command centre</h2><p className="mt-1 text-sm text-[#818b85]">Everything you need, in one calm place.</p></div><button onClick={() => navigate("Appointments")} className="flex items-center gap-1 text-xs font-semibold text-[#56896d] hover:underline">View all <ChevronRight className="h-3.5 w-3.5" /></button></div>
      <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <article className="min-h-[235px] rounded-2xl bg-[#124b47] p-6 text-white"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8bd4be]">Live scribe</p><h3 className="mt-3 text-xl font-semibold">Stay present. Let AI take notes.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#b8d2ce]">Record a consultation and turn it into a structured SOAP note.</p></div><Mic className="h-5 w-5 text-[#a5e4d0]" /></div><div className="mt-8 flex h-14 items-center gap-1" role="img" aria-label={recording ? "Voice recording in progress" : "Voice frequency preview"}>{waveform.map((height, index) => <span key={`${height}-${index}`} className={`w-1 rounded-full ${index % 3 === 0 ? "bg-[#4fc4a7]" : "bg-[#8ed8c2]"} ${recording ? "animate-pulse" : ""}`} style={{ height: `${height}px` }} />)}</div><div className="mt-4 flex items-center justify-between border-t border-[#39706a] pt-4"><span className="text-xs font-semibold text-[#b8d2ce]">{recording ? "Recording consultation" : "Ready to listen"}</span><button onClick={() => navigate("AI Scribe")} className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#124b47]">Open AI Scribe <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div></article>
        <article className="min-h-[235px] rounded-2xl bg-[#f1e8df] p-6"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#b0805e]">Today&apos;s queue</p><h3 className="mt-3 text-xl font-semibold">Prepared before they arrive</h3><p className="mt-1 text-sm text-[#8d837a]">WhatsApp, voice call, app, and walk-in intake, sorted by priority.</p><div className="mt-5 space-y-2">{queueTeaser.length === 0 && <p className="text-xs text-[#a09083]">Loading queue…</p>}{queueTeaser.map((appt) => { const ChannelIcon = channelIcon[appt.channel]; return <div key={appt.id} className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2"><ChannelIcon className="h-4 w-4 shrink-0 text-[#9b704f]" /><span className="flex-1 truncate text-xs font-semibold text-[#655e57]">{appt.patientName}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${priorityTone[appt.priority]}`}>{appt.priority}</span></div>; })}</div><button onClick={() => navigate("Appointments")} className="mt-5 flex items-center gap-1 text-xs font-bold text-[#9b704f] hover:underline">Open today&apos;s queue <ChevronRight className="h-3.5 w-3.5" /></button></article>
        <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6"><h3 className="text-xl font-semibold">Symptom checker</h3><p className="mt-2 text-sm text-[#818b85]">Organise symptoms before a focused consultation.</p><div className="mt-6 flex gap-2"><input value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="e.g. headache, mild fever..." className="min-w-0 flex-1 rounded-lg border border-[#e5e8e3] px-3 py-2.5 text-xs outline-none" /><button onClick={checkSymptoms} disabled={symptomLoading} className="rounded-lg bg-[#ebf4ed] px-3 text-xs font-bold text-[#5c916e] disabled:opacity-60">{symptomLoading ? "Checking…" : "Check symptoms"}</button></div>{symptomResult && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#f1f7f2] p-3 text-xs leading-5 text-[#65806e]">{symptomResult}</pre>}<button onClick={() => navigate("Symptom checker")} className="mt-4 text-xs font-bold text-[#5c916e] hover:underline">Open full symptom checker →</button></article>
        <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6"><h3 className="text-xl font-semibold">Ask your medical copilot</h3><p className="mt-2 text-sm text-[#818b85]">Structure a question and get a clear starting point.</p><div className="mt-6 flex rounded-lg border border-[#e5e8e3] p-1"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && askCopilot()} placeholder="Ask about a case or guideline..." className="min-w-0 flex-1 bg-transparent px-2 text-xs outline-none" /><button onClick={askCopilot} disabled={copilotLoading} aria-label="Ask copilot" className="rounded-md bg-[#e9edf7] p-2 text-[#6b7eac] disabled:opacity-60">{copilotLoading ? "…" : <Send className="h-3.5 w-3.5" />}</button></div>{copilotResult && <p className="mt-3 rounded-lg bg-[#f3f4fa] p-3 text-xs leading-5 text-[#687493]">{copilotResult}</p>}<button onClick={() => navigate("Copilot chat")} className="mt-4 text-xs font-bold text-[#687493] hover:underline">Open full copilot chat →</button></article>
        <article className="rounded-2xl border border-[#e8e8e2] bg-white p-6 xl:col-span-2"><div className="flex items-start justify-between"><div><h3 className="text-xl font-semibold">Summarise a medical document</h3><p className="mt-2 text-sm text-[#818b85]">Upload a PDF and get the key points at a glance.</p></div><FileText className="h-5 w-5 text-[#bd956d]" /></div><input ref={fileInput} type="file" accept=".pdf,application/pdf" onChange={handleFile} className="hidden" /><button onClick={() => fileInput.current?.click()} className="mt-6 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#d9ddd7] px-4 py-7 text-center hover:border-[#a9c0ae]"><UploadCloud className="h-6 w-6 text-[#a8b8ad]" /><span className="mt-2 text-xs font-semibold text-[#7d8b82]">{uploadedFile || "Drop a PDF here or browse"}</span><span className="mt-1 text-[10px] text-[#a4ada7]">DEMO MODE · source-linked record created</span></button><div className="mt-4 flex items-center justify-between"><span className="text-[11px] text-[#8b958e]">Your data stays private</span><button disabled={!uploadedReportId} onClick={summarizeDocument} className="rounded-lg bg-[#f2eee8] px-4 py-2 text-xs font-bold text-[#a2876c] disabled:opacity-50">Summarise document</button></div>{documentSummary && <p className="mt-4 rounded-lg bg-[#f6f2ec] p-3 text-xs leading-5 text-[#806c58]">{documentSummary}</p>}</article>
      </div>
    </section>
  </div>;
}

function WorkspaceScreen({ activeNav, navigate, selectedPatientId, setSelectedPatientId, patients, loadPatients, recording, recordingMode, recordingSeconds, startRecording, stopRecording, globalSearch }: {
  activeNav: string; navigate: (nav: string) => void; selectedPatientId: string; setSelectedPatientId: (id: string) => void; patients: Patient[]; loadPatients: () => Promise<Patient[]>; recording: boolean; recordingMode: "microphone" | "demo" | null; recordingSeconds: number; startRecording: () => Promise<void>; stopRecording: () => Promise<void>; globalSearch: string;
}) {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: "", id: "", appointment: "" });
  const [query, setQuery] = useState(globalSearch);
  const [reports, setReports] = useState<Report[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [newAppointment, setNewAppointment] = useState<{ patientName: string; channel: Appointment["channel"]; priority: Appointment["priority"]; time: string }>({ patientName: "", channel: "WhatsApp", priority: "Routine", time: "" });
  const [expandedAppointment, setExpandedAppointment] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const [transcript, setTranscript] = useState("");
  const [scribeSaving, setScribeSaving] = useState(false);
  const [copilotThread, setCopilotThread] = useState<{ role: "user" | "assistant"; content: string; aiGenerated?: boolean }[]>([]);
  const [copilotDraft, setCopilotDraft] = useState("");
  const [copilotSending, setCopilotSending] = useState(false);
  const copilotEndRef = useRef<HTMLDivElement>(null);

  type IntakeStep =
    | "existing-or-new" | "phone" | "name" | "age" | "sex" | "location"
    | "preferredDate" | "preferredTime" | "chiefComplaint" | "duration"
    | "priorConsultation" | "priorReports"
    | "generating-questions" | "adaptive-qa" | "generating-report" | "finalizing" | "done";

  const GREETING = "Namaste! 👋 Main aapka AI UPCHAR assistant hoon. Appointment book karne aur doctor ke liye aapki jaankari taiyaar karne ke liye main kuch sawaal poochunga.\n\nAap naye patient hain ya pehle bhi yahan aa chuke hain?";
  const [intakeStep, setIntakeStep] = useState<IntakeStep>("existing-or-new");
  const [intakeThread, setIntakeThread] = useState<{ role: "bot" | "patient"; content: string }[]>([{ role: "bot", content: GREETING }]);
  const [intakeDraft, setIntakeDraft] = useState("");
  const emptyIntakeAnswers = { isReturning: "", phone: "", name: "", age: "", sex: "", location: "", preferredDate: "", preferredTime: "", chiefComplaint: "", duration: "", priorConsultation: "", priorReports: "" };
  const [intakeAnswers, setIntakeAnswers] = useState(emptyIntakeAnswers);
  const [intakeQuestions, setIntakeQuestions] = useState<string[]>([]);
  const [intakeQIndex, setIntakeQIndex] = useState(0);
  const [intakeQaLog, setIntakeQaLog] = useState<{ question: string; answer: string }[]>([]);
  const [intakeReport, setIntakeReport] = useState<PreVisitReport | null>(null);
  const [intakeResult, setIntakeResult] = useState<{ patient: Patient; appointment: Appointment; urgent: boolean } | null>(null);
  const [intakeUrgent, setIntakeUrgent] = useState(false);
  const intakeEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeNav === "New patient chat") resetIntake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  useEffect(() => {
    intakeEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [intakeThread, intakeStep]);

  function resetIntake() {
    setIntakeStep("existing-or-new");
    setIntakeThread([{ role: "bot", content: GREETING }]);
    setIntakeAnswers(emptyIntakeAnswers);
    setIntakeQuestions([]);
    setIntakeQIndex(0);
    setIntakeQaLog([]);
    setIntakeReport(null);
    setIntakeResult(null);
    setIntakeUrgent(false);
    setIntakeDraft("");
  }

  function sayBot(content: string) {
    setIntakeThread((current) => [...current, { role: "bot", content }]);
  }

  async function submitIntakeAnswer(valueOverride?: string) {
    const value = (valueOverride ?? intakeDraft).trim();
    const busySteps: IntakeStep[] = ["generating-questions", "generating-report", "finalizing", "done"];
    if (!value || busySteps.includes(intakeStep)) return;
    setIntakeDraft("");
    setIntakeThread((current) => [...current, { role: "patient", content: value }]);

    // Deterministic safety net: check every free-text answer immediately, not
    // just the chief complaint — an emergency can surface in any answer.
    const isFreeText = !["existing-or-new", "sex"].includes(intakeStep);
    if (isFreeText && detectRedFlags(value).length > 0) {
      setIntakeUrgent(true);
    }

    if (intakeStep === "existing-or-new") {
      setIntakeAnswers((a) => ({ ...a, isReturning: value }));
      sayBot("Kripya apna 10-digit mobile number bataiye, taaki hum aapka record bana/dhoondh sakein.");
      setIntakeStep("phone");
      return;
    }
    if (intakeStep === "phone") {
      setIntakeAnswers((a) => ({ ...a, phone: value }));
      sayBot("Aapka poora naam kya hai?");
      setIntakeStep("name");
      return;
    }
    if (intakeStep === "name") {
      setIntakeAnswers((a) => ({ ...a, name: value }));
      sayBot("Aapki umar kitni hai (saalon mein)?");
      setIntakeStep("age");
      return;
    }
    if (intakeStep === "age") {
      setIntakeAnswers((a) => ({ ...a, age: value }));
      sayBot("Aapka ling kya hai?");
      setIntakeStep("sex");
      return;
    }
    if (intakeStep === "sex") {
      setIntakeAnswers((a) => ({ ...a, sex: value }));
      sayBot("Aap kis sheher/ilaake se hain?");
      setIntakeStep("location");
      return;
    }
    if (intakeStep === "location") {
      setIntakeAnswers((a) => ({ ...a, location: value }));
      sayBot("Aap appointment kis din chahte hain?");
      setIntakeStep("preferredDate");
      return;
    }
    if (intakeStep === "preferredDate") {
      setIntakeAnswers((a) => ({ ...a, preferredDate: value }));
      sayBot("Kis samay aana chahenge — subah, dopahar ya shaam?");
      setIntakeStep("preferredTime");
      return;
    }
    if (intakeStep === "preferredTime") {
      setIntakeAnswers((a) => ({ ...a, preferredTime: value }));
      sayBot("Aapko mukhya roop se kya takleef hai? Aaj kis wajah se aa rahe hain?");
      setIntakeStep("chiefComplaint");
      return;
    }
    if (intakeStep === "chiefComplaint") {
      setIntakeAnswers((a) => ({ ...a, chiefComplaint: value }));
      if (detectRedFlags(value).length > 0) {
        sayBot("Yeh turant dhyaan dene wali baat lag rahi hai. Main ise abhi care team ko bhej raha hoon — aage kuch poochne ki zaroorat nahi.");
        setIntakeStep("finalizing");
        await finalizeIntake({ ...intakeAnswers, chiefComplaint: value }, []);
        return;
      }
      sayBot("Yeh takleef aapko kab se hai?");
      setIntakeStep("duration");
      return;
    }
    if (intakeStep === "duration") {
      setIntakeAnswers((a) => ({ ...a, duration: value }));
      sayBot("Kya aapne is takleef ke liye pehle kisi doctor ko dikhaya hai? Agar haan, to purani parchi ka zikr kar dijiye.");
      setIntakeStep("priorConsultation");
      return;
    }
    if (intakeStep === "priorConsultation") {
      setIntakeAnswers((a) => ({ ...a, priorConsultation: value }));
      sayBot("Koi test report ya scan hai (blood test, MRI, CT, ultrasound)? Bata dijiye, ya 'nahi' likhein.");
      setIntakeStep("priorReports");
      return;
    }
    if (intakeStep === "priorReports") {
      const answers = { ...intakeAnswers, priorReports: value };
      setIntakeAnswers(answers);
      setIntakeStep("generating-questions");
      sayBot("Dhanyavaad. Ek pal rukiye — main aapki takleef ke hisaab se sahi sawaal taiyaar kar raha hoon...");
      await generateAdaptiveQuestions(answers);
      return;
    }
    if (intakeStep === "adaptive-qa") {
      const question = intakeQuestions[intakeQIndex];
      const nextLog = [...intakeQaLog, { question, answer: value }];
      setIntakeQaLog(nextLog);
      const nextIndex = intakeQIndex + 1;
      if (nextIndex < intakeQuestions.length && !intakeUrgent) {
        setIntakeQIndex(nextIndex);
        sayBot(intakeQuestions[nextIndex]);
        return;
      }
      setIntakeStep("generating-report");
      sayBot(intakeUrgent ? "Samajh gaya — ye turant dhyaan dene wali baat hai. Care team ko abhi flag kar raha hoon." : "Bahut achha — ab main doctor ke liye ek summary taiyaar kar raha hoon...");
      await generateReportAndFinalize(intakeAnswers, nextLog);
    }
  }

  async function generateAdaptiveQuestions(answers: typeof intakeAnswers) {
    const generated = await askAIForJSON<{ questions: string[] }>([
      {
        role: "system",
        content: "You simulate how an experienced physician conducts a pre-visit intake before a first consultation. Given a patient's chief complaint, generate 4-6 SPECIFIC follow-up questions that are clinically relevant to THAT complaint's likely differential diagnoses — never generic. For a GI complaint ask about stool/blood/fever/dehydration; for a cardiac complaint ask about chest pain radiation/exertion/palpitations; for a respiratory complaint ask about cough character/breathlessness triggers, etc. Cover: symptom characteristics, associated symptoms specific to the likely differentials, severity/red-flag indicators, relevant risk factors (diet, travel, medication, comorbidities), and functional impact. Write questions in simple Hindi/Hinglish a patient would understand, one short question each. Return JSON: { \"questions\": string[] }.",
      },
      { role: "user", content: `Complaint: ${answers.chiefComplaint}\nDuration: ${answers.duration}\nAge: ${answers.age}, Sex: ${answers.sex}\nPrior consultation: ${answers.priorConsultation}\nPrior reports: ${answers.priorReports}` },
    ]);
    const questions = generated?.questions?.filter((q) => q.trim()).slice(0, 6) ?? [
      "Ye takleef din mein kitni baar hoti hai?",
      "Kya iske saath bukhar ya ulti bhi hai?",
      "Kya khoon ya asaamanya rang dikha hai?",
      "Kya aapne khaane-peene mein koi badlaav mehsoos kiya hai?",
    ];
    setIntakeQuestions(questions);
    setIntakeQIndex(0);
    setIntakeStep("adaptive-qa");
    sayBot(questions[0]);
  }

  async function generateReportAndFinalize(answers: typeof intakeAnswers, qaLog: { question: string; answer: string }[]) {
    const generated = await askAIForJSON<PreVisitReport>([
      {
        role: "system",
        content: "You are drafting a structured pre-visit brief for a doctor, based on a patient intake conversation. This is decision SUPPORT only — never a final diagnosis, and the doctor makes every final call. Be conservative: if anything suggests urgency, say so. Return JSON with EXACTLY these keys: problemSummary (1-2 sentences), fullHistory (a short paragraph combining chief complaint, duration, and all Q&A), provisionalDiagnosis (most likely differential(s), clearly labeled as provisional), furtherTestsNeeded (one sentence: what's needed or say information is sufficient), recommendedTests (array of specific test/scan names, empty array if none), recommendedTreatment (one sentence, illustrative only), urgency (exactly one of \"OPD\", \"Admit for observation\", \"Emergency\"), surgeryLikely (short phrase, e.g. \"Unlikely\", \"Possible if X\", \"Not indicated\").",
      },
      { role: "user", content: `Name: ${answers.name}, Age: ${answers.age}, Sex: ${answers.sex}, Location: ${answers.location}\nChief complaint: ${answers.chiefComplaint}\nDuration: ${answers.duration}\nPrior consultation: ${answers.priorConsultation}\nPrior reports: ${answers.priorReports}\nFollow-up Q&A:\n${qaLog.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n")}` },
    ]);
    if (generated) setIntakeReport(generated);
    setIntakeStep("finalizing");
    await finalizeIntake(answers, qaLog, generated ?? undefined);
  }

  async function finalizeIntake(answers: typeof intakeAnswers, qaLog: { question: string; answer: string }[], report?: PreVisitReport) {
    try {
      const { patient, appointment, urgent } = await apiRequest<{ patient: Patient; appointment: Appointment; urgent: boolean }>("/api/patient-intake", {
        method: "POST",
        body: JSON.stringify({ name: answers.name, phone: answers.phone, age: answers.age, sex: answers.sex, location: answers.location, preferredDate: answers.preferredDate, preferredTime: answers.preferredTime, chiefComplaint: answers.chiefComplaint, duration: answers.duration, priorConsultation: answers.priorConsultation, priorReports: answers.priorReports, qaLog, preVisitReport: report }),
      });
      sayBot(`All set, ${answers.name.split(" ")[0]} — aap queue mein hain aur doctor ke paas aapki poori jaankari pehle se pahunch jayegi.`);
      setIntakeResult({ patient, appointment, urgent });
      if (appointment.preVisitReport) setIntakeReport(appointment.preVisitReport);
      setIntakeStep("done");
    } catch (err: unknown) {
      sayBot("Kuch gadbad ho gayi intake save karte waqt. Kripya dobara koshish karein.");
      setIntakeStep("priorReports");
    }
  }
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("Mild");
  const [associatedSymptoms, setAssociatedSymptoms] = useState("");
  const [medicines, setMedicines] = useState("");
  const [symptomResult, setSymptomResult] = useState("");
  const [symptomUrgent, setSymptomUrgent] = useState(false);
  const [prescriptionList, setPrescriptionList] = useState<Prescription[]>([]);
  const [newRx, setNewRx] = useState({ medication: "", dosage: "" });
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  const [inboxList, setInboxList] = useState<InboxEntry[]>([]);
  const [profileSection, setProfileSection] = useState("Overview");
  const [profile, setProfile] = useState({ fullName: "Dr. Ananya Arya", specialty: "General Medicine", clinicBio: "", availableToday: true });
  const [notifications, setNotifications] = useState({ urgentFollowUps: true, weeklySummary: true, twoStepSignIn: true });
  const [notice, setNotice] = useState("");
  const [selectedReport, setSelectedReport] = useState("");

  useEffect(() => {
    setCopilotThread([]);
  }, [selectedPatientId]);

  useEffect(() => {
    copilotEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [copilotThread, copilotSending]);

  async function sendCopilotMessage() {
    const question = copilotDraft.trim();
    if (!question) return;
    setCopilotDraft("");
    setCopilotThread((current) => [...current, { role: "user", content: question }]);
    setCopilotSending(true);
    try {
      const { response, aiGenerated } = await apiRequest<{ response: string; aiGenerated?: boolean }>("/api/copilot", {
        method: "POST",
        body: JSON.stringify({ question, patientId: selectedPatientId, history: copilotThread.map(({ role, content }) => ({ role, content })) }),
      });
      setCopilotThread((current) => [...current, { role: "assistant", content: response, aiGenerated }]);
    } catch (error: unknown) {
      setCopilotThread((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Copilot request failed.", aiGenerated: false }]);
    } finally {
      setCopilotSending(false);
    }
  }

  useEffect(() => {
    setQuery(globalSearch);
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorText("");
      try {
        if (["Patients", "AI Scribe", "Symptom checker", "Medical records"].includes(activeNav) && patients.length === 0) await loadPatients();
        if (activeNav === "Appointments") {
          const { appointments: data } = await apiRequest<{ appointments: Appointment[] }>("/api/appointments");
          if (!cancelled) setAppointmentsList(data);
        }
        if (activeNav === "AI Inbox") {
          const { items } = await apiRequest<{ items: InboxEntry[] }>("/api/inbox");
          if (!cancelled) setInboxList(items);
        }
        if (activeNav === "Prescriptions") {
          if (patients.length === 0) await loadPatients();
          const { prescriptions: data } = await apiRequest<{ prescriptions: Prescription[] }>(`/api/prescriptions?patientId=${selectedPatientId}`);
          if (!cancelled) setPrescriptionList(data);
        }
        if (activeNav === "Medical records") {
          const { reports: data } = await apiRequest<{ reports: Report[] }>(`/api/medical-records/reports?patientId=${selectedPatientId}`);
          if (!cancelled) setReports(data);
        }
        if (activeNav === "Clinical insights") {
          const { insights: data } = await apiRequest<{ insights: Insight[] }>("/api/insights");
          if (!cancelled) setInsights(data);
        }
        if (activeNav === "AI Scribe") {
          const { notes } = await apiRequest<{ notes: Note[] }>(`/api/scribe?patientId=${selectedPatientId}`);
          if (!cancelled) setNote(notes.at(-1) ?? null);
        }
        if (activeNav === "Profile") {
          const { settings } = await apiRequest<{ settings: typeof profile & { notifications: typeof notifications } }>("/api/profile/settings");
          if (!cancelled) { setProfile(settings); setNotifications(settings.notifications); }
        }
      } catch (error: unknown) {
        if (!cancelled) setErrorText(error instanceof Error ? error.message : "This workspace service is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeNav, selectedPatientId, patients.length, loadPatients, globalSearch]);

  async function addPatient() {
    if (!newPatient.name.trim()) { setErrorText("Patient name is required."); return; }
    try {
      await apiRequest("/api/patients", { method: "POST", body: JSON.stringify(newPatient) });
      await loadPatients();
      setNewPatient({ name: "", id: "", appointment: "" });
      setShowAddPatient(false);
      setNotice("Patient added and directory refreshed.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Patient could not be added."); }
  }

  async function addAppointment() {
    if (!newAppointment.patientName.trim()) { setErrorText("Patient name is required."); return; }
    try {
      const { appointment } = await apiRequest<{ appointment: Appointment }>("/api/appointments", { method: "POST", body: JSON.stringify(newAppointment) });
      setAppointmentsList((current) => [...current, appointment]);
      setNewAppointment({ patientName: "", channel: "WhatsApp", priority: "Routine", time: "" });
      setShowAddAppointment(false);
      setNotice("Appointment added to today's queue.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Appointment could not be added."); }
  }

  async function generateNote() {
    const content = transcript.trim() || (recordingMode ? "Patient reports intermittent headache and fatigue for two days. No emergency warning signs reported." : "");
    if (!content) { setErrorText("Record a consultation or enter a transcript first."); return; }
    setLoading(true);
    try {
      const { note: created } = await apiRequest<{ note: Note }>("/api/scribe", { method: "POST", body: JSON.stringify({ transcript: content, patientId: selectedPatientId }) });
      setNote(created);
      setTranscript(content);
      setNotice("SOAP draft generated. Review and edit every field before saving.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Scribe generation failed."); } finally { setLoading(false); }
  }

  async function updateNote(action: "save" | "approve") {
    if (!note) return;
    setScribeSaving(true);
    try {
      const { note: updated } = await apiRequest<{ note: Note }>("/api/scribe", { method: "PATCH", body: JSON.stringify({ noteId: note.id, action, subjective: note.subjective, objective: note.objective, assessment: note.assessment, plan: note.plan }) });
      setNote(updated);
      setNotice(action === "approve" ? "SOAP note approved." : "SOAP note saved.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "SOAP note could not be updated."); } finally { setScribeSaving(false); }
  }

  async function runSymptomCheck() {
    if (!symptoms.trim()) { setErrorText("Enter symptoms before checking."); return; }
    try {
      const { analysis } = await apiRequest<{ analysis: { questions: string[]; triage: string; redFlags: string; duration: string; severity: string; urgent: boolean; aiGenerated?: boolean } }>("/api/symptom-analysis", { method: "POST", body: JSON.stringify({ symptoms, patientId: selectedPatientId, duration, severity, associatedSymptoms, medicines }) });
      setSymptomUrgent(analysis.urgent);
      setSymptomResult(`${analysis.aiGenerated ? "✦ AI-generated" : "Demo (no AI configured)"} · Duration: ${analysis.duration} · Severity: ${analysis.severity}\nFollow-up: ${analysis.questions.join(" ")}\nTriage: ${analysis.triage}. ${analysis.redFlags}`);
      if (analysis.urgent) setNotice("Red-flag symptoms detected — routed to the AI Inbox for immediate review. This is a routing signal, not a diagnosis.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Symptom analysis failed."); }
  }

  async function reviewInsight(id: string) {
    try {
      await apiRequest("/api/insights", { method: "POST", body: JSON.stringify({ insightId: id }) });
      setInsights((current) => current.filter((item) => item.id !== id));
      setNotice("Insight marked reviewed.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Insight could not be reviewed."); }
  }

  async function reportAction(reportId: string, action: "analyze" | "summarize") {
    try {
      const endpoint = action === "analyze" ? "/api/medical-records/analyze" : "/api/medical-records/summarize";
      const body = action === "analyze" ? { patientId: selectedPatientId, reportId } : { reportId, title: reports.find((report) => report.id === reportId)?.title };
      const result = await apiRequest<{ analysis?: { trend: string; flag: string; summary: string }; summary?: { keyFindings: string[]; nextStep: string } }>(endpoint, { method: "POST", body: JSON.stringify(body) });
      const text = result.analysis ? `${result.analysis.trend} ${result.analysis.flag} ${result.analysis.summary}` : `${result.summary?.keyFindings.join(" · ")} Next step: ${result.summary?.nextStep}`;
      setNotice(text);
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Report action failed."); }
  }

  async function saveProfile() {
    try { await apiRequest("/api/profile/settings", { method: "PATCH", body: JSON.stringify(profileSection === "Account settings" ? { notifications } : profile) }); setNotice("Settings saved."); setProfileSection("Overview"); }
    catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Settings could not be saved."); }
  }

  async function toggleAvailability() {
    const availableToday = !profile.availableToday;
    try {
      await apiRequest("/api/profile/settings", { method: "PATCH", body: JSON.stringify({ availableToday }) });
      setProfile((current) => ({ ...current, availableToday }));
      setNotice(availableToday ? "Marked available. Today's queue is active." : "Marked away — today's appointments were added to the AI Inbox for rescheduling.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Availability could not be updated."); }
  }

  async function addPrescription() {
    if (!newRx.medication.trim()) { setErrorText("Medication name is required."); return; }
    try {
      const { prescription } = await apiRequest<{ prescription: Prescription }>("/api/prescriptions", { method: "POST", body: JSON.stringify({ patientId: selectedPatientId, medication: newRx.medication, dosage: newRx.dosage }) });
      setPrescriptionList((current) => [prescription, ...current]);
      setNewRx({ medication: "", dosage: "" });
      setNotice(prescription.safetyFlags.length > 0 ? "Draft created — the Safety Engine raised flags. Review before approving." : "Draft created and passed the Safety Engine. Ready for approval.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Prescription could not be drafted."); }
  }

  async function rxAction(id: string, action: "approve" | "dispatch" | "override") {
    try {
      const body: Record<string, string> = { id, action };
      if (action === "override") body.overrideReason = overrideDraft[id] ?? "";
      const { prescription } = await apiRequest<{ prescription: Prescription }>("/api/prescriptions", { method: "PATCH", body: JSON.stringify(body) });
      setPrescriptionList((current) => current.map((item) => (item.id === id ? prescription : item)));
      setNotice(action === "dispatch" ? "Prescription dispatched to pharmacy/patient instructions." : action === "approve" ? "Prescription approved." : "Safety flag overridden with a logged reason — approved.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Prescription action failed."); }
  }

  async function resolveInboxItem(id: string) {
    try {
      await apiRequest("/api/inbox", { method: "PATCH", body: JSON.stringify({ id }) });
      setInboxList((current) => current.filter((item) => item.id !== id));
      setNotice("Inbox item resolved.");
    } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Inbox item could not be resolved."); }
  }

  const filteredPatients = patients.filter(({ name, id }) => `${name} ${id}`.toLowerCase().includes(query.toLowerCase()));
  const title = activeNav === "Profile" ? "Dr. Ananya Arya" : activeNav;
  const descriptions: Record<string, string> = { "New patient chat": "A WhatsApp-style intake conversation that asks symptom-specific follow-up questions and prepares a doctor-ready brief.", Appointments: "Today's queue across WhatsApp, voice call, app, and walk-in intake — sorted by priority.", "AI Inbox": "Overdue and exception work: red-flag symptoms, duplicate identities, conflicting records, and reschedules.", Patients: "Review patient records, appointments, and care status.", "AI Scribe": "Capture a consultation and turn it into a structured SOAP note.", "Copilot chat": "A running Q&A conversation, scoped to the selected patient's record.", "Clinical insights": "Explore evidence-linked summaries and decision support.", "Symptom checker": "Organise symptoms before a visit for a focused consultation.", Prescriptions: "Draft prescriptions, run the Safety Engine, and require explicit doctor sign-off before dispatch.", "Medical records": "Find reports, prescriptions, and source-linked clinical documents.", Profile: "Manage your professional profile and account settings." };

  return <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-8 md:px-10">
    <div className="flex flex-col justify-between gap-6 border-b border-[#e2ebe6] pb-8 lg:flex-row lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5a9b88]">{activeNav === "Profile" ? "CLINICIAN PROFILE" : "WORKSPACE"}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[#173f3c]">{title}</h1><p className="mt-2 text-sm text-[#78908a]">{descriptions[activeNav]}</p></div>{activeNav === "Patients" && <button onClick={() => setShowAddPatient(true)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add patient</button>}{activeNav === "Appointments" && <button onClick={() => setShowAddAppointment(true)} className="flex items-center gap-2 rounded-xl bg-[#07947f] px-4 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New appointment</button>}</div>
    {notice && <p role="status" className="mt-5 rounded-xl border border-[#b9decf] bg-[#f0faf5] p-4 text-sm text-[#317b67]">{notice}</p>}
    {errorText && <p role="alert" className="mt-5 rounded-xl border border-[#efc7c0] bg-[#fff5f2] p-4 text-sm text-[#a45649]">{errorText}</p>}
    {loading && <p className="mt-6 rounded-xl bg-[#edf7f2] p-4 text-sm text-[#5a967e]">Loading {activeNav.toLowerCase()} from the clinic service…</p>}

    {activeNav === "New patient chat" && <section className="mt-8 flex h-[75vh] max-h-[720px] flex-col rounded-2xl border border-[#e1e9e5] bg-white">
      <div className="flex items-center justify-between border-b border-[#edf1ee] px-6 py-4">
        <span className="text-sm font-bold text-[#244642]">AI UPCHAR Assistant</span>
        <button onClick={resetIntake} className="text-xs font-bold text-[#5a9b88] hover:underline">Start new intake</button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {intakeThread.map((turn, index) => <div key={index} className={`flex ${turn.role === "patient" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === "patient" ? "rounded-br-sm bg-[#07947f] text-white" : "rounded-bl-sm bg-[#f3f4fa] text-[#3d4459]"}`}>{turn.content}</div></div>)}

        {intakeStep === "existing-or-new" && <div className="flex gap-2"><button onClick={() => submitIntakeAnswer("New patient")} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">New patient</button><button onClick={() => submitIntakeAnswer("Existing patient")} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">Existing patient</button></div>}
        {intakeStep === "sex" && <div className="flex gap-2">{["Male", "Female", "Other"].map((option) => <button key={option} onClick={() => submitIntakeAnswer(option)} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">{option}</button>)}</div>}

        {["generating-questions", "generating-report", "finalizing"].includes(intakeStep) && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm bg-[#f3f4fa] px-4 py-3 text-sm text-[#8b958e]">Thinking…</div></div>}

        {intakeStep === "done" && intakeResult && <div className="space-y-3 rounded-xl border border-[#e1e9e5] bg-[#fafcfb] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold text-[#244642]">Pre-visit brief for the doctor</span>{intakeUrgent && <span className="rounded-full bg-[#fdeceb] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#b3544a]">Urgent — sent to AI Inbox</span>}</div>
          {intakeReport ? <div className="space-y-2.5 text-sm text-[#455853]">
            <p><span className="font-bold text-[#244642]">Problem: </span>{intakeReport.problemSummary}</p>
            <p><span className="font-bold text-[#244642]">History: </span>{intakeReport.fullHistory}</p>
            <p><span className="font-bold text-[#244642]">Provisional diagnosis (AI-suggested, not final): </span>{intakeReport.provisionalDiagnosis}</p>
            <p><span className="font-bold text-[#244642]">Further tests: </span>{intakeReport.furtherTestsNeeded}</p>
            {intakeReport.recommendedTests.length > 0 && <p><span className="font-bold text-[#244642]">Recommended tests: </span>{intakeReport.recommendedTests.join(", ")}</p>}
            <p><span className="font-bold text-[#244642]">Suggested treatment direction: </span>{intakeReport.recommendedTreatment}</p>
            <div className="flex flex-wrap gap-3 pt-1"><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${intakeReport.urgency === "Emergency" ? "bg-[#fdeceb] text-[#b3544a]" : intakeReport.urgency === "Admit for observation" ? "bg-[#f6efdd] text-[#a17a2d]" : "bg-[#edf7f2] text-[#4f9d78]"}`}>{intakeReport.urgency}</span><span className="rounded-full bg-[#edf2f8] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#6682a5]">Surgery: {intakeReport.surgeryLikely}</span></div>
            <p className="pt-1 text-[11px] text-[#8b958e]">{intakeReport.aiGenerated ? "✦ AI-generated decision support — the doctor confirms every finding before acting on it." : "AI unavailable for this intake — doctor should review the raw history above directly."}</p>
          </div> : <p className="text-sm text-[#8b958e]">Report unavailable — doctor should review the conversation above directly.</p>}
        </div>}
        <div ref={intakeEndRef} />
      </div>
      {!["existing-or-new", "sex", "generating-questions", "generating-report", "finalizing", "done"].includes(intakeStep) && <div className="flex items-end gap-2 border-t border-[#edf1ee] p-4">
        <textarea value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitIntakeAnswer(); } }} placeholder="Type your answer…" className="min-h-11 max-h-32 flex-1 resize-none rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" />
        <button onClick={() => void submitIntakeAnswer()} disabled={!intakeDraft.trim()} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#07947f] px-4 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Send</button>
      </div>}
    </section>}

    {activeNav === "Appointments" && <section className="mt-8 space-y-4">
      {showAddAppointment && <div role="dialog" aria-modal="true" aria-labelledby="add-appointment-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#173f3c]/30 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 id="add-appointment-title" className="text-lg font-bold text-[#244642]">New appointment</h2><button onClick={() => setShowAddAppointment(false)} aria-label="Close new appointment form"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-3"><input autoFocus value={newAppointment.patientName} onChange={(event) => setNewAppointment({ ...newAppointment, patientName: event.target.value })} placeholder="Patient name *" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /><select value={newAppointment.channel} onChange={(event) => setNewAppointment({ ...newAppointment, channel: event.target.value as Appointment["channel"] })} className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none">{(["WhatsApp", "Voice call", "Mobile app", "Walk-in"] as const).map((option) => <option key={option} value={option}>{option}</option>)}</select><select value={newAppointment.priority} onChange={(event) => setNewAppointment({ ...newAppointment, priority: event.target.value as Appointment["priority"] })} className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none">{(["Urgent", "Follow-up", "Routine"] as const).map((option) => <option key={option} value={option}>{option}</option>)}</select><input value={newAppointment.time} onChange={(event) => setNewAppointment({ ...newAppointment, time: event.target.value })} placeholder="Time (e.g. 2:30 PM)" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowAddAppointment(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#6b827a]">Cancel</button><button onClick={addAppointment} disabled={!newAppointment.patientName.trim()} className="rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save appointment</button></div></div></div>}
      {appointmentsList.map((appt) => { const ChannelIcon = channelIcon[appt.channel]; const isOpen = expandedAppointment === appt.id; return <article key={appt.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e4f3ed] text-[#4e927d]"><ChannelIcon className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#244642]">{appt.patientName}</strong><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityTone[appt.priority]}`}>{appt.priority}</span></div><p className="mt-1 text-xs text-[#82958f]">{appt.channel} · {appt.time} · Queue #{appt.queuePosition}</p></div></div><div className="flex shrink-0 gap-2"><button onClick={() => setExpandedAppointment(isOpen ? "" : appt.id)} className="rounded-lg bg-[#edf2f8] px-3 py-2 text-xs font-bold text-[#6682a5]">{isOpen ? "Hide brief" : "View brief"}</button><button onClick={() => { setSelectedPatientId(appt.patientId); navigate("Medical records"); }} className="rounded-lg bg-[#07947f] px-3 py-2 text-xs font-bold text-white">Start consultation</button></div></div>{isOpen && <div className="mt-4 border-t border-[#edf1ee] pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a9b88]">{appt.briefReady ? "AI pre-visit brief" : "Brief pending"}</p><p className="mt-2 text-sm leading-6 text-[#5f7c70]">{appt.briefSummary}</p>{appt.missingInfo && <p className="mt-2 text-xs font-semibold text-[#a17a2d]">Missing: {appt.missingInfo}</p>}</div>}</article>; })}
      {!loading && appointmentsList.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-5 text-sm text-[#317b67]">No appointments in today&apos;s queue yet.</p>}
    </section>}

    {activeNav === "AI Inbox" && <section className="mt-8 space-y-4">
      {inboxList.map((item) => <article key={item.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex-1"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${inboxTypeTone[item.type]}`}>{inboxTypeLabel[item.type]}</span><h2 className="mt-2 text-base font-bold text-[#244642]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[#78908a]">{item.detail}</p>{item.patientName && <p className="mt-2 text-xs font-semibold text-[#5a9b88]">Patient: {item.patientName}</p>}</div><button onClick={() => resolveInboxItem(item.id)} className="shrink-0 rounded-lg bg-[#edf7f2] px-3 py-2 text-xs font-bold text-[#317b67]">Mark resolved</button></div></article>)}
      {!loading && inboxList.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-5 text-sm text-[#317b67]">AI Inbox is clear — no overdue or exception work right now.</p>}
    </section>}

    {activeNav === "Prescriptions" && <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><h2 className="text-lg font-bold text-[#244642]">Draft a new prescription</h2><p className="mt-1 text-xs text-[#82958f]">For {patients.find((patient) => patient.id === selectedPatientId)?.name ?? selectedPatientId}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={newRx.medication} onChange={(event) => setNewRx({ ...newRx, medication: event.target.value })} placeholder="Medication (e.g. Warfarin)" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /><input value={newRx.dosage} onChange={(event) => setNewRx({ ...newRx, dosage: event.target.value })} placeholder="Dosage (e.g. 5mg once daily)" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /></div><button onClick={addPrescription} className="mt-4 rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white">Run Safety Engine &amp; draft</button></div>
      {prescriptionList.map((rx) => <article key={rx.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a9b88]">{rx.status.replace("_", " ")}</p><h3 className="mt-1 text-base font-bold text-[#244642]">{rx.medication} — {rx.dosage}</h3></div>{rx.status === "NEEDS_REVIEW" && <ShieldAlert className="h-5 w-5 shrink-0 text-[#b3544a]" />}</div>
        {rx.safetyFlags.length > 0 && <div className="mt-3 space-y-1.5 rounded-lg bg-[#fdeceb] p-3">{rx.safetyFlags.map((flag) => <p key={flag} className="text-xs font-semibold text-[#a45649]">⚠ {flag}</p>)}</div>}
        {rx.overrideReason && <p className="mt-2 text-xs text-[#82958f]">Override reason on file: {rx.overrideReason}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {rx.status === "SAFETY_CHECK" && <button onClick={() => rxAction(rx.id, "approve")} className="rounded-lg bg-[#07947f] px-3 py-2 text-xs font-bold text-white">Approve &amp; sign</button>}
          {rx.status === "NEEDS_REVIEW" && <><input value={overrideDraft[rx.id] ?? ""} onChange={(event) => setOverrideDraft({ ...overrideDraft, [rx.id]: event.target.value })} placeholder="Reason to override this flag" className="min-w-0 flex-1 rounded-lg border border-[#dce9e3] px-3 py-2 text-xs outline-none" /><button onClick={() => rxAction(rx.id, "override")} disabled={!overrideDraft[rx.id]?.trim()} className="shrink-0 rounded-lg bg-[#b3544a] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Override &amp; approve</button></>}
          {rx.status === "APPROVED" && <button onClick={() => rxAction(rx.id, "dispatch")} className="rounded-lg bg-[#07947f] px-3 py-2 text-xs font-bold text-white">Dispatch to pharmacy/patient</button>}
          {rx.status === "DISPATCHED" && <span className="flex items-center gap-1.5 text-xs font-bold text-[#317b67]"><Check className="h-3.5 w-3.5" /> Dispatched</span>}
        </div>
      </article>)}
      {!loading && prescriptionList.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-5 text-sm text-[#317b67]">No prescriptions drafted for this patient yet.</p>}
    </section>}

    {activeNav === "Patients" && <section className="mt-8 space-y-4">{showAddPatient && <div role="dialog" aria-modal="true" aria-labelledby="add-patient-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#173f3c]/30 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 id="add-patient-title" className="text-lg font-bold text-[#244642]">Add patient</h2><button onClick={() => setShowAddPatient(false)} aria-label="Close add patient form"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-3"><input autoFocus value={newPatient.name} onChange={(event) => setNewPatient({ ...newPatient, name: event.target.value })} placeholder="Full name *" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /><input value={newPatient.id} onChange={(event) => setNewPatient({ ...newPatient, id: event.target.value })} placeholder="Patient ID (optional)" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /><input value={newPatient.appointment} onChange={(event) => setNewPatient({ ...newPatient, appointment: event.target.value })} placeholder="Appointment (optional)" className="rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" /></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowAddPatient(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#6b827a]">Cancel</button><button onClick={addPatient} disabled={!newPatient.name.trim()} className="rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save patient</button></div></div></div>}<div className="flex items-center gap-3 rounded-xl border border-[#e1e9e5] bg-white px-4 py-3"><Search className="h-4 w-4 text-[#91a49e]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name or ID" className="flex-1 text-sm outline-none" /></div>{filteredPatients.map((patient) => <button key={patient.id} onClick={() => { setSelectedPatientId(patient.id); navigate("Medical records"); }} className="flex w-full items-center gap-4 rounded-xl border border-[#e1e9e5] bg-white p-4 text-left hover:border-[#9ac8b8]"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f3ed] text-sm font-bold text-[#4e927d]">{patient.initials}</span><span className="flex-1"><strong className="block text-sm text-[#244642]">{patient.name}</strong><span className="mt-1 block text-xs text-[#82958f]">{patient.id} · {patient.appointment}</span></span><span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[11px] font-bold text-[#5a967e]">{patient.status}</span><ChevronRight className="h-4 w-4" /></button>)}</section>}

    {activeNav === "AI Scribe" && <section className="mt-8 grid gap-5 lg:grid-cols-[360px_1fr]"><div className="rounded-2xl bg-[#124b47] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8bd4be]">Consultation recorder</p><h2 className="mt-3 text-xl font-semibold">{recording ? "Recording in progress" : "Ready to record"}</h2><p className="mt-2 text-sm leading-6 text-[#b8d2ce]">Microphone access is optional in demo mode. A sample transcript is available when permission is denied.</p><div className="mt-8 flex items-center justify-center gap-1">{waveform.slice(0, 20).map((height, index) => <span key={index} className={`w-1 rounded-full ${recording ? "animate-pulse bg-[#72e5b5]" : "bg-[#8ed8c2]"}`} style={{ height: `${height}px` }} />)}</div><p className="mt-5 text-center text-sm font-semibold text-[#b8d2ce]">{Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")} · {recordingMode === "demo" ? "Demo fallback" : recordingMode === "microphone" ? "Microphone" : "Not started"}</p><button onClick={recording ? stopRecording : startRecording} className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#124b47]">{recording ? "Stop recording" : "Start recording"}</button>{!recording && recordingMode && <button onClick={() => void generateNote()} className="mt-3 w-full rounded-xl border border-[#7fcbb4] px-4 py-3 text-sm font-bold text-white">Generate SOAP note</button>}</div><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6"><label className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a9b88]">Patient</label><select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm">{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select><label className="mt-5 block text-xs font-bold uppercase tracking-[0.14em] text-[#5a9b88]">Transcript / demo note</label><textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste consultation text or use the recorder…" className="mt-2 h-28 w-full rounded-lg border border-[#dce9e3] p-3 text-sm outline-none" /><button onClick={() => void generateNote()} disabled={loading} className="mt-3 rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Generate SOAP draft</button>{note && <div className="mt-6 space-y-4 border-t border-[#edf1ee] pt-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a9b88]">SOAP note · <span className="normal-case">{note.status}</span></p>{(["subjective", "objective", "assessment", "plan"] as const).map((field) => <label key={field} className="block text-xs font-bold capitalize text-[#5f7c70]">{field}<textarea value={note[field]} onChange={(event) => setNote({ ...note, [field]: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-[#dce9e3] p-3 text-sm font-normal text-[#244642] outline-none" /></label>)}<div className="flex flex-wrap gap-2"><button onClick={() => void updateNote("save")} disabled={scribeSaving} className="rounded-lg border border-[#9ccbb8] px-4 py-2.5 text-sm font-bold text-[#277a6b]">Save draft</button><button onClick={() => void updateNote("approve")} disabled={scribeSaving || note.status === "approved"} className="rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{note.status === "approved" ? "Approved" : "Approve SOAP note"}</button></div>{note.disclaimer && <p className="text-xs text-[#8b958e]">{note.disclaimer}</p>}</div>}</div></section>}

    {activeNav === "Copilot chat" && <section className="mt-8 flex h-[70vh] max-h-[640px] flex-col rounded-2xl border border-[#e1e9e5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] px-6 py-4">
        <div><label className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a9b88]">Patient</label><select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-1 block rounded-lg border border-[#dce9e3] px-3 py-2 text-sm">{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></div>
        <span className="text-xs text-[#8b958e]">Decision support only — doctor reviews every answer</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {copilotThread.length === 0 && <p className="text-sm text-[#8b958e]">Ask a question about this patient to start the conversation — e.g. &quot;What should I check before adjusting his statin dose?&quot;</p>}
        {copilotThread.map((turn, index) => <div key={index} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === "user" ? "rounded-br-sm bg-[#07947f] text-white" : "rounded-bl-sm bg-[#f3f4fa] text-[#3d4459]"}`}>{turn.role === "assistant" && <span className={`mb-1 block text-[10px] font-bold uppercase tracking-wide ${turn.aiGenerated ? "text-[#6682a5]" : "text-[#a0a8b8]"}`}>{turn.aiGenerated ? "✦ AI copilot" : "Demo response"}</span>}{turn.content}</div></div>)}
        {copilotSending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm bg-[#f3f4fa] px-4 py-3 text-sm text-[#8b958e]">Thinking…</div></div>}
        <div ref={copilotEndRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-[#edf1ee] p-4">
        <textarea value={copilotDraft} onChange={(event) => setCopilotDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendCopilotMessage(); } }} placeholder="Ask a follow-up question…" className="min-h-11 max-h-32 flex-1 resize-none rounded-lg border border-[#dce9e3] px-3 py-2.5 text-sm outline-none" />
        <button onClick={() => void sendCopilotMessage()} disabled={copilotSending || !copilotDraft.trim()} className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#07947f] px-4 text-sm font-bold text-white disabled:opacity-50">{copilotSending ? "…" : <><Send className="h-4 w-4" /> Send</>}</button>
      </div>
    </section>}

    {activeNav === "Clinical insights" && <section className="mt-8 space-y-4">{insights.map((insight) => <article key={insight.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a9b88]">{insight.priority} priority</span><h2 className="mt-2 text-lg font-bold text-[#244642]">{insight.title}</h2><p className="mt-2 text-sm leading-6 text-[#78908a]">{insight.detail}</p></div><button onClick={() => void reviewInsight(insight.id)} className="shrink-0 rounded-lg bg-[#edf7f2] px-3 py-2 text-xs font-bold text-[#317b67]">Mark reviewed</button></div></article>)}{!loading && insights.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-5 text-sm text-[#317b67]">All clinical insights are reviewed.</p>}</section>}

    {activeNav === "Symptom checker" && <section className="mt-8 max-w-3xl rounded-2xl border border-[#e1e9e5] bg-white p-6"><h2 className="text-xl font-bold text-[#244642]">Structured symptom intake</h2><p className="mt-2 text-sm text-[#78908a]">This demo organises information for clinician review; it does not diagnose.</p><textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Describe symptoms, onset, and anything that makes them better or worse" className="mt-6 h-28 w-full rounded-lg border border-[#dce9e3] p-3 text-sm outline-none" /><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Duration (e.g. 2 days)" className="rounded-lg border border-[#dce9e3] p-3 text-sm" /><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-[#dce9e3] p-3 text-sm"><option>Mild</option><option>Moderate</option><option>Severe</option></select><input value={associatedSymptoms} onChange={(event) => setAssociatedSymptoms(event.target.value)} placeholder="Associated symptoms" className="rounded-lg border border-[#dce9e3] p-3 text-sm" /><input value={medicines} onChange={(event) => setMedicines(event.target.value)} placeholder="Current medicines" className="rounded-lg border border-[#dce9e3] p-3 text-sm" /></div><button onClick={() => void runSymptomCheck()} className="mt-5 rounded-lg bg-[#07947f] px-4 py-2.5 text-sm font-bold text-white">Check symptoms</button>{symptomResult && <pre role="status" className={`mt-5 whitespace-pre-wrap rounded-xl p-4 text-sm leading-6 ${symptomUrgent ? "border-2 border-[#e0a49c] bg-[#fdeceb] text-[#a45649]" : "bg-[#f1f7f2] text-[#65806e]"}`}>{symptomUrgent ? "⚠ URGENT — routed to AI Inbox for immediate clinician review.\n\n" : ""}{symptomResult}</pre>}</section>}

    {activeNav === "Medical records" && <section className="mt-8 space-y-4">{reports.map((report) => <article key={report.id} className="rounded-2xl border border-[#e1e9e5] bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a9b88]">{report.type} · {report.date}</p><h2 className="mt-2 font-bold text-[#244642]">{report.title}</h2><p className="mt-1 text-xs text-[#82958f]">{report.status}</p></div><div className="flex gap-2"><button onClick={() => void reportAction(report.id, "analyze")} className="rounded-lg bg-[#edf2f8] px-3 py-2 text-xs font-bold text-[#6682a5]">Analyze</button><button onClick={() => void reportAction(report.id, "summarize")} className="rounded-lg bg-[#f6f0e9] px-3 py-2 text-xs font-bold text-[#a2876c]">Summarize</button></div></div></article>)}{!loading && reports.length === 0 && <p className="rounded-xl bg-[#edf7f2] p-5 text-sm text-[#317b67]">No records for this patient.</p>}<button onClick={() => setSelectedReport(selectedReport ? "" : "upload")} className="rounded-lg border border-dashed border-[#9ccbb8] px-4 py-3 text-sm font-bold text-[#317b67]">{selectedReport ? "Hide upload form" : "Add a medical record"}</button>{selectedReport && <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#d9ddd7] bg-white p-8 text-sm text-[#7d8b82]"><UploadCloud className="mb-2 h-6 w-6" />Choose a PDF demo record<input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await apiRequest("/api/medical-records/reports", { method: "POST", body: JSON.stringify({ patientId: selectedPatientId, title: file.name, type: "Lab report" }) }); const { reports: data } = await apiRequest<{ reports: Report[] }>(`/api/medical-records/reports?patientId=${selectedPatientId}`); setReports(data); setNotice("Medical record added and list refreshed."); } catch (error: unknown) { setErrorText(error instanceof Error ? error.message : "Record upload failed."); } }} /></label>}</section>}

    {activeNav === "Profile" && <section className="mt-8 grid gap-5 lg:grid-cols-[280px_1fr]"><aside className="rounded-2xl border border-[#e1e9e5] bg-white p-4"><div className="flex items-center gap-3 border-b border-[#edf1ee] pb-5"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d5eee4] text-lg font-bold text-[#277a6b]">DA</span><div><strong className="block text-sm text-[#244642]">{profile.fullName}</strong><span className="text-xs text-[#82958f]">{profile.specialty}</span></div></div><nav className="mt-4 space-y-1">{["Overview", "Profile settings", "Account settings"].map((section) => <button key={section} onClick={() => setProfileSection(section)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${profileSection === section ? "bg-[#e8f5ef] text-[#27806b]" : "text-[#78908a]"}`}><Settings className="h-4 w-4" />{section}</button>)}</nav></aside><div className="rounded-2xl border border-[#e1e9e5] bg-white p-6">{profileSection === "Overview" && <div><h2 className="text-2xl font-bold text-[#244642]">{profile.fullName}, MBBS, MD</h2><p className="mt-2 text-sm text-[#82958f]">{profile.specialty} · 12 years of clinical experience</p><div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e1e9e5] p-4"><span className={`h-2.5 w-2.5 rounded-full ${profile.availableToday ? "bg-[#4f9d78]" : "bg-[#b3544a]"}`} /><span className="flex-1 text-sm font-semibold text-[#244642]">{profile.availableToday ? "Available today" : "Marked away — today's queue is being rescheduled"}</span><button onClick={() => void toggleAvailability()} className="rounded-lg border border-[#dce9e3] px-3 py-2 text-xs font-bold text-[#317b67]">{profile.availableToday ? "Mark away" : "Mark available"}</button></div><button onClick={() => setProfileSection("Profile settings")} className="mt-6 rounded-lg bg-[#07947f] px-4 py-2.5 text-xs font-bold text-white">Edit profile</button></div>}{profileSection === "Profile settings" && <div><h2 className="text-xl font-bold text-[#244642]">Profile settings</h2><div className="mt-5 grid gap-4"><input value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} className="rounded-lg border border-[#dce9e3] p-3 text-sm" /><input value={profile.specialty} onChange={(event) => setProfile({ ...profile, specialty: event.target.value })} className="rounded-lg border border-[#dce9e3] p-3 text-sm" /><textarea value={profile.clinicBio} onChange={(event) => setProfile({ ...profile, clinicBio: event.target.value })} placeholder="Clinic bio" className="h-24 rounded-lg border border-[#dce9e3] p-3 text-sm" /></div><button onClick={() => void saveProfile()} className="mt-5 rounded-lg bg-[#07947f] px-4 py-2.5 text-xs font-bold text-white">Save profile changes</button></div>}{profileSection === "Account settings" && <div><h2 className="text-xl font-bold text-[#244642]">Account settings</h2>{(["urgentFollowUps", "weeklySummary", "twoStepSignIn"] as const).map((field) => <label key={field} className="mt-5 flex items-center gap-3 text-sm text-[#5f7c70]"><input type="checkbox" checked={notifications[field]} onChange={(event) => setNotifications({ ...notifications, [field]: event.target.checked })} />{field === "twoStepSignIn" ? "Two-step sign-in" : field === "weeklySummary" ? "Weekly summary" : "Urgent follow-up alerts"}</label>)}<button onClick={() => void saveProfile()} className="mt-6 rounded-lg bg-[#07947f] px-4 py-2.5 text-xs font-bold text-white">Save account settings</button></div>}</div></section>}
  </div>;
}
