#!/usr/bin/env node
/**
 * Focused chest-safety routing/evidence regression harness.
 *
 * The eight literals below are the verbatim investigation corpus supplied by
 * the approved bugfix task. They intentionally remain test-only data.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * Run: node --experimental-strip-types scripts/chest-pain-pathway-matching-tests.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  allPathways,
  assessChestSafety,
  coverageFor,
  detectRedFlagsForContext,
  evaluateSafetyEvidence,
  matchPathway,
  pathwayForClinicalContext,
  questionForDimension,
  requiredDimensions,
  resolveClinicalContext,
} from "../lib/clinicalPathways.ts";

const root = path.resolve(import.meta.dirname, "..");
const page = fs.readFileSync(path.join(root, "app/patient/appointment/page.tsx"), "utf8");
const results = [];
const check = (name, fn) => { fn(); results.push({ name, status: "passed" }); };

const corpus = Object.freeze([
  "Mere seene mein pressure aur dard ho raha hai",
  "Seene mein dard hai",
  "Mere chest mein pain hai",
  "Chest mein pressure ho raha hai",
  "Seene par bojh sa lag raha hai",
  "Seene mein jalan aur dard hai",
  "Mere seene mein achanak dard shuru hua",
  "Baaye taraf seene mein dard ho raha hai",
]);

check("corpus integrity: exactly the eight approved verbatim investigation phrases", () => {
  assert.equal(corpus.length, 8);
  assert.ok(corpus.includes("Mere seene mein pressure aur dard ho raha hai"));
  assert.ok(corpus.includes("Seene mein dard hai"));
  assert.ok(corpus.includes("Baaye taraf seene mein dard ho raha hai"));
  assert.ok(corpus.every((phrase) => phrase.trim().length > 0));
});

check("unfixed matcher baseline records the concrete corpus misses", () => {
  const legacyMisses = corpus.filter((phrase) => !matchPathway(phrase));
  assert.deepEqual(legacyMisses, [
    "Mere seene mein pressure aur dard ho raha hai",
    "Mere chest mein pain hai",
    "Chest mein pressure ho raha hai",
    "Seene par bojh sa lag raha hai",
    "Seene mein jalan aur dard hai",
    "Mere seene mein achanak dard shuru hua",
  ]);
  assert.equal(matchPathway("Seene mein dard hai")?.id, "chest_pain");
  assert.equal(matchPathway("Baaye taraf seene mein dard ho raha hai")?.id, "chest_pain");
});

check("Property 1: every exact corpus phrase reaches chest safety coverage", () => {
  for (const phrase of corpus) {
    const context = resolveClinicalContext(phrase);
    assert.ok(["curated_pathway", "chest_safety_fallback"].includes(context.route), `${phrase} route=${context.route}`);
    assert.equal(context.chestSafety.relevant, true, `${phrase} must be chest relevant`);
    assert.equal(pathwayForClinicalContext(context)?.id, "chest_pain", `${phrase} must use chest profile`);
    const required = requiredDimensions(context);
    for (const dimension of ["onset_duration", "severity_character", "associated_symptoms", "relevant_history", "red_flag_screen"]) {
      assert.ok(required.includes(dimension), `${phrase} missing required ${dimension}`);
    }
    const complaintOnly = coverageFor(context, [phrase]);
    assert.equal(complaintOnly.safetyState, "unanswered", `${phrase} complaint-only safety state`);
    assert.ok(complaintOnly.missing.includes("red_flag_screen"), `${phrase} complaint-only screen must remain missing`);
  }
});

check("Property 1: reviewed natural variants with inserted words and quality/onset forms route safely", () => {
  const variants = [
    "Mere seene mein pressure aur dard ho raha hai",
    "Mere chest mein sudden pressure aur heaviness ho rahi hai",
    "Seene mein bhaaripan aur tightness mehsoos ho rahi hai",
    "Chest mein burning discomfort ho raha hai",
    "Seene mein jalan ho rahi hai",
    "Mere seene mein achanak dard shuru hua",
    "Left side chest discomfort since yesterday",
    "Baaye taraf seene mein jalan aur pressure hai",
    "सीने में दबाव और दर्द हो रहा है",
    "छाती में जलन और भारीपन है",
  ];
  for (const phrase of variants) {
    const assessment = assessChestSafety(phrase);
    assert.equal(assessment.relevant, true, `variant not recognized: ${phrase}`);
    const context = resolveClinicalContext(phrase);
    assert.equal(pathwayForClinicalContext(context)?.id, "chest_pain", `variant route: ${phrase}`);
    const coverage = coverageFor(context, [phrase]);
    assert.ok(coverage.missing.includes("red_flag_screen"), `variant screen completed from complaint: ${phrase}`);
  }
});

check("standalone and non-chest controls do not create a chest safety route", () => {
  for (const phrase of ["dard", "pressure", "chest", "seene", "left", "baaye"]) {
    assert.equal(assessChestSafety(phrase).relevant, false, `standalone keyword matched: ${phrase}`);
    assert.notEqual(resolveClinicalContext(phrase).route, "chest_safety_fallback");
  }
  for (const phrase of ["seene mein khujli", "chest rash", "persistent cough", "pet mein dard", "bukhar"]) {
    const context = resolveClinicalContext(phrase);
    assert.equal(context.chestSafety.relevant, false, `non-chest control matched: ${phrase}`);
    assert.notEqual(context.pathway?.id, "chest_pain", `non-chest pathway reclassified: ${phrase}`);
  }
  assert.equal(resolveClinicalContext("pet mein dard").pathway?.id, "abdominal_pain");
  assert.notEqual(resolveClinicalContext("persistent cough").pathway?.id, "chest_pain");
});

check("complaint words remain context: complaint-only chest screen is unanswered", () => {
  const context = resolveClinicalContext("Seene mein dard hai");
  const evaluation = evaluateSafetyEvidence(context, [
    { source: "complaint", text: "Seene mein dard hai" },
    { source: "complaint", text: "chest pain with radiation, sweating and breathlessness" },
  ]);
  assert.equal(evaluation.state, "unanswered");
  assert.equal(evaluation.complete, false);
  assert.equal(evaluation.unresolved, true);
  const coverage = coverageFor(context, ["Seene mein dard hai", "chest pain with radiation, sweating and breathlessness"]);
  assert.equal(coverage.safetyState, "unanswered");
  assert.ok(coverage.missing.includes("red_flag_screen"));
  assert.ok(detectRedFlagsForContext(context, "chest pain with sweating").some((flag) => flag.urgency === "emergency"));
});

check("explicit targeted negative safety answer completes only the screen", () => {
  const context = resolveClinicalContext("Seene mein dard hai");
  const evidence = [{ source: "patient_answer", questionDimension: "red_flag_screen", text: "No" }];
  const evaluation = evaluateSafetyEvidence(context, evidence);
  assert.equal(evaluation.state, "negative");
  assert.equal(evaluation.complete, true);
  assert.equal(evaluation.signals.length, 0);
  const coverage = coverageFor(context, { patientTexts: ["Seene mein dard hai"], safetyEvidence: evidence });
  assert.ok(coverage.satisfied.includes("red_flag_screen"));
  assert.ok(!coverage.missing.includes("red_flag_screen"));
  const directArray = coverageFor(context, evidence);
  assert.ok(directArray.satisfied.includes("red_flag_screen"));
});

check("explicit targeted positive safety answer retains emergency signal and urgency", () => {
  const context = resolveClinicalContext("Seene mein dard hai");
  const evidence = [{
    source: "patient_answer",
    questionDimension: "red_flag_screen",
    text: "Haan, dard baaye haath tak ja raha hai aur paseena aa raha hai",
  }];
  const evaluation = evaluateSafetyEvidence(context, evidence);
  assert.equal(evaluation.state, "positive");
  assert.equal(evaluation.complete, true);
  assert.ok(evaluation.signals.some((flag) => flag.urgency === "emergency"));
  const coverage = coverageFor(context, { patientTexts: ["Seene mein dard hai"], safetyEvidence: evidence });
  assert.ok(coverage.satisfied.includes("red_flag_screen"));
});

check("ambiguous, off-topic, and contradictory answers never become a safe negative", () => {
  const context = resolveClinicalContext("Seene mein dard hai");
  const ambiguous = evaluateSafetyEvidence(context, [{ source: "patient_answer", questionDimension: "red_flag_screen", text: "Pata nahi, shayad" }]);
  assert.equal(ambiguous.state, "uncertain");
  assert.equal(ambiguous.complete, false);
  const offTopic = evaluateSafetyEvidence(context, [{ source: "patient_answer", questionDimension: "red_flag_screen", text: "No reports" }]);
  assert.notEqual(offTopic.state, "negative");
  assert.equal(offTopic.complete, false);
  const contradictory = evaluateSafetyEvidence(context, [{ source: "patient_answer", questionDimension: "red_flag_screen", text: "Pehle nahi, ab saans phool rahi hai" }]);
  assert.ok(["positive", "uncertain"].includes(contradictory.state));
  assert.notEqual(contradictory.state, "negative");
  const noScope = evaluateSafetyEvidence(context, [{ source: "patient_answer", text: "No" }]);
  assert.equal(noScope.complete, false, "untargeted answer must not complete the screen");
});

check("generic fallback and curated non-chest preservation remain adaptive", () => {
  const generic = resolveClinicalContext("something feels bad");
  assert.equal(generic.route, "generic_fallback");
  assert.deepEqual(requiredDimensions(generic), ["onset_duration", "severity_character", "associated_symptoms", "prior_care"]);
  const cough = resolveClinicalContext("cough and breathing problem");
  assert.equal(cough.pathway?.id, "cough_breathing");
  assert.deepEqual(requiredDimensions(cough), requiredDimensions(matchPathway("cough and breathing problem")));
  assert.equal(matchPathway("cough and breathing problem")?.id, "cough_breathing");
  assert.equal(matchPathway("Seene mein dard hai")?.id, "chest_pain");
  assert.equal(allPathways().length > 1, true);
  for (const pathway of ["cough_breathing", "abdominal_pain", "fever", "headache", "urinary", "back_pain", "skin_rash", "mental_health", "vomiting"]) {
    const found = allPathways().find((item) => item.id === pathway);
    assert.ok(found, `curated pathway missing: ${pathway}`);
    assert.ok(questionForDimension(found, "onset_duration"));
  }
});

check("adaptive coverage reuses known dimensions and requires attributable safety evidence", () => {
  const context = resolveClinicalContext("Mere seene mein pressure aur dard ho raha hai");
  const before = coverageFor(context, ["Mere seene mein pressure aur dard ho raha hai", "2 ghante se", "pressure jaisa 7/10", "saath me paseena aur saans phoolti hai", "pehle se BP hai, dawa leta hoon"]);
  assert.ok(before.satisfied.includes("onset_duration"));
  assert.ok(before.satisfied.includes("severity_character"));
  assert.ok(before.satisfied.includes("associated_symptoms"));
  assert.ok(before.satisfied.includes("relevant_history"));
  assert.ok(before.missing.includes("red_flag_screen"));
  const after = coverageFor(context, {
    patientTexts: ["Mere seene mein pressure aur dard ho raha hai", "2 ghante se", "pressure jaisa 7/10", "saath me paseena aur saans phoolti hai", "pehle se BP hai, dawa leta hoon"],
    safetyEvidence: [{ source: "structured_safety_answer", questionDimension: "red_flag_screen", text: "No, none of the danger signs" }],
  });
  assert.equal(after.complete, true);
  assert.equal(after.missing.length, 0);
});

check("appointment flow uses context, target metadata, adaptive STOP fallback, and MAX_DEEP incomplete state", () => {
  assert.match(page, /resolveClinicalContext\(/);
  assert.match(page, /const clinicalContextRef = useRef<ClinicalContext>/);
  assert.match(page, /questionDimension: "red_flag_screen"/);
  assert.match(page, /source: "patient_answer"/);
  assert.match(page, /const finalCoverage = coverageNow\(a\)/);
  assert.match(page, /finalSafety\.unresolved/);
  assert.match(page, /Safety screen unresolved\/incomplete/);
  assert.match(page, /if \(wantsStop \|\| isDuplicateQuestion\(clean\)\)/);
  assert.match(page, /return dimensionQuestion\(coverage\.missing\)/);
  assert.match(page, /const MAX_DEEP = \d+/);
  assert.match(page, /deepCountRef\.current >= MAX_DEEP/);
  assert.match(page, /finalCoverage\.required\.includes\("red_flag_screen"\)/);
});

console.log(JSON.stringify({
  suite: "Chest-pain pathway matching and source-aware safety evidence",
  status: "passed",
  total: results.length,
  results,
  corpus: [...corpus],
  unfixedCounterexamples: {
    matcherMisses: corpus.filter((phrase) => !matchPathway(phrase)),
    complaintOnlyScreenExamples: ["Seene mein dard hai", "Baaye taraf seene mein dard ho raha hai"],
  },
  notes: [
    "The unfixed contiguous matcher misses inserted-word/quality variants; the fixed resolver preserves matchPathway and adds a chest safety fallback.",
    "Complaint context can raise explainable red flags but cannot satisfy red_flag_screen.",
    "Only targeted patient/structured safety evidence can complete the safety dimension.",
    "MAX_DEEP remains a ceiling; unresolved safety is persisted as clinician-review-needed.",
  ],
}, null, 2));
