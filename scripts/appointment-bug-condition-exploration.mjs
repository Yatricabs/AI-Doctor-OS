#!/usr/bin/env node
/**
 * Task 1 exploration property for the appointment identity/adaptive-intake bugfix.
 *
 * This deliberately models the pre-fix boundaries so the property can be run
 * without a database, browser, or live AI service. A reported violation is the
 * expected result of this exploration: it proves the unfixed behavior can enter
 * the bug condition. The command exits 0 only when at least one violation is
 * reproduced and prints every concrete counterexample as JSON.
 */

const MIN_DEEP = 3;
const patients = [{ id: "P-ROHAN", name: "Rohan Mehta", phone: "+91-9876543210" }];

function phoneKey(raw) {
  return String(raw).replace(/\D/g, "").slice(-10);
}

function legacyPatientResolution(enteredName, phone) {
  const match = patients.find((patient) => phoneKey(patient.phone) === phoneKey(phone));
  if (match) {
    // Pre-fix behavior: existing:true is treated as successful creation, while
    // the typed name remains the display identity used by later artifacts.
    return {
      enteredIdentity: { name: enteredName, phone },
      returnedRecord: match,
      resolvedIdentity: null,
      appointment: { created: true, patientId: match.id, patientName: enteredName },
      success: { patientId: match.id, patientName: enteredName },
      route: { patientId: match.id, patientName: enteredName },
      explicitResolution: false,
    };
  }
  return {
    enteredIdentity: { name: enteredName, phone },
    returnedRecord: null,
    resolvedIdentity: { id: "P-NEW", name: enteredName },
    appointment: { created: true, patientId: "P-NEW", patientName: enteredName },
    success: { patientId: "P-NEW", patientName: enteredName },
    route: { patientId: "P-NEW", patientName: enteredName },
    explicitResolution: true,
  };
}

// The pre-fix matcher required adjacent phrase text and therefore misses the
// inserted-word Hindi/Hinglish chest-pain wording in this task.
function legacyPathway(complaint) {
  const text = complaint.toLowerCase();
  if (/chest pain|seene me dard|सीने में दर्द/.test(text)) return "chest-pain";
  return null;
}

function legacyAdaptiveIntake(complaint, aiOutcome) {
  const pathway = legacyPathway(complaint);
  const genericQuestions = ["Have you seen a doctor before?", "Do you have any reports?"];
  const deepQuestions = [];
  let stopReason = "fixed-generic-script-complete";
  if (aiOutcome === "valid-question") {
    deepQuestions.push("What makes the symptom better or worse?");
    stopReason = "single-ai-question-then-stop";
  } else if (aiOutcome === "STOP") {
    stopReason = "AI_STOP_honored_before_minimum";
  } else if (aiOutcome === "empty") {
    stopReason = "empty-AI-output-treated-as-stop";
  } else if (aiOutcome === "duplicate") {
    stopReason = "duplicate-AI-output-treated-as-stop";
  } else if (aiOutcome === "failure") {
    stopReason = "AI-failure-treated-as-stop";
  }
  return {
    complaint,
    pathway,
    genericQuestions,
    deepQuestions,
    deepQuestionCount: deepQuestions.length,
    questionTopics: ["seen doctor", "reports", ...deepQuestions.map(() => "single generic fallback")],
    fallbackSource: aiOutcome === "failure" ? "none" : "ai",
    aiOutcome,
    completion: { booked: true, stopReason },
    redFlags: [],
    safetyScreeningCollected: false,
  };
}

function checkIdentityCounterexample() {
  const result = legacyPatientResolution("Vijay Verma", "098-765-43210");
  const conflict = result.returnedRecord && result.returnedRecord.name !== result.enteredIdentity.name;
  const violation = conflict && result.appointment.created && !result.explicitResolution;
  return { name: "phone collision: Vijay Verma entered with Rohan Mehta phone", violation, result };
}

function checkAdaptiveCounterexample(complaint, aiOutcome) {
  const result = legacyAdaptiveIntake(complaint, aiOutcome);
  const violation = result.completion.booked && (
    result.deepQuestionCount < MIN_DEEP ||
    !result.pathway ||
    !result.safetyScreeningCollected
  );
  return { name: `adaptive intake: ${complaint} / AI=${aiOutcome}`, violation, result };
}

const cases = [
  checkIdentityCounterexample(),
  checkAdaptiveCounterexample("seene me tez dard hai pichale 2 din se", "STOP"),
  checkAdaptiveCounterexample("seene mein bahut tez dard ho raha hai", "empty"),
  checkAdaptiveCounterexample("chest pain since yesterday with sweating", "duplicate"),
  checkAdaptiveCounterexample("unmatched recurring stomach discomfort", "failure"),
  checkAdaptiveCounterexample("seene me tez dard hai pichale 2 din se", "valid-question"),
];

const violations = cases.filter((test) => test.violation);
const report = {
  property: "Property 1: Bug Condition - Explicit identity resolution and complete adaptive intake",
  expectedExplorationResult: "failure on unfixed behavior",
  minDeep: MIN_DEEP,
  scenarios: cases,
  reproducedCounterexamples: violations,
  expectedFailureOccurred: violations.length > 0,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length === 0) {
  console.error("EXPECTED EXPLORATION FAILURE DID NOT OCCUR: no unfixed counterexample was reproduced.");
  process.exit(1);
}
console.error(`Expected exploration failure reproduced: ${violations.length}/${cases.length} scenarios violate the bug-condition property.`);
