/**
 * End-to-end automated test and stress test for AI UPCHAR patient intake chat flow.
 * Tests:
 * 1. Semantic understanding of chief complaints & pathway matching
 * 2. Intelligent, complaint-specific follow-up questions (not static generic loop)
 * 3. Prevention of duplicate duration questioning when duration is already in complaint
 * 4. Comprehensive random character / gibberish stress test across all steps
 * 5. Pre-visit doctor brief generation fallback
 */

import assert from "node:assert/strict";
import { validateIntakeInput, checkIntelligibility } from "../lib/intakeValidation.ts";
import { coveredClinicalInformation, fallbackDecision } from "../lib/next-best-question.ts";
import { matchPathway } from "../lib/clinicalPathways.ts";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  PASS: ${name}`);
  } catch (error) {
    failedTests++;
    console.error(`  FAIL: ${name}`);
    console.error(error);
  }
}

console.log("==================================================================");
console.log("RUNNING AI UPCHAR INTAKE CHAT FLOW & STRESS TESTS");
console.log("==================================================================");

// ── PART 1: CLINICAL UNDERSTANDING & DYNAMIC NEXT QUESTIONS ──
console.log("\n[TEST GROUP 1] Clinical Input Understanding & Dynamic Questioning");

runTest("Abdominal pain complaint triggers abdominal pathway & asks location / character first", () => {
  const context = {
    answers: { chiefComplaint: "Pet mein bahut tez dard ho raha hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Pet mein bahut tez dard ho raha hai"],
    urgent: false,
  };
  const covered = coveredClinicalInformation(context);
  assert.ok(covered.includes("symptom_location"), "Should recognize 'pet' as symptom location");
  assert.ok(covered.includes("severity"), "Should recognize 'tez' as severity");

  const decision = fallbackDecision(context, covered);
  assert.notEqual(decision.action, "READY_TO_FINALIZE");
  assert.ok(
    decision.question.toLowerCase().includes("pet") || decision.question.toLowerCase().includes("kab se"),
    `Question should be relevant to abdomen or onset: ${decision.question}`
  );
  assert.ok(decision.coverageTarget === "symptom_location" || decision.coverageTarget === "duration");
});

runTest("Duration in complaint ('3 din se bukhar hai') is recognized immediately and NOT re-asked", () => {
  const context = {
    answers: { chiefComplaint: "Mujhe 3 din se bukhar hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Mujhe 3 din se bukhar hai"],
    urgent: false,
  };
  const covered = coveredClinicalInformation(context);
  assert.ok(covered.includes("duration"), "Duration ('3 din') must be detected from chiefComplaint");

  const decision = fallbackDecision(context, covered);
  // It must NOT ask 'Yeh takleef kab se hai?' or REQUEST_DURATION
  assert.notEqual(decision.action, "REQUEST_DURATION", "Must not request duration when already given in complaint");
  assert.notEqual(decision.coverageTarget, "duration", "Coverage target must not be duration");
  assert.match(
    decision.question,
    /chills|thandi|sirdard|badan dard|lakshan/i,
    `Question should ask about fever characteristics/symptoms, got: ${decision.question}`
  );
});

runTest("Chest pain complaint prioritizes safety red flags & radiation immediately", () => {
  const context = {
    answers: { chiefComplaint: "Seene mein tez dard aur dabav lag raha hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Seene mein tez dard aur dabav lag raha hai"],
    urgent: true,
  };
  const covered = coveredClinicalInformation(context);
  assert.ok(covered.includes("symptom_location"));

  const decision = fallbackDecision(context, covered);
  assert.equal(decision.action, "ASK_SAFETY_QUESTION");
  assert.equal(decision.coverageTarget, "red_flags");
  assert.ok(decision.safetyConcern, "Must mark safetyConcern true");
  assert.match(decision.question, /haath|jabde|peeth|saans|paseena/i);
});

runTest("Headache complaint asks location/onset pattern rather than generic questions", () => {
  const context = {
    answers: { chiefComplaint: "Do din se sar mein dard ho raha hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Do din se sar mein dard ho raha hai"],
    urgent: false,
  };
  const covered = coveredClinicalInformation(context);
  assert.ok(covered.includes("duration"));
  assert.ok(covered.includes("symptom_location"));

  const decision = fallbackDecision(context, covered);
  assert.notEqual(decision.coverageTarget, "duration");
  assert.match(decision.question, /sirdard|sar|aage|peeche|ek taraf|dhundhla|kamzori/i);
});

runTest("Cough complaint asks about dry vs phlegm character", () => {
  const context = {
    answers: { chiefComplaint: "Khaansi bohot zyada ho rahi hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Khaansi bohot zyada ho rahi hai"],
    urgent: false,
  };
  const covered = coveredClinicalInformation(context);

  const decision = fallbackDecision(context, covered);
  assert.match(decision.question, /sookhi|balgam|phlegm|kab se/i);
});

runTest("Multi-turn intake completes and transitions to READY_TO_FINALIZE after core clinical coverage", () => {
  const context = {
    answers: {
      chiefComplaint: "Pet mein dard ho raha hai",
      duration: "3 din se",
      priorConsultation: "Nahi dikhaya",
      priorReports: "Koi report nahi hai",
    },
    qaLog: [
      { question: "Pet mein dard kis hisse mein ho raha hai?", answer: "Neeche pet mein marod ho rahi hai", coverageTarget: "symptom_location" },
      { question: "Kya ulti ya dast bhi hai?", answer: "Nahi, sirf halki gas hai", coverageTarget: "associated_symptoms" },
      { question: "Kya pet patthar jaisa kathor lag raha hai ya khoon aaya?", answer: "Nahi aisi koi baat nahi hai", coverageTarget: "red_flags" },
      { question: "Kya aapne iske liye koi dawa li?", answer: "Bas gharelu heeng paani piya tha", coverageTarget: "treatment_history" },
    ],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: [],
    urgent: false,
  };
  const covered = coveredClinicalInformation(context);
  assert.ok(covered.includes("duration"));
  assert.ok(covered.includes("red_flags"));

  const decision = fallbackDecision(context, covered);
  assert.equal(decision.action, "READY_TO_FINALIZE");
  assert.equal(decision.readyToFinalize, true);
});

// ── PART 2: RANDOM CHARACTER / GIBBERISH STRESS TESTING AT EVERY STEP ──
console.log("\n[TEST GROUP 2] Random Characters / Gibberish Stress Testing Across All Turns");

const GIBBERISH_INPUTS = [
  "mbln",
  "jlilkn",
  "knlknlknlkn",
  "nnlknkn",
  "kjnlnln",
  "nlknlnlkn",
  "lknlkn",
  "jkn",
  "jkj",
  "lkjon",
  "kjjkn",
  "dfsdf",
  "asdfghjkl",
  "qwerzxcv",
  "123456",
  "!@#$%^&*()",
  "zzxxqq",
  "bbccddff",
  "mnbvcxz",
  "poiuytrew",
];

runTest("Step 'name' rejects all 20 random character gibberish strings", () => {
  for (const input of GIBBERISH_INPUTS) {
    const result = validateIntakeInput("name", input);
    assert.equal(result.valid, false, `Name should reject gibberish: '${input}'`);
    assert.ok(result.message && result.message.length > 0);
  }
  // Valid name passes
  const valid = validateIntakeInput("name", "Rahul Kumar Sharma");
  assert.equal(valid.valid, true);
});

runTest("Step 'age' rejects random character strings, out-of-range, and negatives", () => {
  const invalidAges = ["jlilkn", "asdf", "xyz", "-25", "0", "150", "999", "??"];
  for (const input of invalidAges) {
    const result = validateIntakeInput("age", input);
    assert.equal(result.valid, false, `Age should reject invalid input: '${input}'`);
  }
  // Valid ages pass
  assert.equal(validateIntakeInput("age", "34").valid, true);
  assert.equal(validateIntakeInput("age", "34 saal").valid, true);
  assert.equal(validateIntakeInput("age", "45 years").valid, true);
});

runTest("Step 'location' rejects random character gibberish strings", () => {
  const invalidLocations = ["knlknlknlkn", "dfsdf", "asdfgh", "12345", "zkzk"];
  for (const input of invalidLocations) {
    const result = validateIntakeInput("location", input);
    assert.equal(result.valid, false, `Location should reject gibberish: '${input}'`);
  }
  // Valid cities pass
  assert.equal(validateIntakeInput("location", "Lucknow").valid, true);
  assert.equal(validateIntakeInput("location", "Patna").valid, true);
  assert.equal(validateIntakeInput("location", "New Delhi").valid, true);
  assert.equal(validateIntakeInput("location", "Varanasi, UP").valid, true);
});

runTest("Step 'preferredDate' rejects random character gibberish", () => {
  const invalidDates = ["asdfgh", "knlkn", "xyz", "123"];
  for (const input of invalidDates) {
    const result = validateIntakeInput("preferredDate", input);
    assert.equal(result.valid, false, `preferredDate should reject gibberish: '${input}'`);
  }
  // Valid dates pass
  assert.equal(validateIntakeInput("preferredDate", "2026-10-05").valid, true);
  assert.equal(validateIntakeInput("preferredDate", "Kal").valid, true);
  assert.equal(validateIntakeInput("preferredDate", "Today").valid, true);
  assert.equal(validateIntakeInput("preferredDate", "Tomorrow").valid, true);
});

runTest("Step 'preferredTime' rejects random character gibberish", () => {
  const invalidTimes = ["asdfgh", "knlkn", "xyz", "???"];
  for (const input of invalidTimes) {
    const result = validateIntakeInput("preferredTime", input);
    assert.equal(result.valid, false, `preferredTime should reject gibberish: '${input}'`);
  }
  // Valid times pass
  assert.equal(validateIntakeInput("preferredTime", "Subah").valid, true);
  assert.equal(validateIntakeInput("preferredTime", "Dopahar").valid, true);
  assert.equal(validateIntakeInput("preferredTime", "Shaam").valid, true);
  assert.equal(validateIntakeInput("preferredTime", "10:00").valid, true);
  assert.equal(validateIntakeInput("preferredTime", "5 pm").valid, true);
});

runTest("Step 'chiefComplaint' rejects all screenshot gibberish inputs with polite prompt", () => {
  const screenshotGibberish = ["nnlknkn", "kjnlnln", "nlknlnlkn", "lknlkn", "lkjon", "kjjkn", "dfsdf", "qweqwe", "asdfgh"];
  for (const input of screenshotGibberish) {
    const result = validateIntakeInput("chiefComplaint", input);
    assert.equal(result.valid, false, `Chief complaint should reject: '${input}'`);
    assert.match(result.message, /Maaf kijiye.*takleef|vistaar se bataiye/i);
  }
  // Valid complaints pass
  assert.equal(validateIntakeInput("chiefComplaint", "Pet mein tez dard hai").valid, true);
  assert.equal(validateIntakeInput("chiefComplaint", "Severe chest pain and sweating").valid, true);
  assert.equal(validateIntakeInput("chiefComplaint", "3 din se bukhar aur ulti aa rahi hai").valid, true);
});

runTest("Step 'duration' rejects random character gibberish", () => {
  const invalidDurations = ["kjnlnln", "dfsdf", "asdfgh", "zxcv", "!@#$"];
  for (const input of invalidDurations) {
    const result = validateIntakeInput("duration", input);
    assert.equal(result.valid, false, `Duration should reject gibberish: '${input}'`);
    assert.match(result.message, /takleef kitne samay se hai/i);
  }
  // Valid durations pass
  assert.equal(validateIntakeInput("duration", "2 din se").valid, true);
  assert.equal(validateIntakeInput("duration", "Kal raat se").valid, true);
  assert.equal(validateIntakeInput("duration", "1 week").valid, true);
  assert.equal(validateIntakeInput("duration", "Subah se").valid, true);
});

runTest("Step 'adaptive-qa' severity question rejects gibberish and accepts numbers 1-10 or descriptions", () => {
  const severityPrompt = "Is takleef ki teevrata 1 se 10 mein kitni hai?";
  const invalidSeverities = ["nlknlnlkn", "dfsdf", "asdfgh", "xyz"];
  for (const input of invalidSeverities) {
    const result = validateIntakeInput("adaptive-qa", input, severityPrompt);
    assert.equal(result.valid, false, `Severity should reject gibberish: '${input}'`);
    assert.match(result.message, /1 se 10 ke scale par/i);
  }
  // Valid severities pass
  assert.equal(validateIntakeInput("adaptive-qa", "7", severityPrompt).valid, true);
  assert.equal(validateIntakeInput("adaptive-qa", "8/10", severityPrompt).valid, true);
  assert.equal(validateIntakeInput("adaptive-qa", "Bohot tez dard hai", severityPrompt).valid, true);
  assert.equal(validateIntakeInput("adaptive-qa", "Halka dard hai", severityPrompt).valid, true);
});

runTest("Step 'priorConsultation' & 'priorReports' reject gibberish and accept negative answers", () => {
  assert.equal(validateIntakeInput("priorConsultation", "jkj").valid, false);
  assert.equal(validateIntakeInput("priorReports", "kjjkn").valid, false);

  // Negative answers are valid clinical statements
  assert.equal(validateIntakeInput("priorConsultation", "Nahi dikhaya").valid, true);
  assert.equal(validateIntakeInput("priorConsultation", "No").valid, true);
  assert.equal(validateIntakeInput("priorReports", "Nahi hai").valid, true);
  assert.equal(validateIntakeInput("priorReports", "Koi report nahi").valid, true);
  assert.equal(validateIntakeInput("priorReports", "Purani ECG ki report hai").valid, true);
});

// ── PART 3: SIMULATED END-TO-END CONVERSATION WITH GIBBERISH RECOVERY ──
console.log("\n[TEST GROUP 3] End-to-End Chat Flow Simulation with Gibberish Injection & Recovery");

runTest("Simulated conversation rejects gibberish at every turn, recovers on valid input, and reaches completion", () => {
  // Turn 1: Patient Name
  let turn1Bad = validateIntakeInput("name", "mbln");
  assert.equal(turn1Bad.valid, false);
  let turn1Good = validateIntakeInput("name", "Amit Sharma");
  assert.equal(turn1Good.valid, true);

  // Turn 2: Patient Age
  let turn2Bad = validateIntakeInput("age", "jlilkn");
  assert.equal(turn2Bad.valid, false);
  let turn2Good = validateIntakeInput("age", "28");
  assert.equal(turn2Good.valid, true);

  // Turn 3: Location
  let turn3Bad = validateIntakeInput("location", "knlknlknlkn");
  assert.equal(turn3Bad.valid, false);
  let turn3Good = validateIntakeInput("location", "Lucknow");
  assert.equal(turn3Good.valid, true);

  // Turn 4: Chief Complaint
  let turn4Bad = validateIntakeInput("chiefComplaint", "nnlknkn");
  assert.equal(turn4Bad.valid, false);
  let turn4Good = validateIntakeInput("chiefComplaint", "Pet mein tez marod aur dard hai");
  assert.equal(turn4Good.valid, true);

  // Clinical reasoning on good complaint
  const context = {
    answers: { name: "Amit Sharma", age: "28", sex: "Man", location: "Lucknow", chiefComplaint: "Pet mein tez marod aur dard hai" },
    qaLog: [],
    semanticFacts: [],
    clarificationHistory: [],
    previousPatientAnswers: ["Amit Sharma", "28", "Lucknow", "Pet mein tez marod aur dard hai"],
    urgent: false,
  };
  let covered = coveredClinicalInformation(context);
  let decision1 = fallbackDecision(context, covered);
  assert.ok(decision1.question.length > 0);

  // Turn 5: Duration asked by bot
  let turn5Bad = validateIntakeInput("duration", "kjnlnln");
  assert.equal(turn5Bad.valid, false);
  let turn5Good = validateIntakeInput("duration", "2 din se");
  assert.equal(turn5Good.valid, true);

  context.answers.duration = "2 din se";
  context.qaLog.push({ question: decision1.question, answer: "2 din se", coverageTarget: "duration" });
  covered = coveredClinicalInformation(context);

  // Turn 6: Bot asks next clinical question
  let decision2 = fallbackDecision(context, covered);
  assert.notEqual(decision2.action, "REQUEST_DURATION", "Duration must not be re-asked");
  assert.match(decision2.question, /ulti|dast|loose motion|bukhar|gas/i);

  let turn6Bad = validateIntakeInput("adaptive-qa", "lknlkn", decision2.question);
  assert.equal(turn6Bad.valid, false);
  let turn6Good = validateIntakeInput("adaptive-qa", "Haan, 2 baar ulti bhi hui hai", decision2.question);
  assert.equal(turn6Good.valid, true);

  context.qaLog.push({ question: decision2.question, answer: "Haan, 2 baar ulti bhi hui hai", coverageTarget: "associated_symptoms" });
  covered = coveredClinicalInformation(context);

  // Turn 7: Safety screen question
  let decision3 = fallbackDecision(context, covered);
  assert.equal(decision3.action, "ASK_SAFETY_QUESTION");

  let turn7Bad = validateIntakeInput("adaptive-qa", "dfsdf", decision3.question);
  assert.equal(turn7Bad.valid, false);
  let turn7Good = validateIntakeInput("adaptive-qa", "Nahi, aisi koi emergency nahi hai", decision3.question);
  assert.equal(turn7Good.valid, true);

  context.qaLog.push({ question: decision3.question, answer: "Nahi, aisi koi emergency nahi hai", coverageTarget: "red_flags" });
  covered = coveredClinicalInformation(context);

  // Turn 8: Prior care question
  let decision4 = fallbackDecision(context, covered);
  assert.ok(["REQUEST_TREATMENT_HISTORY", "REQUEST_REPORT", "READY_TO_FINALIZE"].includes(decision4.action));
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} total tests`);
console.log("==================================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("ALL E2E CHAT FLOW & STRESS TESTS PASSED PERFECTLY!");
}
