"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Pencil, Send, X } from "lucide-react";
import { askAIForJSON } from "@/lib/puter-ai";
import { detectRedFlags } from "@/lib/red-flag-keywords";
import { useSubmitPatientIntakeMutation } from "@/lib/apiSlice";
import { Appointment, Patient, PreVisitReport, tone } from "./shared";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/store";
import { clearCitySuggestions, searchCities, selectCity, setCityActiveIndex, setCityQuery } from "@/lib/citySlice";
import { clearLookup, lookupPatientByPhone } from "@/lib/patientLookupSlice";
import { evaluatePatientAnswer, type ReasoningResult } from "@/lib/interview-reasoning";
import { decideNextBestQuestion, type ClinicalQaTurn, type NextBestDecision } from "@/lib/next-best-question";
import { assessSemanticContext, type SemanticFact } from "@/lib/semantic-context";

type IntakeStep =
  | "existing-or-new" | "phone" | "name" | "age" | "sex" | "location"
  | "preferredDate" | "preferredTime" | "chiefComplaint" | "duration"
  | "priorConsultation" | "priorReports"
  | "reasoning" | "clarification" | "generating-questions" | "adaptive-qa" | "generating-report" | "finalizing" | "done";

const GREETING = "Namaste! 👋 Main aapka AI UPCHAR assistant hoon. Appointment book karne aur doctor ke liye aapki jaankari taiyaar karne ke liye main kuch sawaal poochunga.\n\nAap naye patient hain ya pehle bhi yahan aa chuke hain?";
const emptyAnswers = { isReturning: "", phone: "", name: "", age: "", sex: "", location: "", preferredDate: "", preferredTime: "", chiefComplaint: "", duration: "", priorConsultation: "", priorReports: "" };

