// Adaptive interview COVERAGE-MODEL tests (New Appointment deep-questioning).
//
// These prove the clinical-flow regression fix: the New Appointment adaptive AI
// interview now decides completion with a COMPLETENESS/COVERAGE model (pathway
// or generic-floor required dimensions), NOT a single AI turn and NOT a fixed
// question count/sequence. In particular the screenshot scenario
//   complaint "mere pet me right side me bahut dard hota hai" -> "No" -> "No reports"
// can no longer jump straight to the success screen.
//
// Run: node --experimental-strip-types scripts/appointment-adaptive-interview-tests.mjs
//
// The coverage functions are pure and imported straight from the TS source
// (same approach as the other lib/clinicalPathways tests). The page.tsx wiring
// is verified with source-text contracts (same approach as appointment-*.mjs).

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  matchPathway,
  resolveClinicalContext,
  coverageFor,
  requiredDimensions,
  questionForDimension,
} from "../lib/clinicalPathways.ts";

const root = path.resolve(import.meta.dirname, "..");
const page = fs.readFileSync(path.join(root, "app/patient/appointment/page.tsx"), "utf8");

const results = [];
const check = (name, fn) => { fn(); results.push({ name, status: "passed" }); };

// A patient's INITIAL generic answers (the fixed script) for a complaint. This
// mirrors exactly what the flow has collected right before the deep phase.
function initialTexts({ complaint, duration, seen_doctor }) {
  return [complaint, duration, seen_doctor].filter(Boolean);
}

// The screenshot complaint. NOTE: the current pathway matcher requires an
// adjacent synonym phrase, so this free-text complaint does NOT match a curated
// pathway — the GENERIC FLOOR is therefore what must gate it. This is exactly
// the case the fix targets: even with no pathway, the flow cannot finalize
// after only the generic answers.
const SCREENSHOT = {
  complaint: "mere pet me right side me bahut dard hota hai",
  duration: "",           // patient never gave a duration in the screenshot
  seen_doctor: "No",      // "No" then "No reports"
};

// ── 1. The exact screenshot scenario cannot finalize after only generic answers.
check("screenshot scenario: required dimensions STILL MISSING after generic answers (cannot finalize)", () => {
  const pathway = matchPathway(SCREENSHOT.complaint, SCREENSHOT.duration); // null → generic floor
  const cov = coverageFor(pathway, initialTexts(SCREENSHOT));
  assert.equal(cov.complete, false, "coverage must NOT be complete after only the generic answers");
  assert.ok(cov.missing.length > 0, "at least one required dimension must still be missing");
  // No duration given, severity/character not described, associated symptoms
  // and prior-care not established → these must be reported missing.
  assert.ok(cov.missing.includes("onset_duration"), "onset/duration must be missing (no duration given)");
  assert.ok(cov.missing.includes("associated_symptoms"), "associated symptoms must be missing");
  assert.ok(cov.missing.includes("prior_care"), "prior care/treatment must be missing (a bare 'No' does not establish it)");
});

// ── 2. Missing/required dimensions DIFFER by complaint (adaptive, not one form).
check("required dimensions differ by complaint (adaptive, not one fixed questionnaire)", () => {
  const abdo = requiredDimensions(matchPathway("pet me dard"));       // abdominal_pain pathway
  const fever = requiredDimensions(matchPathway("bukhar"));            // fever pathway
  const chest = requiredDimensions(matchPathway("chest pain"));        // chest_pain pathway
  const generic = requiredDimensions(matchPathway("mujhe ajeeb sa mehsoos ho raha hai")); // null → floor
  const sets = { abdo, fever, chest, generic };
  const joined = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...v].sort().join(",")]));
  const uniqueSets = new Set(Object.values(joined));
  assert.ok(uniqueSets.size >= 2, `dimension sets should differ across complaints, got: ${JSON.stringify(joined)}`);
  // Generic floor is the minimal 4; a red-flag-carrying pathway adds the screen.
  assert.equal(generic.length, 4, "generic floor should be the minimal 4 dimensions");
  assert.ok(chest.includes("red_flag_screen"), "chest-pain pathway must require a red-flag screen");
  assert.ok(chest.length > generic.length, "a pathway should require more than the bare generic floor");
  // abdominal_pain vs chest_pain differ (chest probes relevant history, abdo does not) → adaptive.
  assert.notEqual(joined.abdo, joined.chest, "abdominal-pain and chest-pain dimension sets should differ");
});

// ── 3. A dimension satisfied by the INITIAL complaint/duration is NOT missing.
check("initial complaint/duration satisfies onset_duration (generic floor not blindly applied)", () => {
  const feverPathway = matchPathway("bukhar");
  const cov = coverageFor(feverPathway, initialTexts({ complaint: "bukhar hai", duration: "5 din se", seen_doctor: "No" }));
  assert.ok(cov.satisfied.includes("onset_duration"), '"5 din se" must satisfy onset/duration');
  assert.ok(!cov.missing.includes("onset_duration"), "onset/duration must NOT be re-asked once satisfied");
  // Same for the generic floor: "5 din se fever" satisfies onset/duration even
  // when no pathway matched.
  const genericCov = coverageFor(null, ["mujhe 5 din se fever hai"]);
  assert.ok(genericCov.satisfied.includes("onset_duration"), '"5 din se" satisfies onset/duration under the generic floor too');
});

