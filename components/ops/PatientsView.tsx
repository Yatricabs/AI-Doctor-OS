"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Clipboard, ClipboardList, Clock, Eye,
  FileText, FlaskConical, Link2, MapPin, MessageSquare, MoreVertical, Paperclip, Phone, Pill, Plus, Redo2, Save,
  Search, Sparkles, Stethoscope, Trash2, Undo2, User, X,
} from "lucide-react";
import {
  useCreateFollowUpMutation, useDraftPrescriptionMutation, useGetPatient360Query, useGetPatientsQuery,
  useGetPreVisitSummaryQuery, useGetServicesQuery, useUpdateAppointmentMutation,
} from "@/lib/apiSlice";
import type { ConsultationPlan, OrderedTest, PreVisitReport, PrescriptionItem } from "./shared";
import "@/styles/consultation.css";

// ── Small helpers ──────────────────────────────────────────────────────────
const URGENCY_LABEL: Record<NonNullable<PreVisitReport["urgencyLevel"]>, string> = {
  routine: "Routine", opd: "OPD", urgent: "Urgent", admit: "Admit for observation", emergency: "Emergency",
};
function urgencyToneVars(u?: PreVisitReport["urgencyLevel"]): React.CSSProperties {
  switch (u) {
    case "emergency": case "admit": return { background: "var(--danger-bg)", color: "var(--danger)" };
    case "urgent": return { background: "var(--gold-bg)", color: "var(--gold)" };
    case "routine": return { background: "var(--success-bg)", color: "var(--success)" };
    default: return { background: "var(--info-bg)", color: "var(--info)" };
  }
}
function confidenceToneVars(c?: PreVisitReport["diagnosisConfidence"]): React.CSSProperties {
  if (c === "low") return { background: "var(--danger-bg)", color: "var(--danger)" };
  if (c === "high") return { background: "var(--success-bg)", color: "var(--success)" };
  return { background: "var(--gold-bg)", color: "var(--gold)" };
}

// ── Root ────────────────────────────────────────────────────────────────────
export default function PatientsView({ openPatientId, onOpenPatient }: { openPatientId: string | null; onOpenPatient: (patientId: string | null) => void }) {
  if (openPatientId) return <PatientDetail patientId={openPatientId} onBack={() => onOpenPatient(null)} />;
  return <PatientList onOpenPatient={onOpenPatient} />;
}