export default function PatientIntakeChat({ onComplete }: { onComplete?: (result: { patient: Patient; appointment: Appointment; urgent: boolean }) => void }) {
  const [submitIntake] = useSubmitPatientIntakeMutation();
  const [step, setStep] = useState<IntakeStep>("existing-or-new");
  const [thread, setThread] = useState<{ role: "bot" | "patient"; content: string }[]>([{ role: "bot", content: GREETING }]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<IntakeStep | null>(null);
  const [editingOriginal, setEditingOriginal] = useState("");
  const [editingReturnStep, setEditingReturnStep] = useState<IntakeStep | null>(null);
  const replayingEdit = useRef(false);
  const replayStep = useRef<IntakeStep | null>(null);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [qaLog, setQaLog] = useState<ClinicalQaTurn[]>([]);
  const [currentClinicalDecision, setCurrentClinicalDecision] = useState<NextBestDecision | null>(null);
  const [report, setReport] = useState<PreVisitReport | null>(null);
  const [result, setResult] = useState<{ patient: Patient; appointment: Appointment; urgent: boolean } | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [reasoningLog, setReasoningLog] = useState<ReasoningResult[]>([]);
  const [semanticFacts, setSemanticFacts] = useState<SemanticFact[]>([]);
  const semanticFactsRef = useRef<SemanticFact[]>([]);
  const [clarificationLog, setClarificationLog] = useState<{ question: string; answer: string }[]>([]);
  const [pendingClarification, setPendingClarification] = useState<{ sourceStep: IntakeStep; answer: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch<AppDispatch>();
  const citySearch = useSelector((state: RootState) => state.cities);
  const patientLookup = useSelector((state: RootState) => state.patientLookup);
  function handleCityKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!citySearch.suggestions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      dispatch(setCityActiveIndex((citySearch.activeIndex + direction + citySearch.suggestions.length) % citySearch.suggestions.length));
    } else if (event.key === "Enter" && citySearch.activeIndex >= 0) {
      event.preventDefault();
      const city = citySearch.suggestions[citySearch.activeIndex];
      setDraft(city.name);
      dispatch(selectCity(city.name));
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, step]);

  useEffect(() => {
    if (step !== "location") { dispatch(clearCitySuggestions()); return; }
    if (citySearch.selectedCity === draft) { dispatch(clearCitySuggestions()); return; }
    dispatch(setCityQuery(draft));
    if (draft.trim().length < 2) { dispatch(clearCitySuggestions()); return; }
    const timer = window.setTimeout(() => { void dispatch(searchCities(draft.trim())); }, 100);
    return () => window.clearTimeout(timer);
  }, [draft, step, dispatch, citySearch.selectedCity]);

  useEffect(() => {
    if (step !== "phone" || !/^\d{10}$/.test(draft)) { dispatch(clearLookup()); return; }
    if (patientLookup.checkedPhone === draft || patientLookup.loading) return;
    void dispatch(lookupPatientByPhone(draft));
  }, [draft, step, dispatch, patientLookup.checkedPhone, patientLookup.loading]);

  useEffect(() => {
    if (step !== "location") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!citySearch.suggestions.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        dispatch(setCityActiveIndex((citySearch.activeIndex + direction + citySearch.suggestions.length) % citySearch.suggestions.length));
      } else if (event.key === "Enter" && citySearch.activeIndex >= 0) {
        event.preventDefault();
        const city = citySearch.suggestions[citySearch.activeIndex];
        setDraft(city.name);
        dispatch(selectCity(city.name));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, citySearch.suggestions, citySearch.activeIndex, dispatch]);

  function reset() {
    setStep("existing-or-new");
    setThread([{ role: "bot", content: GREETING }]);
    setAnswers(emptyAnswers);
    setQaLog([]);
    setCurrentClinicalDecision(null);
    setReport(null);
    setResult(null);
    setUrgent(false);
    setReasoningLog([]);
    setSemanticFacts([]);
    semanticFactsRef.current = [];
    setClarificationLog([]);
    setPendingClarification(null);
    setDraft("");
    setAttachment(null);
    setEditingIndex(null);
    setEditingStep(null);
    setEditingOriginal("");
    setEditingReturnStep(null);
  }

  function sayBot(content: string) {
    setThread((current) => [...current, { role: "bot", content }]);
  }

  function answersWith(stepToApply: IntakeStep, value: string) {
    const keyByStep: Partial<Record<IntakeStep, keyof typeof emptyAnswers>> = {
      "existing-or-new": "isReturning", phone: "phone", name: "name", age: "age", sex: "sex",
      location: "location", preferredDate: "preferredDate", preferredTime: "preferredTime",
      chiefComplaint: "chiefComplaint", duration: "duration", priorConsultation: "priorConsultation", priorReports: "priorReports",
    };
    const key = keyByStep[stepToApply];
    return key ? { ...answers, [key]: value } : answers;
  }

  async function reasonAbout(stepToEvaluate: IntakeStep, value: string, nextAnswers: typeof answers) {
    const result = await evaluatePatientAnswer({
      currentStep: stepToEvaluate,
      latestAnswer: value,
      answers: nextAnswers,
      previousPatientAnswers: thread.filter((turn) => turn.role === "patient").map((turn) => turn.content),
      followUpAnswers: qaLog,
      clarificationHistory: clarificationLog,
      uploadedFiles: thread.flatMap((turn) => Array.from(turn.content.matchAll(/\[Attached file: (.+?)\]/g), (match) => match[1])),
      urgent,
    });
    setReasoningLog((current) => [...current, result]);
    return result;
  }

  async function assessSemantics(stepToAssess: IntakeStep, value: string, nextAnswers: typeof answers) {
    const assessment = await assessSemanticContext({
      currentStep: stepToAssess,
      latestAnswer: value,
      answers: nextAnswers,
      semanticFacts: semanticFactsRef.current,
      qaLog,
      clarificationHistory: clarificationLog,
      previousPatientAnswers: thread.filter((turn) => turn.role === "patient").map((turn) => turn.content),
    });
    semanticFactsRef.current = [...semanticFactsRef.current, ...assessment.facts];
    setSemanticFacts(semanticFactsRef.current);
    return assessment;
  }

  async function requestNextClinicalQuestion(nextAnswers: typeof answers, nextLog: ClinicalQaTurn[] = qaLog) {
    setStep("generating-questions");
    const decision = await decideNextBestQuestion({ answers: nextAnswers, qaLog: nextLog, semanticFacts: semanticFactsRef.current, clarificationHistory: clarificationLog, previousPatientAnswers: thread.filter((turn) => turn.role === "patient").map((turn) => turn.content), urgent });
    setCurrentClinicalDecision(decision);
    if (decision.action === "READY_TO_FINALIZE") {
      setStep("generating-report");
      sayBot("Bahut achha — zaroori jaankari mil gayi hai. Ab main doctor ke liye summary taiyaar kar raha hoon...");
      await generateReport(nextAnswers, nextLog);
      return;
    }
    sayBot(decision.question);
    if (decision.action === "REQUEST_DURATION") { setStep("duration"); return; }
    if (decision.action === "REQUEST_TREATMENT_HISTORY") { setStep("priorConsultation"); return; }
    if (decision.action === "REQUEST_REPORT") { setStep("priorReports"); return; }
    setStep("adaptive-qa");
  }

  async function continueAfterAnswer(answerStep: IntakeStep, value: string, nextAnswers: typeof answers) {
    setAnswers(nextAnswers);
    if (answerStep === "existing-or-new") { sayBot("Kripya apna 10-digit mobile number bataiye, taaki hum aapka record bana/dhoondh sakein."); setStep("phone"); return; }
    if (answerStep === "phone") { sayBot("Aapka poora naam kya hai?"); setStep("name"); return; }
    if (answerStep === "name") { sayBot("Aapki umar kitni hai (saalon mein)?"); setStep("age"); return; }
    if (answerStep === "age") { sayBot("Aapka ling kya hai?"); setStep("sex"); return; }
    if (answerStep === "sex") { sayBot("Aap kis sheher/ilaake se hain?"); setStep("location"); return; }
    if (answerStep === "location") { sayBot("Aap appointment kis din chahte hain?"); setStep("preferredDate"); return; }
    if (answerStep === "preferredDate") { sayBot("Kis samay aana chahenge — subah, dopahar ya shaam?"); setStep("preferredTime"); return; }
    if (answerStep === "preferredTime") { sayBot("Aapko mukhya roop se kya takleef hai? Aaj kis wajah se aa rahe hain?"); setStep("chiefComplaint"); return; }
    if (["chiefComplaint", "duration", "priorConsultation", "priorReports"].includes(answerStep)) { await requestNextClinicalQuestion(nextAnswers, qaLog); return; }
  }

  async function submit(valueOverride?: string, stepOverride?: IntakeStep) {
    const typedValue = (valueOverride ?? draft).trim();
    const activeStep = stepOverride ?? step;
    if (replayingEdit.current && replayStep.current === "existing-or-new") {
      replayingEdit.current = false;
      replayStep.current = null;
      setDraft("");
      setThread((current) => [...current, { role: "patient", content: typedValue }]);
      setAnswers((current) => ({ ...current, isReturning: typedValue }));
      sayBot("Kripya apna 10-digit mobile number bataiye, taaki hum aapka record bana/dhoondh sakein.");
      setStep("phone");
      return;
    }
    if (replayingEdit.current && replayStep.current === "chiefComplaint") {
      replayingEdit.current = false; replayStep.current = null;
      setDraft(""); setThread((current) => [...current, { role: "patient", content: typedValue }]);
      const replayedAnswers = { ...answers, chiefComplaint: typedValue, duration: "", priorConsultation: "", priorReports: "" };
      setAnswers(replayedAnswers);
      setQaLog([]); setCurrentClinicalDecision(null); setReport(null); setResult(null);
      setClarificationLog([]); setPendingClarification(null); setSemanticFacts([]); semanticFactsRef.current = []; setStep("reasoning");
      const replaySemantics = await assessSemantics("chiefComplaint", typedValue, replayedAnswers);
      if (replaySemantics.status !== "CONSISTENT") { setPendingClarification({ sourceStep: "chiefComplaint", answer: typedValue }); sayBot(replaySemantics.question); setStep("clarification"); return; }
      const replayReasoning = await reasonAbout("chiefComplaint", typedValue, replayedAnswers);
      if (replayReasoning.outcome === "NEEDS_CLARIFICATION") { setPendingClarification({ sourceStep: "chiefComplaint", answer: typedValue }); sayBot(replayReasoning.question); setStep("clarification"); return; }
      if (replayReasoning.outcome === "SAFETY_CONCERN") { setUrgent(true); setPendingClarification({ sourceStep: "chiefComplaint", answer: typedValue }); sayBot(replayReasoning.question); setStep("clarification"); return; }
      await continueAfterAnswer("chiefComplaint", typedValue, replayedAnswers);
      return;
    }
    if (activeStep === "clarification" && pendingClarification) {
      setDraft("");
      setThread((current) => [...current, { role: "patient", content: typedValue }]);
      setStep("reasoning");
      const nextClarifications = [...clarificationLog, { question: thread[thread.length - 1]?.content ?? "Clarification", answer: typedValue }];
      const clarificationSemantics = await assessSemantics("clarification", typedValue, answers);
      if (clarificationSemantics.status !== "CONSISTENT") {
        sayBot(clarificationSemantics.question);
        setStep("clarification");
        return;
      }
      const clarificationReasoning = await evaluatePatientAnswer({ currentStep: "clarification", latestAnswer: typedValue, answers, previousPatientAnswers: thread.filter((turn) => turn.role === "patient").map((turn) => turn.content), followUpAnswers: qaLog, clarificationHistory: nextClarifications, uploadedFiles: [], urgent });
      setReasoningLog((current) => [...current, clarificationReasoning]);
      if (clarificationReasoning.outcome === "NEEDS_CLARIFICATION") { sayBot(clarificationReasoning.question); setStep("clarification"); return; }
      setClarificationLog(nextClarifications);
      const resume = pendingClarification;
      setPendingClarification(null);
      if (clarificationReasoning.outcome === "SAFETY_CONCERN") { setUrgent(true); sayBot(clarificationReasoning.question); setStep("finalizing"); return; }
      await continueAfterAnswer(resume.sourceStep, resume.answer, answers);
      return;
    }
    if (step === "phone" && /^\d{10}$/.test(typedValue)) {
      if (patientLookup.loading || patientLookup.checkedPhone !== typedValue) {
        sayBot("Number check ho raha hai. Kripya ek pal rukiye.");
        return;
      }
      if (patientLookup.matches.length > 0) return;
    }
    if (step === "phone" && !/^\d{10}$/.test(typedValue)) {
      sayBot("Kripya 10 digit ka sahi mobile number likhiye.");
      return;
    }
    const value = attachment ? `${typedValue}${typedValue ? "\n" : ""}[Attached file: ${attachment.name}]` : typedValue;
    const busy: IntakeStep[] = ["reasoning", "generating-questions", "generating-report", "finalizing", "done"];
    if (!value || busy.includes(step)) return;
    if (editingIndex !== null && !replayingEdit.current) {
      const answerStep = editingStep ?? step;
      const editedAt = editingIndex;
      setThread((current) => current.slice(0, editedAt));
      setAnswers((current) => {
        const next = { ...current };
        const order: IntakeStep[] = ["existing-or-new", "phone", "name", "age", "sex", "location", "preferredDate", "preferredTime", "chiefComplaint", "duration", "priorConsultation", "priorReports"];
        const start = order.indexOf(answerStep);
        order.slice(start + 1).forEach((field) => { if (field !== "existing-or-new") delete next[field as keyof typeof next]; });
        return next;
      });
      setQaLog([]); setCurrentClinicalDecision(null); setReport(null); setResult(null); setUrgent(false);
      setReasoningLog([]); setSemanticFacts([]); semanticFactsRef.current = []; setClarificationLog([]); setPendingClarification(null);
      setDraft("");
      setAttachment(null);
      setEditingIndex(null);
      setEditingStep(null);
      setEditingOriginal("");
      setEditingReturnStep(null);
      setStep(answerStep);
      replayStep.current = answerStep;
      replayingEdit.current = true;
      window.setTimeout(() => { void submit(value, answerStep); }, 0);
      return;
    }
    setDraft("");
    setAttachment(null);
    setThread((current) => [...current, { role: "patient", content: value }]);

    const isFreeText = !["existing-or-new", "sex"].includes(activeStep);
    const hasDeterministicRedFlag = isFreeText && detectRedFlags(value).length > 0;
    if (hasDeterministicRedFlag) setUrgent(true);

    const reasonedAnswers = answersWith(activeStep, value);
    if (!hasDeterministicRedFlag && activeStep !== "phone") {
      const semanticAssessment = await assessSemantics(activeStep, value, reasonedAnswers);
      if (semanticAssessment.status !== "CONSISTENT") {
        setAnswers(reasonedAnswers);
        setPendingClarification({ sourceStep: activeStep, answer: value });
        sayBot(semanticAssessment.question);
        setStep("clarification");
        return;
      }
    }
    if (activeStep !== "phone") {
      setStep("reasoning");
      const reasoning = await reasonAbout(activeStep, value, reasonedAnswers);
      if (reasoning.outcome === "NEEDS_CLARIFICATION") {
        setAnswers(reasonedAnswers);
        setPendingClarification({ sourceStep: activeStep, answer: value });
        sayBot(reasoning.question);
        setStep("clarification");
        return;
      }
      if (reasoning.outcome === "SAFETY_CONCERN") {
        setAnswers(reasonedAnswers);
        setUrgent(true);
        setPendingClarification({ sourceStep: activeStep, answer: value });
        sayBot(reasoning.question);
        setStep("clarification");
        return;
      }
    }
    if (activeStep === "adaptive-qa") {
      const question = currentClinicalDecision?.question ?? thread[thread.length - 1]?.content ?? "Clinical follow-up";
      const nextLog: ClinicalQaTurn[] = [...qaLog, { question, answer: value, coverageTarget: currentClinicalDecision?.coverageTarget ?? undefined }];
      setQaLog(nextLog);
      await requestNextClinicalQuestion(reasonedAnswers, nextLog);
      return;
    }
    await continueAfterAnswer(activeStep, value, reasonedAnswers);
  }

  async function generateReport(a: typeof answers, log: { question: string; answer: string }[]) {
    const generated = await askAIForJSON<PreVisitReport>([
      { role: "system", content: "You are drafting a structured pre-visit brief for a doctor, based on a patient intake conversation. This is decision SUPPORT only — never a final diagnosis, and the doctor makes every final call. Be conservative: if anything suggests urgency, say so. Return JSON with EXACTLY these keys: problemSummary (1-2 sentences), fullHistory (a short paragraph combining chief complaint, duration, and all Q&A), provisionalDiagnosis (most likely differential(s), clearly labeled as provisional), furtherTestsNeeded (one sentence: what's needed or say information is sufficient), recommendedTests (array of specific test/scan names, empty array if none), recommendedTreatment (one sentence, illustrative only), urgency (exactly one of \"OPD\", \"Admit for observation\", \"Emergency\"), surgeryLikely (short phrase, e.g. \"Unlikely\", \"Possible if X\", \"Not indicated\")." },
      { role: "user", content: `Name: ${a.name}, Age: ${a.age}, Sex: ${a.sex}, Location: ${a.location}\nChief complaint: ${a.chiefComplaint}\nDuration: ${a.duration}\nPrior consultation: ${a.priorConsultation}\nPrior reports: ${a.priorReports}\nFollow-up Q&A:\n${log.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n")}` },
    ]);
    if (generated) setReport(generated);
    setStep("finalizing");
    await finalize(a, log, generated ?? undefined);
  }

  async function finalize(a: typeof answers, log: { question: string; answer: string }[], rep?: PreVisitReport) {
    try {
      const { patient, appointment, urgent: isUrgent } = await submitIntake({ name: a.name, phone: a.phone, age: a.age, sex: a.sex, location: a.location, preferredDate: a.preferredDate, preferredTime: a.preferredTime, chiefComplaint: a.chiefComplaint, duration: a.duration, priorConsultation: a.priorConsultation, priorReports: a.priorReports, qaLog: log, preVisitReport: rep }).unwrap();
      sayBot(`All set, ${a.name.split(" ")[0]} — aap queue mein hain aur doctor ke paas aapki poori jaankari pehle se pahunch jayegi.`);
      setResult({ patient, appointment, urgent: isUrgent });
      if (appointment.preVisitReport) setReport(appointment.preVisitReport);
      setStep("done");
      onComplete?.({ patient, appointment, urgent: isUrgent });
    } catch {
      sayBot("Kuch gadbad ho gayi intake save karte waqt. Kripya dobara koshish karein.");
      setStep("priorReports");
    }
  }

  const inputDisabled = editingIndex === null && ["existing-or-new", "sex", "reasoning", "generating-questions", "generating-report", "finalizing", "done"].includes(step);
  function stepForEditedAnswer(value: string): IntakeStep | null {
    if (value === "New patient" || value === "Existing patient") return "existing-or-new";
    const entries: [string, IntakeStep][] = [[answers.isReturning, "existing-or-new"], [answers.phone, "phone"], [answers.name, "name"], [answers.age, "age"], [answers.sex, "sex"], [answers.location, "location"], [answers.preferredDate, "preferredDate"], [answers.preferredTime, "preferredTime"], [answers.chiefComplaint, "chiefComplaint"], [answers.duration, "duration"], [answers.priorConsultation, "priorConsultation"], [answers.priorReports, "priorReports"]];
    return entries.find(([answer]) => answer && answer === value)?.[1] ?? null;
  }

  return (
    <div className="flex h-[calc(100dvh-270px)] min-h-[360px] max-h-[720px] flex-col overflow-hidden rounded-2xl border" style={{ borderColor: tone.border, background: tone.card }}>
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "#edf1ee" }}>
        <span className="text-sm font-bold" style={{ color: tone.ink }}>AI UPCHAR Assistant — New Patient Intake</span>
        <button onClick={reset} className="text-xs font-bold hover:underline" style={{ color: tone.primary }}>Start new intake</button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {thread.map((turn, index) => (
          <div key={index} className={`flex ${turn.role === "patient" ? "justify-end" : "justify-start"}`}>
            <div className="group relative max-w-[85%]">
              <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === "patient" ? "rounded-br-sm text-white" : "rounded-bl-sm"}`} style={turn.role === "patient" ? { background: tone.primary } : { background: "#f3f4fa", color: "#3d4459" }}>
                {turn.content}
              </div>
              {turn.role === "patient" && <button type="button" onClick={() => { const cleanValue = turn.content.replace(/\n\[Attached file: .*\]$/, ""); const answerStep = stepForEditedAnswer(cleanValue); setEditingReturnStep(step); if (answerStep) { setStep(answerStep); setEditingStep(answerStep); } setEditingIndex(index); setEditingOriginal(cleanValue); setDraft(cleanValue); }} className="absolute bottom-1 right-2 flex items-center gap-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-black/20" aria-label="Edit message"><Pencil className="h-3 w-3" /> Edit</button>}
              {turn.role === "bot" && turn.content.includes("prescription upload") && <div className="mt-2 flex flex-wrap gap-2"><label htmlFor="patient-report-attachment" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-[#317b67] hover:bg-[#eef7f3]" style={{ borderColor: "#b9dfd1" }}><Paperclip className="h-3.5 w-3.5" />Attach prescription</label><button type="button" onClick={() => void submit("Nahi hai / abhi available nahi hai")} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#317b67] hover:bg-[#eef7f3]" style={{ borderColor: "#b9dfd1" }}>Nahi hai / abhi available nahi hai</button></div>}
              {turn.role === "bot" && turn.content.includes("Koi test report ya scan") && <div className="mt-2 flex flex-wrap gap-2"><label htmlFor="patient-report-attachment" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-[#317b67] hover:bg-[#eef7f3]" style={{ borderColor: "#b9dfd1" }}><Paperclip className="h-3.5 w-3.5" />Attach report</label><button type="button" onClick={() => void submit("Nahi hai / abhi available nahi hai")} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#317b67] hover:bg-[#eef7f3]" style={{ borderColor: "#b9dfd1" }}>Nahi hai / abhi available nahi hai</button></div>}
            </div>
          </div>
        ))}

        {step === "existing-or-new" && <div className="flex gap-2">
          <button onClick={() => submit("New patient")} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: tone.primary, color: tone.primary }}>New patient</button>
          <button onClick={() => submit("Existing patient")} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: tone.primary, color: tone.primary }}>Existing patient</button>
        </div>}
        {step === "sex" && <div className="flex flex-wrap gap-2">{["Man", "Woman", "Transgender Man", "Transgender Woman"].map((option) => <button key={option} onClick={() => submit(option)} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: tone.primary, color: tone.primary }}>{option}</button>)}</div>}

        {["reasoning", "generating-questions", "generating-report", "finalizing"].includes(step) && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm" style={{ background: "#f3f4fa", color: tone.muted }}>Thinking…</div></div>}

        {step === "done" && result && <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: tone.border, background: tone.bg }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold" style={{ color: tone.ink }}>Pre-visit brief for the doctor</span>
            {urgent && <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: tone.dangerBg, color: tone.danger }}>Urgent — flagged for immediate review</span>}
          </div>
          {report ? <div className="space-y-2.5 text-sm" style={{ color: tone.inkSoft }}>
            <p><span className="font-bold" style={{ color: tone.ink }}>Problem: </span>{report.problemSummary}</p>
            <p><span className="font-bold" style={{ color: tone.ink }}>History: </span>{report.fullHistory}</p>
            <p><span className="font-bold" style={{ color: tone.ink }}>Provisional diagnosis (AI-suggested, not final): </span>{report.provisionalDiagnosis}</p>
            <p><span className="font-bold" style={{ color: tone.ink }}>Further tests: </span>{report.furtherTestsNeeded}</p>
            {report.recommendedTests.length > 0 && <p><span className="font-bold" style={{ color: tone.ink }}>Recommended tests: </span>{report.recommendedTests.join(", ")}</p>}
            <p><span className="font-bold" style={{ color: tone.ink }}>Suggested treatment direction: </span>{report.recommendedTreatment}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={report.urgency === "Emergency" ? { background: tone.dangerBg, color: tone.danger } : report.urgency === "Admit for observation" ? { background: tone.accentGoldBg, color: tone.accentGold } : { background: tone.successBg, color: tone.success }}>{report.urgency}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: tone.infoBg, color: tone.info }}>Surgery: {report.surgeryLikely}</span>
            </div>
            <p className="pt-1 text-[11px]" style={{ color: tone.muted }}>{report.aiGenerated ? "✦ AI-generated decision support — the doctor confirms every finding before acting on it." : "AI unavailable for this intake — doctor should review the raw history above directly."}</p>
          </div> : <p className="text-sm" style={{ color: tone.muted }}>Report unavailable — doctor should review the conversation above directly.</p>}
        </div>}
        <div ref={endRef} />
      </div>
      {!inputDisabled && <div className="shrink-0 border-t bg-white p-4" style={{ borderColor: "#edf1ee" }}>
        {attachment && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#eef7f3] px-3 py-2 text-xs text-[#317b67]">
          <Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="h-3.5 w-3.5" /></button>
        </div>}
        <div className="flex items-end gap-2">
          <input type="file" id="patient-report-attachment" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
          {(step !== "priorConsultation" && step !== "priorReports") && <label htmlFor="patient-report-attachment" title="Attach report or old prescription" aria-label="Attach report or old prescription" className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-[#317b67] hover:bg-[#eef7f3]" style={{ borderColor: "#dce9e3" }}><Paperclip className="h-4 w-4" /></label>}
          {step === "phone" ? <div className="flex h-11 min-w-0 flex-1 items-center rounded-lg border px-3 text-sm" style={{ borderColor: "#dce9e3" }}>
            <span className="mr-2 shrink-0 font-semibold text-[#54716d]">+91</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 10))} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), void submit())} inputMode="numeric" maxLength={10} placeholder="10 digit mobile number" aria-label="10 digit mobile number" className="min-w-0 flex-1 bg-transparent outline-none" />
          </div> : step === "preferredDate" ? <input type="date" value={draft} onChange={(event) => setDraft(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} aria-label="Appointment date" className="h-11 min-w-0 flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} /> : step === "preferredTime" ? <input type="time" value={draft} onChange={(event) => setDraft(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} aria-label="Appointment time" className="h-11 min-w-0 cursor-pointer flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} /> : <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder={step === "location" ? "Shahar ka naam likhein…" : "Type your answer…"} className="min-h-11 max-h-32 flex-1 resize-none rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "#dce9e3" }} />}
          {editingIndex !== null && <button type="button" onClick={() => { setDraft(""); setStep(editingReturnStep ?? step); setEditingIndex(null); setEditingStep(null); setEditingOriginal(""); setEditingReturnStep(null); }} className="h-11 shrink-0 rounded-lg border border-[#dce9e3] px-3 text-sm font-semibold text-[#6d827b]">Cancel</button>}
          <button onClick={() => void submit()} disabled={(step === "phone" ? draft.length !== 10 || patientLookup.loading || patientLookup.matches.length > 0 : !draft.trim()) && !attachment} className="flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50" style={{ background: tone.primary }}>{editingIndex !== null ? "Update" : <><Send className="h-4 w-4" /> Send</>}</button>
        </div>
        {step === "phone" && patientLookup.loading && <p className="mt-2 ml-[52px] text-xs text-[#6d958b]">Checking patient record…</p>}
        {step === "phone" && patientLookup.checkedPhone === draft && !patientLookup.loading && patientLookup.matches.length > 0 && <div className="mt-2 rounded-lg border border-[#b9dfd1] bg-[#f1faf6] p-3 text-sm text-[#244642]"><p className="font-semibold">Is number par {patientLookup.matches[0].name} ka record mila hai.</p><p className="mt-1 text-xs text-[#6d827b]">Kya appointment isi patient ke liye hai?</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setAnswers((a) => ({ ...a, phone: draft, name: patientLookup.matches[0].name })); sayBot(`Theek hai, ${patientLookup.matches[0].name} ke liye follow-up appointment book karte hain.`); setStep("preferredDate"); }} className="rounded-lg bg-[#07947f] px-3 py-2 text-xs font-bold text-white">Yes, follow-up</button><button type="button" onClick={() => { dispatch(clearLookup()); sayBot("Theek hai, new patient ke liye nayi details lete hain."); sayBot("Aapka poora naam kya hai?"); setStep("name"); }} className="rounded-lg border border-[#9ccbb8] px-3 py-2 text-xs font-bold text-[#317b67]">No, new patient</button></div></div>}
        {step === "location" && citySearch.suggestions.length > 0 && <div className="mt-2 ml-[52px] max-h-48 overflow-y-auto rounded-lg border border-[#dce9e3] bg-white shadow-sm" role="listbox">
          {citySearch.suggestions.map((city, index) => <button key={`${city.name}-${city.latitude}`} type="button" onMouseEnter={() => dispatch(setCityActiveIndex(index))} onClick={() => { setDraft(city.name); dispatch(selectCity(city.name)); }} className={`block w-full px-3 py-2 text-left text-sm text-[#244642] hover:bg-[#eef7f3] ${citySearch.activeIndex === index ? "bg-[#eef7f3]" : ""}`}>{city.name}</button>)}
        </div>}
      </div>}
    </div>
  );
}