// ── 4. Once all required dimensions are covered, completion is ALLOWED.
check("fully-covered accumulated answers → completion allowed (legit interview can finalize)", () => {
  const context = resolveClinicalContext("pet me dard");
  const pathway = context.pathway; // abdominal_pain
  // Accumulate answers that touch every required dimension for abdominal pain.
  const texts = [
    "pet me dard",
    "2 din se ho raha hai",                                   // onset_duration
    "bahut tez dard hai, jalan jaisa, 8/10",                  // severity_character
    "saath me ulti aur bukhar bhi hai",                        // associated_symptoms
    "pehle doctor ko dikhaya tha aur dawa li thi",             // prior_care
    "koi behoshi ya khoon nahi aaya, saans theek hai",         // red_flag_screen
  ];
  const cov = coverageFor(context, {
    patientTexts: texts,
    safetyEvidence: [{ source: "patient_answer", questionDimension: "red_flag_screen", text: texts[5] }],
  });
  assert.equal(cov.missing.length, 0, `expected no missing dimensions, got: ${JSON.stringify(cov.missing)}`);
  assert.equal(cov.complete, true, "coverage must be complete once every required dimension is addressed");
});

// ── 5. Already-provided info is not re-reported as missing after it is provided.
check("already-provided info is not represented as missing once provided", () => {
  const pathway = matchPathway("pet me dard");
  const before = coverageFor(pathway, ["pet me dard", "No"]);
  assert.ok(before.missing.includes("associated_symptoms"), "associated symptoms missing before it is provided");
  const after = coverageFor(pathway, ["pet me dard", "No", "saath me bukhar aur ulti bhi hai"]);
  assert.ok(after.satisfied.includes("associated_symptoms"), "associated symptoms satisfied after provided");
  assert.ok(!after.missing.includes("associated_symptoms"), "must not still be missing after provided");
  assert.ok(after.missing.length < before.missing.length, "providing info must reduce the missing set");
});

// ── 6. Completion gate does NOT depend on a fixed count; MAX_DEEP is a ceiling.
check("completion is coverage-driven, not count-driven; MAX_DEEP is a hard safety ceiling", () => {
  const pathway = matchPathway("chest pain");
  // Simulate MANY answered questions that DON'T actually cover the dimensions
  // (evasive/irrelevant replies). Count is high but coverage still incomplete →
  // model must NOT signal completion based on count alone.
  const evasiveTexts = ["chest pain", "pata nahi", "haan", "theek hai", "shayad", "hmm"];
  const cov = coverageFor(pathway, evasiveTexts);
  assert.equal(cov.complete, false, "many low-content answers must NOT satisfy coverage (no count shortcut)");
  assert.ok(cov.missing.length > 0, "dimensions still missing despite several turns");

  // Conversely, a small number of information-rich answers CAN complete coverage
  // (so completion is decided by information, not by reaching a fixed count).
  const richTexts = [
    "chest pain",
    "2 ghante se, dabav jaisa 7/10",                       // onset + severity/character
    "saath me paseena aur saans phoolti hai",              // associated + (also a red flag)
    "pehle se BP hai, dawa leta hoon",                     // relevant_history + prior_care
  ];
  const chestContext = resolveClinicalContext("chest pain");
  const richCov = coverageFor(chestContext, {
    patientTexts: richTexts,
    safetyEvidence: [{ source: "patient_answer", questionDimension: "red_flag_screen", text: richTexts[2] }],
  });
  assert.equal(richCov.complete, true, `few rich answers should complete coverage, missing: ${JSON.stringify(richCov.missing)}`);

  // MAX_DEEP exists in the page as a hard ceiling and is NOT used as the
  // completion criterion (the coverage model is).
  assert.match(page, /const MAX_DEEP = \d+/, "MAX_DEEP ceiling must exist");
  assert.match(page, /deepCountRef\.current >= MAX_DEEP/, "MAX_DEEP must act as a hard stop");
});

// ── 7. Deterministic dimension question is available for any missing dimension.
check("questionForDimension yields a targeted question for each missing dimension", () => {
  const pathway = matchPathway("pet me dard");
  const cov = coverageFor(pathway, ["pet me dard", "No"]);
  for (const dim of cov.missing) {
    const q = questionForDimension(pathway, dim);
    assert.ok(q && q.english && q.hinglish, `must produce a bilingual question for missing dimension ${dim}`);
  }
});

// ── 8. Page wiring: the deep phase actually consults the coverage model.
check("page.tsx deep phase is gated on the coverage model (not a single AI turn)", () => {
  assert.match(page, /coverageFor,/, "page must import coverageFor");
  assert.match(page, /questionForDimension,/, "page must import questionForDimension");
  assert.match(page, /function coverageNow\(a: Answers\)/, "page must compute current coverage");
  assert.match(page, /function patientTextsFrom\(a: Answers\)/, "page must gather all patient texts for coverage");
  assert.match(page, /function dimensionQuestion\(missing: HistoryDimension\[\]\)/, "page must build a dimension-targeted fallback question");
  assert.match(page, /if \(coverage\.complete\) return null/, "complete coverage may stop without a fixed count");
  // The AI STOP / duplicate / error branches must consult coverage before ending.
  assert.match(page, /if \(mustContinue\) return dimensionQuestion\(coverage\.missing\)/, "STOP/error branches must ask a dimension question when coverage incomplete");
});

console.log(JSON.stringify({
  suite: "Appointment adaptive-interview coverage model",
  status: "passed",
  total: results.length,
  results,
  proves: [
    "Screenshot scenario (abdominal pain -> No -> No reports) cannot finalize immediately.",
    "Required dimensions are adaptive (differ by complaint), not one fixed questionnaire.",
    "Dimensions satisfied by the initial complaint/duration are not re-asked.",
    "A legitimately complete interview CAN finalize.",
    "Already-provided info is not re-reported as missing.",
    "Completion is coverage-driven; MAX_DEEP is only a hard safety ceiling.",
    "Deep-phase page wiring consults the coverage model.",
  ],
}, null, 2));
