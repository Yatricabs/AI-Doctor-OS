import assert from "node:assert/strict";
import { checkIntelligibility, validateIntakeInput } from "../lib/intakeValidation.ts";

const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, status: "passed" });
}

console.log("==================================================================");
console.log("RUNNING AI UPCHAR INTAKE VALIDATION & GIBBERISH TESTS");
console.log("==================================================================");

// ── 1. The exact screenshot strings must be detected as gibberish ──
await check("Exact screenshot chief complaint 'nnlknkn' is detected as gibberish", () => {
  const result = checkIntelligibility("nnlknkn");
  assert.equal(result.intelligible, false, "'nnlknkn' must not be intelligible");
  const validation = validateIntakeInput("chiefComplaint", "nnlknkn");
  assert.equal(validation.valid, false, "'nnlknkn' must fail chiefComplaint validation");
  assert.match(validation.message, /Maaf kijiye.*takleef samajh nahi paaye/i);
});

await check("Exact screenshot duration 'kjlnln' is detected as gibberish", () => {
  const result = checkIntelligibility("kjlnln");
  assert.equal(result.intelligible, false, "'kjlnln' must not be intelligible");
  const validation = validateIntakeInput("duration", "kjlnln");
  assert.equal(validation.valid, false, "'kjlnln' must fail duration validation");
  assert.match(validation.message, /takleef kitne samay se hai/i);
});

await check("Exact screenshot severity 'nlknlnlkn' is detected as gibberish", () => {
  const result = checkIntelligibility("nlknlnlkn");
  assert.equal(result.intelligible, false, "'nlknlnlkn' must not be intelligible");
  const validation = validateIntakeInput(
    "adaptive-qa",
    "nlknlnlkn",
    "Is takleef ki teevrata 1 se 10 mein kitni hai?"
  );
  assert.equal(validation.valid, false, "'nlknlnlkn' must fail severity validation");
  assert.match(validation.message, /1 se 10 ke scale/i);
});

await check("All 13 transcript strings from user live test are rejected as gibberish", () => {
  const transcriptCases = [
    { step: "name", input: "mbln" },
    { step: "age", input: "jlilkn" },
    { step: "location", input: "knlknlknlkn" },
    { step: "chiefComplaint", input: "nnlknkn" },
    { step: "duration", input: "kjnlnln" },
    { step: "adaptive-qa", input: "nlknlnlkn", question: "Is takleef ki teevrata 1 se 10 mein kitni hai?" },
    { step: "adaptive-qa", input: "lknlkn", question: "Iske saath aur kaun se lakshan ho rahe hain?" },
    { step: "adaptive-qa", input: "lknlkn", question: "Kya iske saath behoshi, saans lene mein dikkat...?" },
    { step: "adaptive-qa", input: "jkn", question: "Kya aapko koi purani bimari ya isi tarah ki takleef pehle bhi hui hai?" },
    { step: "adaptive-qa", input: "jkj", question: "Kya aapne is takleef ke liye pehle koi ilaaj ya doctor ki salah li hai?" },
    { step: "adaptive-qa", input: "lkjon", question: "Kya aap abhi koi dawa niyamit roop se le rahe hain?" },
    { step: "priorReports", input: "kjjkn" },
    { step: "adaptive-qa", input: "dfsdf", question: "Is takleef se aapki rozmarra ki activities par kitna asar pad raha hai?" },
  ];

  for (const c of transcriptCases) {
    const res = validateIntakeInput(c.step, c.input, c.question);
    assert.equal(res.valid, false, `Expected '${c.input}' for step '${c.step}' to be rejected as gibberish`);
    assert.ok(res.message && res.message.length > 0, `Expected error message for '${c.input}'`);
  }
});

// ── 2. Other common keyboard smashes and invalid patterns ──
await check("Home-row keyboard walk 'asdfgh' is detected as nonsense", () => {
  const result = checkIntelligibility("asdfgh");
  assert.equal(result.intelligible, false);
});

await check("Character repetition 'aaaaaa' is detected as nonsense", () => {
  const result = checkIntelligibility("aaaaaa");
  assert.equal(result.intelligible, false);
});

await check("Punctuation-only string '.....' is detected as nonsense", () => {
  const result = checkIntelligibility(".....");
  assert.equal(result.intelligible, false);
});

await check("Pure greeting 'hi' or 'hello' is rejected as a chief complaint", () => {
  const validation = validateIntakeInput("chiefComplaint", "hello");
  assert.equal(validation.valid, false);
  assert.match(validation.message, /Namaste.*takleef ya bimari ke lakshan/i);
});

await check("Pure numeric input '12345' is rejected as a chief complaint", () => {
  const validation = validateIntakeInput("chiefComplaint", "12345");
  assert.equal(validation.valid, false);
});

// ── 3. Name, Age, Location validations ──
await check("Gibberish name 'asdfgh' or numeric name '1234' is rejected", () => {
  assert.equal(validateIntakeInput("name", "asdfgh").valid, false);
  assert.equal(validateIntakeInput("name", "12345").valid, false);
  assert.equal(validateIntakeInput("name", "x").valid, false);
});

await check("Valid patient names are accepted", () => {
  assert.equal(validateIntakeInput("name", "Ramesh Kumar").valid, true);
  assert.equal(validateIntakeInput("name", "Dr. Amit Roy").valid, true);
  assert.equal(validateIntakeInput("name", "Pooja Sharma").valid, true);
  assert.equal(validateIntakeInput("name", "सुनील कुमार").valid, true);
});

