"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Pencil, Send, X } from "lucide-react";
import { assessAppointmentAnswer, nextAppointmentQuestion, extractSemanticFacts, explicitSexCorrection, type QaTurn, type SemanticFact } from "@/lib/appointmentIntakeReasoning";
import { recordIntakeDecision } from "@/lib/appointmentIntakeDebug";
import { resolveClinicalContext } from "@/lib/clinicalPathways";
import { serverAiAnalyzeImage } from "@/lib/serverAiClient";

type Field = "patientType" | "phone" | "name" | "age" | "sex" | "location" | "preferredDate" | "preferredTime" | "chiefComplaint" | "duration" | "severity" | "associatedSymptoms" | "priorConsultation" | "priorReports" | "clarification" | "done";
type Answers = Partial<Record<Exclude<Field, "clarification" | "done">, string>>;
type Turn = { role: "bot" | "patient"; text: string; field?: Field };
type MatchedPatient = { id: string; name: string; phone?: string };
type PreviousContext = { patientId: string; pastSummary: string; hasHistory: boolean };
type DocumentEvidence = { id: string; name: string; type: string; size: number; file: File; turnIndex: number; extractedSummary?: string };
type PendingAssessment = { status: "NEEDS_CLARIFICATION" | "SAFETY_CONCERN"; sourceAnswer: string };
const clinicalFields = new Set<Field>(["chiefComplaint", "duration", "severity", "associatedSymptoms", "priorConsultation", "priorReports"]);

const greeting = "Namaste! 👋 Main aapka AI UPCHAR assistant hoon. Appointment book karne aur doctor ke liye aapki jaankari taiyaar karne ke liye main kuch sawaal poochunga.";
const questions: Partial<Record<Field, string>> = {
  phone: "Kripya apna 10-digit mobile number bataiye, taaki hum aapka record bana/dhoondh sakein.",
  name: "Aapka poora naam kya hai?", age: "Aapki umar kitni hai (saalon mein)?", sex: "Aapka ling kya hai?",
  location: "Aap kis sheher/ilaake se hain?", preferredDate: "Aap appointment kis din chahte hain?",
  preferredTime: "Kis samay aana chahenge — subah, dopahar ya shaam?", chiefComplaint: "Aapko mukhya roop se kya takleef hai? Aaj kis wajah se aa rahe hain?",
};
const orderedFields: Field[] = ["patientType", "phone", "name", "age", "sex", "location", "preferredDate", "preferredTime", "chiefComplaint", "duration", "severity", "associatedSymptoms", "priorConsultation", "priorReports"];
const localCities = ["Agra", "Ahmedabad", "Bengaluru", "Bhopal", "Chandigarh", "Chennai", "Delhi", "Gurugram", "Hyderabad", "Indore", "Jaipur", "Kanpur", "Kochi", "Kolkata", "Lucknow", "Ludhiana", "Mumbai", "Nagpur", "Noida", "Patna", "Pune", "Ranchi", "Surat", "Varanasi"];

