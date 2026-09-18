"use client";

import { useEffect } from "react";
import PatientIntakeChat from "@/components/ops/PatientIntakeChat";

export default function PhoneLookupTestPage() {
  useEffect(() => {
    window.__AI_DOCTOR_TEST_RESPONDER__ = (messages) => {
      const latest = messages[messages.length - 1]?.content ?? "";
      if (messages.some((message) => message.content.includes("extract clinically relevant semantic facts"))) {
        const context = JSON.parse(latest) as { latestAnswer?: string; answers?: { sex?: string } };
        const answer = context.latestAnswer?.toLowerCase() ?? "";
        const sex = context.answers?.sex ?? "";
        const vaginal = /vagina|vaginal|yoni/.test(answer);
        const penile = /penis|penile|ling/.test(answer);
        const discharge = /discharge|white|safed pani/.test(answer);
        const facts = [
          ...(vaginal ? [{ kind: "ANATOMY_REFERENCE", value: "vagina", polarity: "PRESENT", confidence: "HIGH", evidence: context.latestAnswer ?? "" }] : []),
          ...(penile ? [{ kind: "ANATOMY_REFERENCE", value: "penis", polarity: "PRESENT", confidence: "HIGH", evidence: context.latestAnswer ?? "" }] : []),
          ...(discharge ? [{ kind: "SYMPTOM", value: "genital discharge", polarity: "PRESENT", confidence: "HIGH", evidence: context.latestAnswer ?? "" }] : []),
        ];
        if (sex === "Man" && vaginal) {
          return JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            facts,
            explanation: "The reported anatomy needs clarification against the declared SEX context without assuming diagnosis or anatomy.",
            question: "Aapne pehle SEX mein 'Man' select kiya tha, lekin ab aapne vagina mein white discharge ki baat kahi hai. Main is baat ko sahi tarah samajhna chahta hoon: kya aap apne pehle answer ko correct karna chahte hain, ya aap kisi aur type ke discharge/problem ki baat kar rahe hain?",
          });
        }
        return JSON.stringify({ status: "CONSISTENT", facts, explanation: "No semantic context conflict identified.", question: "" });
      }
      if (messages.some((message) => message.content.includes("context-aware reasoning layer"))) {
        const context = JSON.parse(latest) as { currentStep?: string; latestAnswer?: string; answers?: { sex?: string } };
        const answer = context.latestAnswer?.toLowerCase() ?? "";
        const sex = context.answers?.sex ?? "";
        const menstrualStatement = /period|menstrual|mahavari|maasik/.test(answer);
        const needsClarification = context.currentStep !== "clarification" && menstrualStatement && (sex === "Man" || sex === "Transgender Man");
        return JSON.stringify(needsClarification ? {
          outcome: "NEEDS_CLARIFICATION",
          interpretation: "The menstrual statement needs clarification against the declared SEX context without assuming anatomy or diagnosis.",
          question: `Aapne pehle SEX mein '${sex}' select kiya tha, lekin ab aapne periods hone ki baat kahi hai. Kya aap menstrual bleeding ki baat kar rahe hain ya kisi aur type ki bleeding/problem?`,
          missingInformation: ["Meaning and source of bleeding"],
        } : {
          outcome: "CONTINUE",
          interpretation: "The answer is sufficiently consistent to continue.",
          question: "",
          missingInformation: [],
        });
      }
      if (messages.some((message) => message.content.includes("select exactly ONE next-best action"))) {
        const context = JSON.parse(latest) as { answers?: { chiefComplaint?: string; duration?: string }; qaLog?: unknown[]; coveredInformation?: string[] };
        const complaint = context.answers?.chiefComplaint?.toLowerCase() ?? "";
        const covered = context.coveredInformation ?? [];
        const decision = (action: string, question: string, coverageTarget: string | null) => JSON.stringify({ action, question, coverageTarget, rationale: "Deterministic browser-test decision for the highest-value uncovered dimension.", missingInformation: ["duration", "severity", "associated_symptoms", "red_flags"].filter((item) => !covered.includes(item)), safetyConcern: action === "ASK_SAFETY_QUESTION", readyToFinalize: action === "READY_TO_FINALIZE" });
        if (/seene|chest|pressure/.test(complaint) && !covered.includes("red_flags")) return decision("ASK_SAFETY_QUESTION", "Kya seene ke pressure ke saath saans phoolna, paseena, behoshi ya dard baazu/jabde tak fail raha hai?", "red_flags");
        if (/\b\d+\s*(din|day|hafte|week|mahine|month)/.test(complaint) && !covered.includes("severity")) return decision("REQUEST_SEVERITY", "Is takleef ki teevrata 1 se 10 mein kitni hai?", "severity");
        if (/bahut|severe|tez/.test(complaint) && !covered.includes("associated_symptoms")) return decision("REQUEST_ASSOCIATED_SYMPTOMS", "Is takleef ke saath aur kaun se lakshan ho rahe hain?", "associated_symptoms");
        if (!covered.includes("severity")) return decision("REQUEST_SEVERITY", "Is takleef ki teevrata 1 se 10 mein kitni hai?", "severity");
        if (!covered.includes("duration") && !context.answers?.duration) return decision("REQUEST_DURATION", "Yeh takleef aapko kab se hai?", "duration");
        if (!covered.includes("red_flags")) return decision("ASK_SAFETY_QUESTION", "Kya iske saath koi achanak bahut tez ya emergency jaisa lakshan hai?", "red_flags");
        if (!covered.includes("associated_symptoms")) return decision("REQUEST_ASSOCIATED_SYMPTOMS", "Iske saath aur kaun se lakshan ho rahe hain?", "associated_symptoms");
        if ((context.qaLog?.length ?? 0) >= 3) return decision("READY_TO_FINALIZE", "", null);
        return decision("REQUEST_RELEVANT_HISTORY", "Kya aapko koi purani bimari ya isi tarah ki takleef pehle bhi hui hai?", "medical_history");
      }
      if (messages.some((message) => message.content.includes("structured pre-visit brief"))) {
        const complaint = latest.match(/Chief complaint:\s*([^\n]+)/)?.[1] ?? "Clinical complaint";
        return JSON.stringify({
          problemSummary: complaint,
          fullHistory: `${complaint}; deterministic follow-up answers captured.`,
          provisionalDiagnosis: "Clinician review required",
          furtherTestsNeeded: "Clinical examination and ECG as advised by doctor",
          recommendedTests: ["ECG"],
          recommendedTreatment: "Doctor review required",
          urgency: "OPD",
          surgeryLikely: "Unlikely",
          aiGenerated: true,
        });
      }
      return JSON.stringify({ questions: latest.includes("Pet mein")
        ? ["Pet mein dard kis hissa mein hai?", "Kya pet dard ke saath ulti ya bukhar bhi hai?"]
        : ["Dard seene ke kis hissa mein hai aur kya baazu ya jabde tak failta hai?", "Kya dard chalne ya mehnat karne par badhta hai?"] });
    };
    return () => { delete window.__AI_DOCTOR_TEST_RESPONDER__; };
  }, []);
  return <main className="min-h-screen bg-[#f5faf7] p-6"><div className="mx-auto max-w-3xl"><PatientIntakeChat /></div></main>;
}