await check("Invalid age strings are rejected", () => {
  assert.equal(validateIntakeInput("age", "asdf").valid, false);
  assert.equal(validateIntakeInput("age", "-5").valid, false);
  assert.equal(validateIntakeInput("age", "200").valid, false);
});

await check("Valid age numbers are accepted", () => {
  assert.equal(validateIntakeInput("age", "34").valid, true);
  assert.equal(validateIntakeInput("age", "25 saal").valid, true);
  assert.equal(validateIntakeInput("age", "45 years").valid, true);
});

// ── 4. Legitimate clinical complaints in Hindi, Hinglish, English ──
await check("Valid Hinglish complaint 'pet me dard hai' is accepted", () => {
  const validation = validateIntakeInput("chiefComplaint", "pet me dard hai");
  assert.equal(validation.valid, true);
});

await check("Detailed screenshot complaint 'mere pet me right side me bahut dard hota hai' is accepted", () => {
  const validation = validateIntakeInput("chiefComplaint", "mere pet me right side me bahut dard hota hai");
  assert.equal(validation.valid, true);
});

await check("Valid English complaint 'severe headache and nausea' is accepted", () => {
  const validation = validateIntakeInput("chiefComplaint", "severe headache and nausea");
  assert.equal(validation.valid, true);
});

await check("Valid Devanagari complaint 'पेट में बहुत तेज दर्द है' is accepted", () => {
  const validation = validateIntakeInput("chiefComplaint", "पेट में बहुत तेज दर्द है");
  assert.equal(validation.valid, true);
});

await check("Valid short clinical terms 'fever', 'TB', 'BP' are accepted", () => {
  assert.equal(validateIntakeInput("chiefComplaint", "fever").valid, true);
  assert.equal(validateIntakeInput("chiefComplaint", "TB problem").valid, true);
  assert.equal(validateIntakeInput("chiefComplaint", "BP high").valid, true);
});

// ── 5. Durations, history denials, and severity ratings ──
await check("Valid durations are accepted", () => {
  assert.equal(validateIntakeInput("duration", "2 din se").valid, true);
  assert.equal(validateIntakeInput("duration", "kal subah se").valid, true);
  assert.equal(validateIntakeInput("duration", "1 week").valid, true);
  assert.equal(validateIntakeInput("duration", "दो दिन से").valid, true);
});

await check("Valid negations on reports and consultations are accepted", () => {
  assert.equal(validateIntakeInput("priorReports", "Nahi hai").valid, true);
  assert.equal(validateIntakeInput("priorReports", "no").valid, true);
  assert.equal(validateIntakeInput("priorConsultation", "kisi doctor ko nahi dikhaya").valid, true);
});

await check("Valid severity answers are accepted", () => {
  assert.equal(
    validateIntakeInput("adaptive-qa", "7", "Is takleef ki teevrata 1 se 10 mein kitni hai?").valid,
    true
  );
  assert.equal(
    validateIntakeInput("adaptive-qa", "8/10", "Is takleef ki teevrata 1 se 10 mein kitni hai?").valid,
    true
  );
  assert.equal(
    validateIntakeInput("adaptive-qa", "bahut tez dard", "Is takleef ki teevrata 1 se 10 mein kitni hai?").valid,
    true
  );
});

// ── 6. Cross-layer integration with context consistency ──
import { assessAppointmentContext } from "../lib/appointmentContextConsistency.ts";

await check("assessAppointmentContext returns NEEDS_CLARIFICATION for gibberish chief complaint 'nnlknkn'", () => {
  const result = assessAppointmentContext({ latestAnswer: "nnlknkn" });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.equal(result.needsClarification, true);
  assert.ok(result.reasonCodes.includes("UNINTELLIGIBLE_INPUT"));
  assert.match(result.question, /spasht shabdon/i);
});

await check("assessAppointmentContext returns NEEDS_CLARIFICATION for gibberish duration 'kjlnln'", () => {
  const result = assessAppointmentContext({ latestAnswer: "kjlnln" });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.equal(result.needsClarification, true);
  assert.ok(result.reasonCodes.includes("UNINTELLIGIBLE_INPUT"));
  assert.match(result.question, /spasht shabdon/i);
});

await check("assessAppointmentContext returns NEEDS_CLARIFICATION for gibberish severity 'nlknlnlkn'", () => {
  const result = assessAppointmentContext({ latestAnswer: "nlknlnlkn" });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.equal(result.needsClarification, true);
  assert.ok(result.reasonCodes.includes("UNINTELLIGIBLE_INPUT"));
  assert.match(result.question, /spasht shabdon/i);
});

await check("assessAppointmentContext accepts valid complaints and durations without false contradictions", () => {
  const complaintResult = assessAppointmentContext({ latestAnswer: "pet me dard hai" });
  assert.equal(complaintResult.status, "CONSISTENT");
  assert.equal(complaintResult.needsClarification, false);

  const durationResult = assessAppointmentContext({ latestAnswer: "2 din se" });
  assert.equal(durationResult.status, "CONSISTENT");
  assert.equal(durationResult.needsClarification, false);
});

console.log("==================================================================");
console.log(`TEST SUMMARY: ${results.length} PASSED, 0 FAILED`);
console.log("==================================================================");