export default function AppointmentIntakeFlow() {
  const [step, setStep] = useState<Field>("patientType");
  const [turns, setTurns] = useState<Turn[]>([{ role: "bot", text: `${greeting}\n\nAap naye patient hain ya pehle bhi yahan aa chuke hain?` }]);
  const [answers, setAnswers] = useState<Answers>({});
  const [qaLog, setQaLog] = useState<QaTurn[]>([]);
  const [semanticFacts, setSemanticFacts] = useState<SemanticFact[]>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentEvidence[]>([]);
  const [lookup, setLookup] = useState<{ loading: boolean; patient: MatchedPatient | null }>({ loading: false, patient: null });
  const [previousContext, setPreviousContext] = useState<PreviousContext | null>(null);
  const [pendingAssessment, setPendingAssessment] = useState<PendingAssessment | null>(null);
  const [useExisting, setUseExisting] = useState(false);
  const [editing, setEditing] = useState<{ turn: number; field: Field; returnStep: Field } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const phoneRequest = useRef(0);
  const sessionId = useRef(`intake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, step]);

  useEffect(() => {
    if (step !== "phone" || !/^\d{10}$/.test(draft)) { setLookup({ loading: false, patient: null }); return; }
    const request = ++phoneRequest.current;
    setLookup({ loading: true, patient: null });
    void fetch(`/api/patients?phone=${encodeURIComponent(draft)}`)
      .then((response) => response.json())
      .then((payload) => { if (request === phoneRequest.current) setLookup({ loading: false, patient: payload?.data?.found ? payload.data.patient : null }); })
      .catch(() => { if (request === phoneRequest.current) setLookup({ loading: false, patient: null }); });
  }, [draft, step]);

  function bot(text: string, field?: Field) { setTurns((current) => [...current, { role: "bot", text, field }]); }
  function patient(text: string, field: Field) { setTurns((current) => [...current, { role: "patient", text, field }]); }
  function ask(field: Field, text = questions[field]) { bot(text ?? "", field); setStep(field); }

  async function askClinical(contextAnswers: Answers, contextLog: QaTurn[], contextFacts = semanticFacts) {
    if (contextAnswers.priorReports) { await finish(contextAnswers, contextLog); return; }
    const next = await nextAppointmentQuestion({
      answers: contextAnswers,
      qaLog: contextLog,
      semanticFacts: contextFacts,
      previousPatientContext: previousContext?.pastSummary ?? "",
      documents: documents.map(({ name, type, size }) => ({ name, type, size, source: "PATIENT" })),
      clinicalPathway: contextAnswers.chiefComplaint ? resolveClinicalContext(contextAnswers.chiefComplaint, contextAnswers.duration ?? "") : null,
      previousAnswers: turns.filter((turn) => turn.role === "patient").map((turn) => turn.text),
    }, contextLog.map((entry) => entry.key));
    recordIntakeDecision(sessionId.current, {
      selectedAction: next.action,
      candidateActions: next.candidateActions,
      reasonCode: next.reasonCode,
      confidence: next.confidence,
      coveredInformation: contextLog.map((entry) => entry.key),
      source: "validated-next-action",
      step: step,
    });
    bot(next.question, next.key);
    setStep(next.key);
  }

  async function evaluateClinicalAnswer(value: string, updated: Answers, contextLog: QaTurn[], contextFacts: SemanticFact[], priorAnswers: string[]) {
    const assessment = await assessAppointmentAnswer({
      latestAnswer: value,
      answers: updated,
      semanticFacts: contextFacts,
      previousAnswers: priorAnswers,
      qaLog: contextLog,
      previousPatientContext: previousContext?.pastSummary ?? "",
      documents: documents.map(({ name, type, size }) => ({ name, type, size, source: "PATIENT" })),
      clinicalPathway: updated.chiefComplaint ? resolveClinicalContext(updated.chiefComplaint, updated.duration ?? "") : null,
    });
    const nextFacts = [...contextFacts, ...assessment.facts];
    setSemanticFacts(nextFacts);
    recordIntakeDecision(sessionId.current, {
      extractedFactKinds: assessment.facts.map((fact) => fact.kind),
      changedFactKeys: assessment.facts.map((fact) => fact.conceptKey ?? fact.value),
      contradictions: assessment.contradictions.map((item) => item.code),
      safetyFlags: assessment.safetyFlags.map((item) => item.code),
      selectedAction: assessment.status === "NEEDS_CLARIFICATION" ? "CLARIFY_CONTRADICTION" : assessment.status === "SAFETY_CONCERN" ? "SAFETY_ESCALATION" : "CONTINUE_APPOINTMENT",
      reasonCode: assessment.reasonCodes.join(","),
      confidence: assessment.facts.some((fact) => fact.confidence === "HIGH") ? "HIGH" : "MEDIUM",
      source: assessment.source,
      step,
    });
    if (assessment.status !== "CONSISTENT") {
      setPendingAssessment({ status: assessment.status, sourceAnswer: value });
      bot(assessment.question, "clarification");
      setStep("clarification");
      return;
    }
    setPendingAssessment(null);
    await askClinical(updated, contextLog, nextFacts);
  }

  async function continueWith(value: string, field = step) {
    const withFile = file ? `${value}${value ? "\n" : ""}[Attached file: ${file.name}]` : value;
    if (!withFile.trim() || busy) return;
    const attachedFile = file;
    if (attachedFile) setDocuments((current) => [...current, { id: `${Date.now()}-${attachedFile.name}`, name: attachedFile.name, type: attachedFile.type, size: attachedFile.size, file: attachedFile, turnIndex: editing?.turn ?? turns.length }]);
    setError(""); setDraft(""); setFile(null);
    if (editing) {
      const position = orderedFields.indexOf(editing.field);
      const reset: Answers = { ...answers, [editing.field]: withFile };
      orderedFields.slice(position + 1).forEach((key) => delete reset[key as keyof Answers]);
      const beforeEdit = turns.slice(0, editing.turn);
      const replayAnswers = beforeEdit.filter((turn) => turn.role === "patient" && turn.field && clinicalFields.has(turn.field)).map((turn) => turn.text);
      const replayFacts = replayAnswers.flatMap((answer) => extractSemanticFacts(answer));
      const replayLog: QaTurn[] = beforeEdit
        .filter((turn) => turn.role === "patient" && turn.field && clinicalFields.has(turn.field) && turn.field !== "chiefComplaint")
        .map((turn) => ({ question: "Clinical question", answer: turn.text, key: turn.field as string }));
      const nextTurns = [...beforeEdit, { role: "patient" as const, text: withFile, field: editing.field }];
      setAnswers(reset); setQaLog(replayLog); setSemanticFacts(replayFacts); setPendingAssessment(null); setUseExisting(false);
      setDocuments((current) => current.filter((document) => document.turnIndex <= editing.turn));
      setTurns(nextTurns);
      setEditing(null);
      if (clinicalFields.has(editing.field)) {
        setBusy(true);
        const currentLog = editing.field === "chiefComplaint" ? replayLog : [...replayLog, { question: "Clinical question", answer: withFile, key: editing.field }];
        await evaluateClinicalAnswer(withFile, reset, currentLog, replayFacts, replayAnswers);
        setBusy(false);
        return;
      }
      if (editing.field === "patientType") { ask("phone"); return; }
      const nextField = orderedFields[position + 1] ?? "done";
      ask(nextField); return;
    }
    patient(withFile, field);
    const updated: Answers = field === "clarification" ? { ...answers } : { ...answers, [field]: withFile };
    setAnswers(updated);
    if (!clinicalFields.has(field) && field !== "clarification") recordIntakeDecision(sessionId.current, { selectedAction: "CONTINUE_APPOINTMENT", reasonCode: `${field.toUpperCase()}_ACCEPTED`, confidence: "HIGH", source: "deterministic-admin-transition", step: field });
    if (field === "patientType") { ask("phone"); return; }
    if (field === "phone") { ask("name"); return; }
    if (field === "name") { ask("age"); return; }
    if (field === "age") { ask("sex"); return; }
    if (field === "sex") { ask("location"); return; }
    if (field === "location") { ask("preferredDate"); return; }
    if (field === "preferredDate") {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (withFile.trim() && withFile.trim() < todayStr) {
        setError("Appointment date cannot be in the past. Please pick today or a later date.");
        bot("Kripya aaj ya aage ki koi date chuniye — beeti hui date valid nahi hai.");
        ask("preferredDate");
        return;
      }
      ask("preferredTime"); return;
    }
    if (field === "preferredTime") { ask("chiefComplaint"); return; }
    if (clinicalFields.has(field)) {
      const priorAnswers = turns.filter((turn) => turn.role === "patient").map((turn) => turn.text);
      const nextLog = field === "chiefComplaint" ? qaLog : [...qaLog, { question: turns[turns.length - 1]?.text ?? "Clinical question", answer: withFile, key: field }];
      setBusy(true); await evaluateClinicalAnswer(withFile, updated, nextLog, semanticFacts, priorAnswers); setBusy(false); return;
    }
    if (field === "clarification") {
      const correction = explicitSexCorrection(withFile);
      setBusy(true);
      if (pendingAssessment?.status === "NEEDS_CLARIFICATION" && /^(nahi|nahin|no|nope)\b/i.test(withFile.trim())) {
        const restated = { ...answers };
        ["chiefComplaint", "duration", "severity", "associatedSymptoms", "priorConsultation", "priorReports"].forEach((key) => delete restated[key as keyof Answers]);
        setAnswers(restated); setQaLog([]); setSemanticFacts([]); setPendingAssessment(null);
        bot("Theek hai. Main aapka SEX answer nahi badal raha. Kripya apni asli takleef ya symptom ko dobara spasht tareeke se batayein.", "chiefComplaint");
        setStep("chiefComplaint");
        setBusy(false);
        return;
      }
      if (correction) {
        const complaint = answers.chiefComplaint ?? "";
        const corrected: Answers = { ...answers, sex: correction, chiefComplaint: complaint };
        ["duration", "severity", "associatedSymptoms", "priorConsultation", "priorReports"].forEach((key) => delete corrected[key as keyof Answers]);
        setAnswers(corrected); setQaLog([]); setSemanticFacts([]);
        setPendingAssessment(null);
        if (complaint) await evaluateClinicalAnswer(complaint, corrected, [], [], []);
        else { ask("location"); }
      } else {
        const priorAnswers = turns.filter((turn) => turn.role === "patient").map((turn) => turn.text);
        await evaluateClinicalAnswer(withFile, updated, qaLog, semanticFacts, priorAnswers);
      }
      setBusy(false);
      return;
    }
  }

  async function finish(finalAnswers: Answers, finalLog: QaTurn[]) {
    setBusy(true); setStep("done");
    try {
      const response = await fetch("/api/appointment-intake", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          ...finalAnswers,
          qaLog: finalLog,
          useExisting,
          semanticFacts,
          previousPatientContext: previousContext,
          documents: documents.map(({ id, name, type, size }) => ({ id, name, type, size, source: "PATIENT" })),
          preVisitReport: {
            problemSummary: finalAnswers.chiefComplaint,
            fullHistory: [finalAnswers.chiefComplaint, finalAnswers.duration, ...finalLog.map((entry) => `${entry.question}: ${entry.answer}`)].filter(Boolean).join(" "),
            urgency: "OPD",
            semanticFacts,
            documents: documents.map(({ name, type, size }) => ({ name, type, size, source: "PATIENT" })),
            previousPatientContext: previousContext?.pastSummary ?? "",
            doctorReviewBoundary: "AI-generated considerations; clinician approval required.",
          },
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Appointment could not be saved.");
      const savedPatientId = payload.data?.patient?.id;
      if (savedPatientId && documents.length) {
        void Promise.all(documents.map(async (document) => {
          const form = new FormData();
          form.append("file", document.file);
          form.append("patientId", savedPatientId);
          form.append("title", document.name);
          form.append("type", /prescription|parchi|rx/i.test(document.name) ? "Prescription" : "Lab report");
          const uploaded = await fetch("/api/reports/upload", { method: "POST", body: form }).then((item) => item.json()).catch(() => null);
          const reportId = uploaded?.data?.report?.id;
          if (reportId && /^image\//i.test(document.type)) {
            const findings = await Promise.race([
              serverAiAnalyzeImage(document.file, "Extract only clearly visible, patient-reported or document-derived clinical facts from this prescription/report. Return concise JSON with documentType, findings, dates, medicines, tests and uncertainties. Do not diagnose or prescribe."),
              new Promise<string>((resolve) => setTimeout(() => resolve("Document analysis timed out; clinician review required."), 8000)),
            ]).catch(() => "Document analysis unavailable; clinician review required.");
            await fetch("/api/reports/upload", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId, findings: String(findings).slice(0, 8000) }) }).catch(() => undefined);
          }
        })).catch(() => undefined);
      }
      bot(`All set, ${payload.data.patient.name.split(" ")[0]} — aapka appointment ${payload.data.appointment.appointmentDate} ko ${payload.data.appointment.appointmentTime} par book ho gaya hai.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Appointment could not be saved.");
      setStep("priorReports");
    } finally { setBusy(false); }
  }

  async function chooseExisting(existing: boolean) {
    if (!lookup.patient) return;
    setUseExisting(existing);
    if (existing) {
      const updated = { ...answers, phone: draft, name: lookup.patient.name, patientType: "Existing patient" };
      setAnswers(updated); patient(draft, "phone"); bot(`Theek hai, ${lookup.patient.name} ke liye follow-up appointment book karte hain.`); setPreviousContext(null); ask("preferredDate");
      try {
        const response = await fetch(`/api/appointments/chat?patientId=${encodeURIComponent(lookup.patient.id)}&context=1`);
        const payload = await response.json();
        if (response.ok && payload?.data) setPreviousContext({ patientId: lookup.patient.id, pastSummary: String(payload.data.pastSummary ?? ""), hasHistory: Boolean(payload.data.hasHistory) });
      } catch { /* previous context is helpful, but must not block booking */ }
    } else { setLookup({ loading: false, patient: null }); bot("Theek hai, new patient ke liye nayi details lete hain."); ask("name"); }
    setDraft("");
  }

  function startEdit(index: number, field?: Field) {
    if (!field || field === "clarification" || field === "done") return;
    setEditing({ turn: index, field, returnStep: step }); setDraft(answers[field] ?? turns[index].text); setStep(field);
  }

  function reset() {
    setStep("patientType"); setTurns([{ role: "bot", text: `${greeting}\n\nAap naye patient hain ya pehle bhi yahan aa chuke hain?` }]); setAnswers({}); setQaLog([]); setSemanticFacts([]); setPendingAssessment(null); setDraft(""); setFile(null); setDocuments([]); setPreviousContext(null); setLookup({ loading: false, patient: null }); setEditing(null); setUseExisting(false); setError("");
  }

  const citySuggestions = step === "location" && draft.length > 1 ? localCities.filter((city) => city.toLowerCase().startsWith(draft.toLowerCase())).slice(0, 6) : [];
  const writeDisabled = busy || step === "patientType" || step === "sex" || step === "done";

  return <div className="mx-auto flex h-[min(760px,calc(100dvh-96px))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dce9e3] bg-white shadow-sm">
    <header className="flex items-center justify-between border-b border-[#edf1ee] px-5 py-4"><div><p className="font-bold text-[#173f3c]">AI UPCHAR Assistant</p><p className="text-xs text-[#78908a]">Appointment booking and pre-visit intake</p></div><button onClick={reset} className="text-xs font-bold text-[#07947f]">Start new intake</button></header>
    <main className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfdfc] p-5">
      {turns.map((turn, index) => <div key={`${turn.role}-${index}`} className={`flex ${turn.role === "patient" ? "justify-end" : "justify-start"}`}><div className="group relative max-w-[85%]"><div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === "patient" ? "rounded-br-sm bg-[#07947f] text-white" : "rounded-bl-sm bg-[#f3f4fa] text-[#3d4459]"}`}>{turn.text}</div>{turn.role === "patient" && turn.field && <button aria-label="Edit message" onClick={() => startEdit(index, turn.field)} className="absolute bottom-1 right-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] text-white"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>}</div></div>)}
      {step === "patientType" && <div className="flex gap-2"><button onClick={() => void continueWith("New patient")} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">New patient</button><button onClick={() => void continueWith("Existing patient")} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">Existing patient</button></div>}
      {step === "sex" && <div className="flex flex-wrap gap-2">{["Man", "Woman", "Transgender Man", "Transgender Woman"].map((option) => <button key={option} onClick={() => void continueWith(option)} className="rounded-full border border-[#07947f] px-4 py-2 text-xs font-bold text-[#07947f]">{option}</button>)}</div>}
      {busy && <div className="inline-flex rounded-2xl bg-[#f3f4fa] px-4 py-3 text-sm text-[#78908a]">Thinking…</div>}<div ref={endRef} />
    </main>
    {step !== "done" && <footer className="border-t border-[#edf1ee] bg-white p-4"><input id="appointment-intake-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{file && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#eef7f3] px-3 py-2 text-xs text-[#317b67]"><Paperclip className="h-3 w-3" />{file.name}<button className="ml-auto" onClick={() => setFile(null)} aria-label="Remove attachment"><X className="h-3 w-3" /></button></div>}
      <div className="flex items-end gap-2"><label htmlFor="appointment-intake-file" aria-label="Attach report or prescription" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#dce9e3] text-[#07947f]"><Paperclip className="h-4 w-4" /></label>{step === "phone" ? <div className="flex h-11 flex-1 items-center rounded-lg border border-[#dce9e3] px-3"><span className="mr-2 font-semibold text-[#54716d]">+91</span><input aria-label="10 digit mobile number" value={draft} onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 10))} className="min-w-0 flex-1 outline-none" inputMode="numeric" /></div> : step === "preferredDate" ? <input aria-label="Appointment date" type="date" min={new Date().toISOString().slice(0, 10)} value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-[#dce9e3] px-3" /> : step === "preferredTime" ? <input aria-label="Appointment time" type="time" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-[#dce9e3] px-3" /> : <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void continueWith(draft); } }} placeholder={step === "location" ? "Shahar ka naam likhein…" : "Type your answer…"} className="min-h-11 max-h-28 flex-1 resize-none rounded-lg border border-[#dce9e3] px-3 py-2.5 outline-none" />}{editing && <button onClick={() => { setDraft(""); setStep(editing.returnStep); setEditing(null); }} className="h-11 rounded-lg border border-[#dce9e3] px-3 text-sm text-[#6d827b]">Cancel</button>}<button disabled={writeDisabled || (step === "phone" ? draft.length !== 10 || lookup.loading || Boolean(lookup.patient) : !draft.trim() && !file)} onClick={() => void continueWith(draft)} className="flex h-11 items-center gap-2 rounded-lg bg-[#07947f] px-4 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{editing ? "Update" : "Send"}</button></div>
      {step === "phone" && lookup.loading && <p className="mt-2 text-xs text-[#6d958b]">Checking patient record…</p>}{step === "phone" && lookup.patient && <div className="mt-2 rounded-lg border border-[#b9dfd1] bg-[#f1faf6] p-3 text-sm text-[#244642]"><b>Is number par {lookup.patient.name} ka record mila hai.</b><p className="mt-1 text-xs">Kya appointment isi patient ke liye hai?</p><div className="mt-2 flex gap-2"><button onClick={() => chooseExisting(true)} className="rounded-lg bg-[#07947f] px-3 py-2 text-xs font-bold text-white">Yes, follow-up</button><button onClick={() => chooseExisting(false)} className="rounded-lg border border-[#9ccbb8] px-3 py-2 text-xs font-bold text-[#317b67]">No, new patient</button></div></div>}{citySuggestions.length > 0 && <div className="mt-2 overflow-hidden rounded-lg border border-[#dce9e3] bg-white">{citySuggestions.map((city) => <button key={city} onClick={() => setDraft(city)} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef7f3]">{city}</button>)}</div>}{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </footer>}
  </div>;
}