// ── Patient list ──────────────────────────────────────────────────────────
function PatientList({ onOpenPatient }: { onOpenPatient: (patientId: string) => void }) {
  const { data, isLoading } = useGetPatientsQuery();
  const patients = data?.patients ?? [];
  const [q, setQ] = useState("");
  const filtered = patients.filter((p) => `${p.name} ${p.id} ${p.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="cw">
      <div className="cw-list-search">
        <Search size={16} style={{ color: "var(--muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, or phone" />
      </div>
      {isLoading ? <p className="cw-muted" style={{ marginTop: 16 }}>Loading patients…</p> : (
        <div className="cw-list-grid">
          {filtered.map((p) => (
            <button key={p.id} className="cw-list-card" onClick={() => onOpenPatient(p.id)}>
              <div className="cw-row">
                <span className="cw-avatar cw-avatar--sm">{p.initials}</span>
                <div>
                  <p className="cw-bold" style={{ margin: 0 }}>{p.name}</p>
                  <p className="cw-muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{p.id} · {p.age ? `${p.age} yrs, ` : ""}{p.sex}</p>
                </div>
              </div>
              <p className="cw-soft" style={{ margin: "12px 0 0", fontSize: 12 }}>{p.appointment}</p>
              {p.location && <p className="cw-muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{p.location}</p>}
            </button>
          ))}
          {filtered.length === 0 && <p className="cw-muted">No patients match your search.</p>}
        </div>
      )}
    </div>
  );
}

// ── Patient detail: the consultation workspace ───────────────────────────────
type TabKey = "overview" | "appointments" | "reports" | "prescriptions" | "aisummary" | "timeline";

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data, isLoading } = useGetPatient360Query(patientId);
  const { data: summary } = useGetPreVisitSummaryQuery(patientId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [convoOpen, setConvoOpen] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function startConsultation() {
    setTab("overview");
    // let the overview render, then bring the notes/plan column into view
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    setToast("Consultation started — assessment & plan ready.");
  }

  if (isLoading) return <div className="cw"><p className="cw-muted">Loading patient record…</p></div>;
  if (!data) return <div className="cw"><p style={{ color: "var(--danger)" }}>Could not load this patient.</p></div>;

  const { patient, appointments, reports, prescriptions, aiSummary, nextFollowUp } = data;
  const latest = appointments[0];

  const tabs: { key: TabKey; label: string; icon?: React.ReactNode }[] = [
    { key: "overview", label: "Overview" },
    { key: "appointments", label: `Appointments (${appointments.length})` },
    { key: "reports", label: `Reports (${reports.length})` },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})` },
    { key: "aisummary", label: "AI Summary", icon: <Sparkles size={13} /> },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <div className="cw" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button className="cw-back" onClick={onBack}><ArrowLeft size={14} /> Back to Patients</button>

      {/* Patient header */}
      <div className="cw-card">
        <div className="cw-between">
          <div className="cw-row" style={{ alignItems: "flex-start" }}>
            <span className="cw-avatar">{patient.initials}</span>
            <div>
              <div className="cw-row" style={{ gap: 8 }}>
                <h2 className="cw-bold" style={{ margin: 0, fontSize: 20 }}>{patient.name}</h2>
                <span className="cw-pill" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Active Patient</span>
              </div>
              <div className="cw-header-meta">
                {patient.age && <span><User size={13} /> {patient.age} years</span>}
                {patient.sex && <span>{patient.sex}</span>}
                {patient.phone && <span><Phone size={13} /> {patient.phone}</span>}
                {patient.location && <span><MapPin size={13} /> {patient.location}</span>}
              </div>
            </div>
          </div>
          <div className="cw-row" style={{ gap: 20, alignItems: "flex-start" }}>
            <div className="cw-header-facts">
              <div><div className="cw-fact-label">Patient ID</div><div className="cw-fact-value">{patient.id}</div></div>
              <div><div className="cw-fact-label">Last Visit</div><div className="cw-fact-value">{latest ? latest.date : "—"}</div></div>
              <div><div className="cw-fact-label">Next Appointment</div><div className="cw-fact-value">{nextFollowUp ? `${nextFollowUp.date}${nextFollowUp.time ? ` · ${nextFollowUp.time}` : ""}` : "Not Scheduled"}</div></div>
            </div>
            <div className="cw-row" style={{ gap: 8, position: "relative" }}>
              <button className="cw-btn cw-btn--dark" onClick={startConsultation}><Stethoscope size={14} /> Start Consultation</button>
              <button className="cw-btn" onClick={() => setTab("timeline")}>View Full History</button>
              <button className="cw-overflow" aria-label="More options" onClick={() => setMenuOpen((o) => !o)}><MoreVertical size={16} /></button>
              {menuOpen && (
                <div className="cw-menu" onMouseLeave={() => setMenuOpen(false)}>
                  <button className="cw-menu-item" onClick={() => { setTab("reports"); setMenuOpen(false); }}><FileText size={14} /> View reports</button>
                  <button className="cw-menu-item" onClick={() => { setTab("prescriptions"); setMenuOpen(false); }}><Pill size={14} /> View prescriptions</button>
                  <button className="cw-menu-item" onClick={() => { window.print(); setMenuOpen(false); }}><Eye size={14} /> Print / export</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="cw-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`cw-tab${tab === t.key ? " cw-tab--active" : ""}`} onClick={() => setTab(t.key)}>
            <span className="cw-row" style={{ gap: 6 }}>{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {(tab === "overview" || tab === "aisummary") && (
        <div className="cw-grid">
          <div className="cw-col">
            <AiSummaryCard report={aiSummary} summary={summary} appointmentLabel={latest ? `${latest.date} · ${latest.time}` : undefined} visitTypeLabel={latest?.visitType} />
            <div className="cw-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <ConversationCard turns={summary?.intake.story ?? []} fallback={latest?.reason} baseTime={latest ? `${latest.date}T${latest.time}` : undefined} onViewAll={() => setConvoOpen(true)} />
              <DocumentsCard docs={summary?.reports ?? []} />
            </div>
          </div>
          <div className="cw-col" ref={planRef}>
            <AssessmentPlanCard patientId={patientId} appointmentId={latest?.id} patientName={patient.name} suggestedTests={aiSummary?.recommendedTestsInitial ?? []} onToast={setToast} />
          </div>
        </div>
      )}

      {tab === "appointments" && (
        <div className="cw-col">
          {appointments.length === 0 ? <p className="cw-muted">No appointments yet.</p> : appointments.map((a) => (
            <div key={a.id} className="cw-card">
              <div className="cw-between">
                <p className="cw-bold" style={{ margin: 0 }}>{a.date} · {a.time}</p>
                <span className="cw-pill" style={{ background: "var(--info-bg)", color: "var(--info)" }}>{a.visitType}</span>
              </div>
              <p className="cw-soft" style={{ margin: "6px 0 0", fontSize: 13 }}>{a.reason}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className="cw-col">
          {reports.length === 0 ? <p className="cw-muted">No reports yet.</p> : reports.map((r) => (
            <div key={r.id} className="cw-doc"><span className="cw-bold">{r.title}</span><span className="cw-muted" style={{ fontSize: 12 }}>{r.type} · {r.date}</span></div>
          ))}
        </div>
      )}

      {tab === "prescriptions" && (
        <div className="cw-col">
          {prescriptions.length === 0 ? <p className="cw-muted">No prescriptions yet.</p> : prescriptions.map((rx) => (
            <div key={rx.id} className="cw-card"><p className="cw-bold" style={{ margin: 0 }}>{rx.medication || "Prescription"}</p><p className="cw-muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{rx.status}</p></div>
          ))}
        </div>
      )}

      {tab === "timeline" && <TimelineCard appointments={appointments} reports={reports} prescriptions={prescriptions} />}

      {convoOpen && (
        <div className="cw-modal-overlay" onClick={() => setConvoOpen(false)}>
          <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cw-section-head">
              <div className="cw-section-title"><MessageSquare size={16} style={{ color: "var(--primary)" }} /> Full Conversation</div>
              <button className="cw-iconbtn" onClick={() => setConvoOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="cw-chat" style={{ marginTop: 12 }}>
              {(summary?.intake.story ?? []).length === 0 ? <p className="cw-muted">No conversation captured yet.</p> : (summary?.intake.story ?? []).map((t, i) => (
                <div key={i}>
                  {t.question && <p className="cw-muted" style={{ fontSize: 12, margin: "6px 0 2px" }}>{t.question}</p>}
                  <div className="cw-bubble"><span className="cw-bubble-avatar">P</span><div className="cw-bubble-body"><div className="cw-bubble-text">{t.answer}</div></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cw-toast">{toast}</div>}
    </div>
  );
}

// ── AI Pre-visit summary grid ────────────────────────────────────────────────
function Tile({ icon, title, value, note, variant, items }: { icon?: React.ReactNode; title: string; value?: string; note?: string; variant?: "info" | "danger" | "gold"; items?: string[] }) {
  return (
    <div className={`cw-tile${variant ? ` cw-tile--${variant}` : ""}`}>
      <div className="cw-tile-title">{icon}{title}</div>
      {value && <div className="cw-tile-value">{value}</div>}
      {note && <div className="cw-tile-note">{note}</div>}
      {items && items.length > 0 && <ul className="cw-tile-list">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>}
    </div>
  );
}

function AiSummaryCard({ report, summary, appointmentLabel, visitTypeLabel }: { report: PreVisitReport | null; summary?: { intake: { story: unknown[] } } | undefined; appointmentLabel?: string; visitTypeLabel?: string }) {
  if (!report) {
    return (
      <div className="cw-card">
        <div className="cw-section-head"><div className="cw-section-title"><span className="cw-ai-head">AI</span> AI Pre-Visit Summary</div></div>
        <p className="cw-muted" style={{ marginTop: 12 }}>No AI pre-visit summary on file yet. It appears here automatically once the patient completes intake.</p>
      </div>
    );
  }
  const conditions = report.possibleConditions ?? [];
  const keyConcerns = report.keyConcerns && report.keyConcerns.length ? report.keyConcerns : conditions.slice(0, 4);
  const associated = report.associatedSymptoms ?? [];
  const tests = report.recommendedTestsInitial ?? [];
  const redFlags = report.redFlags ?? [];
  const messageCount = report.messageCount ?? (summary?.intake.story?.length ?? undefined);

  return (
    <div className="cw-card">
      <div className="cw-section-head">
        <div>
          <div className="cw-section-title"><span className="cw-ai-head">AI</span> AI Pre-Visit Summary</div>
          <div className="cw-section-sub">{report.generatedAt ? `Generated from patient's conversation on ${new Date(report.generatedAt).toLocaleString("en-IN")}` : "Generated from patient intake"}</div>
        </div>
        <div className="cw-row" style={{ gap: 8 }}>
          {typeof messageCount === "number" && <span className="cw-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>Based on {messageCount} messages</span>}
        </div>
      </div>

      {/* Header badges */}
      <div className="cw-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {report.visitType && <span className="cw-pill" style={{ background: "var(--info-bg)", color: "var(--info)" }}>{report.visitType === "returning" ? "Follow-up patient" : "New patient"}</span>}
        {report.urgencyLevel && <span className="cw-pill" style={urgencyToneVars(report.urgencyLevel)}>{URGENCY_LABEL[report.urgencyLevel]}</span>}
        {report.diagnosisConfidence && <span className="cw-pill" style={confidenceToneVars(report.diagnosisConfidence)}>Confidence: {report.diagnosisConfidence}</span>}
      </div>

      {/* Row 1: complaint / duration / severity */}
      <div className="cw-summary-grid">
        <Tile icon={<FileText size={13} />} title="Chief Complaint" value={report.chiefComplaint || report.problemSummary} note={report.specialty} />
        <Tile icon={<Clock size={13} />} title="Duration" value={report.duration || "—"} note={report.duration ? "Since symptom started" : undefined} />
        <Tile icon={<AlertTriangle size={13} />} title="Severity" value={typeof report.severityScore === "number" ? `${report.severityScore} / 10` : (report.urgencyLevel ? URGENCY_LABEL[report.urgencyLevel] : "—")} note={report.severityLabel} />
      </div>

      {/* Row 2: associated symptoms / patient background / visit details */}
      <div className="cw-summary-grid" style={{ marginTop: 12 }}>
        <Tile icon={<ClipboardList size={13} />} title="Associated Symptoms" items={associated.length ? associated : ["No other symptoms reported"]} />
        <Tile icon={<User size={13} />} title="Patient Background" items={[report.visitType === "returning" ? "Returning patient" : "New patient", report.fullHistory ? report.fullHistory.slice(0, 90) : "History captured at intake"]} />
        <Tile icon={<Calendar size={13} />} title="Visit Details" items={[appointmentLabel ? `Appointment: ${appointmentLabel}` : "Not scheduled", `Visit type: ${visitTypeLabel ?? (report.visitType === "returning" ? "Follow-up" : "New")}`]} />
      </div>

      {/* Row 3: key concerns / clinical considerations / suggested tests */}
      <div className="cw-summary-grid" style={{ marginTop: 12 }}>
        <Tile icon={<AlertTriangle size={13} />} title="Key Concerns" variant="danger" items={keyConcerns.length ? keyConcerns : ["Reviewed at consultation"]} />
        <Tile icon={<Sparkles size={13} />} title="Clinical Considerations (AI)" variant="gold" items={conditions.length ? conditions : ["For doctor's review"]} />
        <Tile icon={<FlaskConical size={13} />} title="Suggested Tests (AI)" variant="info" items={tests.length ? tests : ["As per clinical evaluation"]} />
      </div>

      {/* Red-flag alarm banner */}
      {redFlags.length > 0 && (
        <div className="cw-tile cw-tile--danger" style={{ marginTop: 12 }}>
          <div className="cw-tile-title"><AlertTriangle size={14} /> Alarming signs — needs attention</div>
          <ul className="cw-tile-list">{redFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}

      <div className="cw-note-line cw-note-line--muted">
        <AlertTriangle size={14} style={{ flex: "none", marginTop: 1 }} />
        <span>This is an AI-generated summary based on patient-reported information. It is not a final diagnosis or prescription.</span>
      </div>
    </div>
  );
}

// ── Conversation panel ───────────────────────────────────────────────────────
function ConversationCard({ turns, fallback, baseTime, onViewAll }: { turns: { question: string; answer: string; kind: string }[]; fallback?: string; baseTime?: string; onViewAll?: () => void }) {
  const messages = turns.length ? turns.map((t) => t.answer).filter(Boolean) : (fallback ? [fallback] : []);
  // Derive a per-message timestamp. Uses the appointment time when available,
  // otherwise counts back from "now" so every message still shows a time.
  const start = baseTime && !Number.isNaN(new Date(baseTime).getTime())
    ? new Date(baseTime)
    : new Date(Date.now() - messages.length * 60000);
  const stamp = (i: number): string => new Date(start.getTime() + i * 60000).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="cw-card">
      <div className="cw-section-head">
        <div className="cw-section-title"><MessageSquare size={16} style={{ color: "var(--primary)" }} /> Patient Conversation</div>
        {messages.length > 0 && <button className="cw-btn cw-btn--ghost cw-btn--sm" style={{ color: "var(--primary)" }} onClick={onViewAll}>View Full Conversation →</button>}
      </div>
      {messages.length === 0 ? (
        <p className="cw-muted" style={{ marginTop: 12 }}>No conversation captured yet.</p>
      ) : (
        <div className="cw-chat">
          {messages.slice(0, 6).map((m, i) => (
            <div key={i} className="cw-bubble">
              <span className="cw-bubble-avatar">P</span>
              <div className="cw-bubble-body">
                <div className="cw-bubble-text">{m}</div>
                <div className="cw-bubble-time">{stamp(i)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents panel ──────────────────────────────────────────────────────────
function DocumentsCard({ docs }: { docs: { id: string; title: string; type: string; date: string; fileUrl: string | null }[] }) {
  return (
    <div className="cw-card">
      <div className="cw-section-title"><Paperclip size={16} style={{ color: "var(--primary)" }} /> Uploaded Documents</div>
      {docs.length === 0 ? (
        <div className="cw-empty" style={{ marginTop: 12 }}>
          <FileText size={28} />
          <p className="cw-bold" style={{ margin: 0 }}>No documents available</p>
          <p className="cw-muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Patient hasn&apos;t uploaded any reports or documents yet.</p>
        </div>
      ) : (
        <div className="cw-col" style={{ marginTop: 12 }}>
          {docs.map((d) => (
            <div key={d.id} className="cw-doc">
              <span className="cw-row" style={{ gap: 8 }}><FileText size={15} style={{ color: "var(--info)" }} /><span className="cw-bold">{d.title}</span></span>
              {d.fileUrl ? <a className="cw-btn cw-btn--sm" href={d.fileUrl} target="_blank" rel="noreferrer"><Link2 size={12} /> View</a> : <span className="cw-muted" style={{ fontSize: 12 }}>{d.type}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Doctor's Assessment & Plan (right column) ────────────────────────────────
const emptyItem = (): PrescriptionItem => ({ medicationName: "", dose: "", frequency: "", duration: "", instructions: "" });
const NOTE_TEMPLATES = ["General OPD note", "Follow-up review", "Gynecology consult"];
const RX_TEMPLATES = ["Antibiotic course", "Antifungal course", "Symptomatic relief"];

function AssessmentPlanCard({ patientId, appointmentId, patientName, suggestedTests, onToast }: { patientId: string; appointmentId?: string; patientName: string; suggestedTests: string[]; onToast: (m: string) => void }) {
  const [plan, setPlan] = useState<ConsultationPlan>({
    notes: "", diagnosis: "", items: [emptyItem()], tests: [],
    followUpAfter: "", followUpUnit: "Days", followUpType: "In-clinic Visit", followUpInstructions: "",
  });
  const [shareWithPatient, setShareWithPatient] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const { data: servicesData } = useGetServicesQuery();
  const [draftPrescription, { isLoading: savingRx }] = useDraftPrescriptionMutation();
  const [createFollowUp, { isLoading: savingFu }] = useCreateFollowUpMutation();
  const [updateAppointment, { isLoading: completing }] = useUpdateAppointmentMutation();
  const saving = savingRx || savingFu || completing;

  const [testQuery, setTestQuery] = useState("");
  const testMatches = useMemo(() => {
    const services = servicesData?.services ?? [];
    return services.filter((s) => s.name.toLowerCase().includes(testQuery.toLowerCase())).slice(0, 6);
  }, [servicesData, testQuery]);

  function setItem(i: number, key: keyof PrescriptionItem, value: string) {
    setPlan((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)) }));
  }
  function addItem() { setPlan((p) => ({ ...p, items: [...p.items, emptyItem()] })); }
  function removeItem(i: number) { setPlan((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) })); }
  function addTest(t: OrderedTest) {
    setPlan((p) => (p.tests.some((x) => x.name === t.name) ? p : { ...p, tests: [...p.tests, t] }));
    setTestQuery("");
  }
  function removeTest(name: string) { setPlan((p) => ({ ...p, tests: p.tests.filter((t) => t.name !== name) })); }
  function addAllSuggested() { suggestedTests.forEach((t) => addTest({ name: t })); }

  function exec(cmd: string) { document.execCommand(cmd, false); editorRef.current?.focus(); }
  function exec2(cmd: string, value: string) { document.execCommand(cmd, false, value); editorRef.current?.focus(); syncNotes(); }
  function syncNotes() { setPlan((p) => ({ ...p, notes: editorRef.current?.innerHTML ?? "" })); }

  async function persist(): Promise<boolean> {
    try {
      const items = plan.items.filter((it) => it.medicationName.trim());
      if (items.length > 0) {
        await draftPrescription({
          patientId, visitId: appointmentId, notes: plan.notes,
          items: items.map((it) => ({ medicationName: it.medicationName, dose: it.dose, frequency: it.frequency, route: "oral", duration: it.duration, instructions: it.instructions })),
        }).unwrap();
      }
      if (plan.followUpAfter.trim() && plan.followUpType !== "None") {
        const days = plan.followUpUnit === "Weeks" ? Number(plan.followUpAfter) * 7 : plan.followUpUnit === "Months" ? Number(plan.followUpAfter) * 30 : Number(plan.followUpAfter);
        const due = new Date(); due.setDate(due.getDate() + (Number.isFinite(days) ? days : 7));
        await createFollowUp({
          patientId, visitId: appointmentId,
          title: `${plan.followUpType} follow-up`,
          description: plan.followUpInstructions || plan.diagnosis || "Consultation follow-up",
          dueDate: due.toISOString().slice(0, 10),
          priority: "routine",
        }).unwrap();
      }
      return true;
    } catch {
      onToast("Could not save — please try again.");
      return false;
    }
  }

  function preview() {
    const rows = plan.items.filter((it) => it.medicationName.trim())
      .map((it) => `<tr><td>${it.medicationName}</td><td>${it.dose}</td><td>${it.frequency}</td><td>${it.duration ?? ""}</td><td>${it.instructions ?? ""}</td></tr>`).join("");
    const testLines = plan.tests.map((t) => `<li>${t.name}</li>`).join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { onToast("Allow pop-ups to preview the prescription."); return; }
    w.document.write(`<!doctype html><html><head><title>Prescription — ${patientName}</title>
      <style>body{font-family:system-ui,Arial,sans-serif;color:#173f3c;padding:32px;} h1{font-size:18px;} h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#5f7c70;margin-top:20px;} table{width:100%;border-collapse:collapse;margin-top:8px;} th,td{border:1px solid #e1e9e5;padding:6px 8px;text-align:left;font-size:13px;} .muted{color:#78908a;font-size:12px;}</style>
      </head><body>
      <h1>AI UPCHAR — Consultation Summary</h1>
      <p class="muted">Patient: <b>${patientName}</b> · Dr. Raj Kumar (General Physician) · ${new Date().toLocaleString("en-IN")}</p>
      ${plan.diagnosis ? `<h2>Diagnosis</h2><p>${plan.diagnosis}</p>` : ""}
      ${plan.notes ? `<h2>Consultation Notes</h2><div>${plan.notes}</div>` : ""}
      ${rows ? `<h2>Prescription</h2><table><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
      ${testLines ? `<h2>Tests / Investigations</h2><ul>${testLines}</ul>` : ""}
      ${plan.followUpAfter ? `<h2>Follow-up</h2><p>${plan.followUpType} after ${plan.followUpAfter} ${plan.followUpUnit}. ${plan.followUpInstructions}</p>` : ""}
      <p class="muted" style="margin-top:24px">AI-assisted — reviewed and confirmed by the treating doctor.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  async function onSave() { if (await persist()) onToast("Consultation plan saved."); }
  async function onComplete() {
    const ok = await persist();
    if (!ok) return;
    try {
      if (appointmentId) await updateAppointment({ appointmentId, status: "completed" }).unwrap();
      onToast("Consultation marked as completed.");
    } catch { onToast("Saved, but could not update appointment status."); }
  }

  return (
    <div className="cw-col">
      {/* Consultation notes card */}
      <div className="cw-card">
        <div className="cw-section-head">
          <div className="cw-section-title"><Clipboard size={16} style={{ color: "var(--info)" }} /> Doctor&apos;s Assessment &amp; Plan</div>
          <button className="cw-btn cw-btn--ghost cw-btn--sm" style={{ color: "var(--primary)" }} onClick={onSave}><Save size={12} /> Save Draft</button>
        </div>

        {/* Consultation notes heading (all plan sections render stacked below) */}
        <div className="cw-section-title" style={{ fontSize: 13, marginTop: 14 }}><FileText size={15} style={{ color: "var(--info)" }} /> Consultation Notes</div>

        <div style={{ marginTop: 10 }}>
          <div className="cw-toolbar">
            <button className="cw-toolbar-btn" title="Bold" onClick={() => exec("bold")}><strong>B</strong></button>
            <button className="cw-toolbar-btn" title="Italic" onClick={() => exec("italic")}><em>I</em></button>
            <button className="cw-toolbar-btn" title="Underline" onClick={() => exec("underline")}><span style={{ textDecoration: "underline" }}>U</span></button>
            <button className="cw-toolbar-btn" title="Bulleted list" onClick={() => exec("insertUnorderedList")}>•</button>
            <button className="cw-toolbar-btn" title="Numbered list" onClick={() => exec("insertOrderedList")}>1.</button>
            <button className="cw-toolbar-btn" title="Insert link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec2("createLink", url); }}><Link2 size={14} /></button>
            <button className="cw-toolbar-btn" title="Undo" onClick={() => exec("undo")}><Undo2 size={14} /></button>
            <button className="cw-toolbar-btn" title="Redo" onClick={() => exec("redo")}><Redo2 size={14} /></button>
            <span className="cw-spacer" />
            <select className="cw-select" style={{ width: "auto", height: 28, padding: "2px 8px", fontSize: 12 }}
              onChange={(e) => { if (e.target.value && editorRef.current) { editorRef.current.innerHTML += `<p>${e.target.value}</p>`; syncNotes(); } e.currentTarget.selectedIndex = 0; }}>
              <option value="">Templates</option>
              {NOTE_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div ref={editorRef} className="cw-editor" contentEditable suppressContentEditableWarning data-placeholder="Write your consultation notes here…" onInput={syncNotes} />

          <div style={{ marginTop: 12 }}>
            <label className="cw-label">Working diagnosis</label>
            <textarea className="cw-textarea" style={{ minHeight: 70 }} placeholder="Record the provisional / confirmed diagnosis…" value={plan.diagnosis} onChange={(e) => setPlan((p) => ({ ...p, diagnosis: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Prescription card */}
      <div className="cw-card">
        <div className="cw-section-head">
          <div className="cw-section-title"><Pill size={16} style={{ color: "var(--primary)" }} /> Prescription</div>
          <div className="cw-row" style={{ gap: 8 }}>
            <select className="cw-select" style={{ width: "auto", height: 30, padding: "3px 8px", fontSize: 12 }}
              onChange={(e) => { if (e.target.value) setItem(0, "medicationName", e.target.value); e.currentTarget.selectedIndex = 0; }}>
              <option value="">Use Template</option>
              {RX_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="cw-btn cw-btn--sm" onClick={addItem}><Plus size={12} /> Add Medicine</button>
          </div>
        </div>
        <table className="cw-table">
          <thead><tr><th>#</th><th>Medicine Name</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th><th></th></tr></thead>
          <tbody>
            {plan.items.map((it, i) => (
              <tr key={i}>
                <td className="cw-td-num">{i + 1}</td>
                <td><input className="cw-input" placeholder="Select medicine" value={it.medicationName} onChange={(e) => setItem(i, "medicationName", e.target.value)} /></td>
                <td><input className="cw-input" placeholder="Dose" value={it.dose} onChange={(e) => setItem(i, "dose", e.target.value)} style={{ width: 76 }} /></td>
                <td><input className="cw-input" placeholder="Freq" value={it.frequency} onChange={(e) => setItem(i, "frequency", e.target.value)} style={{ width: 84 }} /></td>
                <td><input className="cw-input" placeholder="Days" value={it.duration} onChange={(e) => setItem(i, "duration", e.target.value)} style={{ width: 72 }} /></td>
                <td><input className="cw-input" placeholder="e.g. After food" value={it.instructions} onChange={(e) => setItem(i, "instructions", e.target.value)} /></td>
                <td>{plan.items.length > 1 && <button className="cw-iconbtn" title="Remove" onClick={() => removeItem(i)} style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="cw-btn cw-btn--ghost cw-btn--sm" style={{ color: "var(--primary)", marginTop: 8 }} onClick={addItem}><Plus size={12} /> Add Another Medicine</button>
      </div>

      {/* Tests / Investigations card */}
      <div className="cw-card">
        <div className="cw-section-head">
          <div className="cw-section-title"><FlaskConical size={16} style={{ color: "var(--info)" }} /> Tests / Investigations</div>
          <div className="cw-row" style={{ gap: 8 }}>
            {suggestedTests.length > 0 && <button className="cw-btn cw-btn--sm" style={{ color: "var(--primary)" }} onClick={addAllSuggested}><Sparkles size={12} /> Suggested (AI)</button>}
            <button className="cw-btn cw-btn--sm" onClick={() => setTestQuery(" ")}><Plus size={12} /> Add Test</button>
          </div>
        </div>
        <div className="cw-list-search" style={{ marginTop: 10 }}>
          <Search size={15} style={{ color: "var(--muted)" }} />
          <input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Search or select test…" />
        </div>
        {testQuery.trim() && testMatches.length > 0 && (
          <div className="cw-suggest">
            {testMatches.map((s) => <button key={s.id} className="cw-suggest-btn" onClick={() => addTest({ name: s.name, category: s.category })}><Plus size={11} /> {s.name}</button>)}
          </div>
        )}
        {suggestedTests.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="cw-label"><span className="cw-row" style={{ gap: 6 }}><Sparkles size={12} /> Suggested by AI</span></div>
            <div className="cw-suggest">
              {suggestedTests.map((t, i) => <button key={i} className="cw-suggest-btn" onClick={() => addTest({ name: t })}><Plus size={11} /> {t}</button>)}
            </div>
          </div>
        )}
        {plan.tests.length > 0 && (
          <div className="cw-chips">
            {plan.tests.map((t) => <span key={t.name} className="cw-chip">{t.name}<button onClick={() => removeTest(t.name)} title="Remove"><Trash2 size={12} /></button></span>)}
          </div>
        )}
      </div>

      {/* Follow-up & Plan card */}
      <div className="cw-card">
        <div className="cw-section-title"><Calendar size={16} style={{ color: "var(--primary)" }} /> Follow-up &amp; Plan</div>
        <div className="cw-plan-grid">
          <div>
            <label className="cw-label">Follow-up after</label>
            <div className="cw-inline">
              <input className="cw-input" placeholder="7" value={plan.followUpAfter} onChange={(e) => setPlan((p) => ({ ...p, followUpAfter: e.target.value }))} style={{ width: 70 }} />
              <select className="cw-select" value={plan.followUpUnit} onChange={(e) => setPlan((p) => ({ ...p, followUpUnit: e.target.value as ConsultationPlan["followUpUnit"] }))}>
                <option>Days</option><option>Weeks</option><option>Months</option>
              </select>
            </div>
          </div>
          <div>
            <label className="cw-label">Follow-up type</label>
            <select className="cw-select" value={plan.followUpType} onChange={(e) => setPlan((p) => ({ ...p, followUpType: e.target.value as ConsultationPlan["followUpType"] }))}>
              <option>In-clinic Visit</option><option>Teleconsultation</option><option>None</option>
            </select>
          </div>
          <div className="cw-plan-full">
            <label className="cw-label">Additional instructions for patient</label>
            <textarea className="cw-textarea" style={{ minHeight: 70 }} placeholder="e.g. Bring reports, continue medicine, lifestyle advice…" value={plan.followUpInstructions} onChange={(e) => setPlan((p) => ({ ...p, followUpInstructions: e.target.value }))} />
          </div>
        </div>

        {/* Footer actions */}
        <div className="cw-actions">
          <label className="cw-check"><input type="checkbox" checked={shareWithPatient} onChange={(e) => setShareWithPatient(e.target.checked)} /> Share with Patient (Optional)</label>
          <span className="cw-spacer" />
          <button className="cw-btn" onClick={preview}><Eye size={14} /> Preview</button>
          <button className="cw-btn cw-btn--dark" onClick={onSave} disabled={saving}><Save size={14} /> Save</button>
          <button className="cw-btn cw-btn--primary" onClick={onComplete} disabled={saving}><CheckCircle2 size={14} /> Mark as Completed</button>
        </div>
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function TimelineCard({ appointments, reports, prescriptions }: { appointments: { id: string; date: string; time: string; reason: string }[]; reports: { id: string; title: string; date: string }[]; prescriptions: { id: string; status: string; createdAt?: string }[] }) {
  const events = [
    ...appointments.map((a) => ({ when: `${a.date} ${a.time}`, icon: <Calendar size={14} />, label: "Appointment", detail: a.reason })),
    ...reports.map((r) => ({ when: r.date, icon: <FileText size={14} />, label: "Report", detail: r.title })),
    ...prescriptions.map((p) => ({ when: p.createdAt ?? "", icon: <Pill size={14} />, label: "Prescription", detail: p.status })),
  ].filter((e) => e.when).sort((a, b) => (a.when < b.when ? 1 : -1));

  return (
    <div className="cw-card">
      <div className="cw-section-title"><Clock size={16} style={{ color: "var(--primary)" }} /> Timeline</div>
      {events.length === 0 ? <p className="cw-muted" style={{ marginTop: 12 }}>No history yet.</p> : (
        <div className="cw-col" style={{ marginTop: 12 }}>
          {events.map((e, i) => (
            <div key={i} className="cw-row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span className="cw-iconbtn" style={{ height: 30, width: 30, color: "var(--primary)" }}>{e.icon}</span>
              <div>
                <p className="cw-bold" style={{ margin: 0, fontSize: 13 }}>{e.label} <span className="cw-muted" style={{ fontWeight: 400 }}>· {e.when}</span></p>
                <p className="cw-soft" style={{ margin: "2px 0 0", fontSize: 12 }}>{e.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
