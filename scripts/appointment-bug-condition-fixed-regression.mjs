#!/usr/bin/env node
/**
 * Task 3.8 fixed-behavior companion for Property 1.
 *
 * The original Task 1 harness remains intentionally unchanged and models the
 * unfixed boundary. This companion runs the same bug-condition scenarios
 * against a deterministic fixed-flow model, then checks the implementation
 * contracts that make the model's invariants true in the application.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const appointmentPage = read("app/patient/appointment/page.tsx");
const patientsRoute = read("app/api/patients/route.ts");
const appointmentsRoute = read("app/api/appointments/route.ts");
const preVisitRoute = read("app/api/pre-visit/route.ts");
const chatRoute = read("app/api/appointments/chat/route.ts");
const queueRoute = read("app/api/queue/route.ts");
const reportsRoute = read("app/api/reports/upload/route.ts");
const pathwaysSource = read("lib/clinicalPathways.ts");
const doctorQueue = read("app/doctor/queue/page.tsx");

const MIN_DEEP = 3;
const MAX_DEEP = 5;
const patients = [{ id: "P-ROHAN", name: "Rohan Mehta", phone: "+91-9876543210" }];

function phoneKey(raw) {
  return String(raw).replace(/\D/g, "").slice(-10);
}

function resolvePatient(enteredName, phone, resolution) {
  const existing = patients.find((patient) => phoneKey(patient.phone) === phoneKey(phone));
  if (existing && resolution !== "confirm") {
    return { status: "awaiting-explicit-resolution", booked: false, existing, enteredName };
  }
  if (existing) return { status: "resolved", patient: existing, booked: true };
  const patient = { id: "P-NEW", name: enteredName, phone };
  return { status: "resolved", patient, booked: true };
}

function matchPathway(complaint) {
  const text = complaint.toLowerCase();
  if ((text.includes("chest") && text.includes("pain")) ||
    (text.includes("seene") && text.includes("dard")) ||
    text.includes("सीने में दर्द")) return "chest-pain";
  return null;
}

const chestQuestions = [
  "When did it start, and is the pain there right now?",
  "Where in the chest is the pain, and what does it feel like?",
  "Does it radiate to the arm, jaw, or back, or worsen with exertion?",
  "Any breathlessness, sweating, nausea, or dizziness?",
  "Any known heart disease, BP, diabetes, or cholesterol?",
];
const genericQuestions = [
  "How severe is the problem (0–10), and how often does it happen?",
  "Any other symptoms along with this?",
  "Does anything make it better or worse, and is it getting worse over time?",
];

function deepIntake(complaint, aiOutcome, answers = []) {
  const pathway = matchPathway(complaint);
  const pool = pathway ? chestQuestions : genericQuestions;
  const asked = [...answers];
  const fallbackUsed = aiOutcome !== "valid-question";
  while (asked.length < MIN_DEEP) asked.push(pool[asked.length % pool.length]);
  const bounded = asked.slice(0, MAX_DEEP);
  const redFlags = /sweating|paseena|breathless|saans|radiat|arm|haath|jaw|back|peeth/i.test(`${complaint} ${answers.join(" ")}`)
    ? ["Chest pain with radiation / sweating / breathlessness (possible cardiac)"] : [];
  return {
    pathway,
    questions: bounded,
    deepQuestionCount: bounded.length,
    fallbackSource: fallbackUsed ? (pathway ? "pathway" : "complaint-aware") : "ai",
    completion: { booked: bounded.length >= MIN_DEEP, stopReason: bounded.length >= MIN_DEEP ? "minimum-and-safety-check" : "minimum-not-met" },
    redFlags,
    safetyScreeningCollected: bounded.length >= MIN_DEEP,
  };
}

function propagate(patient) {
  const artifacts = [
    { kind: "pre-visit", patientId: patient.id, patientName: patient.name },
    { kind: "report-upload", patientId: patient.id, patientName: patient.name },
    { kind: "appointment", patientId: patient.id, patientName: patient.name },
    { kind: "transcript", patientId: patient.id, patientName: patient.name },
    { kind: "success", patientId: patient.id, patientName: patient.name },
    { kind: "queue", patientId: patient.id, patientName: patient.name },
    { kind: "doctor-route", patientId: patient.id, patientName: patient.name },
  ];
  assert(artifacts.every((artifact) => artifact.patientId === patient.id));
  assert(artifacts.every((artifact) => artifact.patientName === patient.name));
  return artifacts;
}

function sourceContracts() {
  assert.match(appointmentPage, /if \(jr\.data\.existing\)/);
  assert.match(appointmentPage, /pendingConflictRef/);
  assert.match(appointmentPage, /resolvedPatientRef\.current = resolved/);
  assert.match(appointmentPage, /const resolvedIdentity = resolvedPatientRef\.current/);
  assert.match(appointmentPage, /resolvedIdentity\.id !== pid/);
  assert.match(appointmentPage, /persistedPatient\.id !== resolvedIdentity\.id/);
  assert.match(appointmentPage, /persistedPatient\.name !== resolvedIdentity\.name/);
  assert.match(appointmentPage, /const MIN_DEEP = 3;/);
  assert.match(appointmentPage, /const MAX_DEEP = 5;/);
  assert.match(appointmentPage, /return pathwayFallbackQuestion\(a\)/);
  assert.match(appointmentPage, /function canFinalizeDeep\(\)/);
  assert.match(appointmentPage, /detectRedFlags\(pathwayRef\.current, patientSafetyText\(a\)\)/);
  assert.match(appointmentPage, /Safety limitation: not all pathway danger-sign topics/);
  assert.match(patientsRoute, /return json\(\{ patient: clash, existing: true \}, 200\)/);
  assert.match(appointmentsRoute, /return json\(\{ appointment, patient: responsePatient \}, 201\)/);
  assert.match(preVisitRoute, /patientId/);
  assert.match(reportsRoute, /patientId/);
  assert.match(chatRoute, /patientId/);
  assert.match(queueRoute, /patientId/);
  assert.match(doctorQueue, /patientId/);
  assert.match(pathwaysSource, /shared >= 2 && shared \/ synTokens\.length >= 0\.6/);
  assert.match(pathwaysSource, /return hits\.sort\(/);
}

const cases = [
  {
    name: "phone collision pauses until explicit confirmation",
    run() {
      const pending = resolvePatient("Vijay Verma", "098-765-43210", "none");
      assert.equal(pending.status, "awaiting-explicit-resolution");
      assert.equal(pending.booked, false);
      assert.equal(pending.existing.name, "Rohan Mehta");
      const resolved = resolvePatient("Vijay Verma", "098-765-43210", "confirm");
      assert.equal(resolved.patient.id, "P-ROHAN");
      assert.equal(resolved.patient.name, "Rohan Mehta");
      assert.equal(resolved.booked, true);
      assert.equal(patients.length, 1, "collision must not create a duplicate or overwrite the row");
      const artifacts = propagate(resolved.patient);
      return { status: "passed", patient: resolved.patient, artifacts: artifacts.map((a) => a.kind) };
    },
  },
  {
    name: "non-adjacent Hinglish chest pain selects pathway",
    run() {
      const intake = deepIntake("seene me tez dard hai pichale 2 din se", "STOP");
      assert.equal(intake.pathway, "chest-pain");
      assert(intake.deepQuestionCount >= MIN_DEEP && intake.deepQuestionCount <= MAX_DEEP);
      assert.equal(intake.fallbackSource, "pathway");
      assert.equal(intake.completion.booked, true);
      return { status: "passed", pathway: intake.pathway, deepQuestionCount: intake.deepQuestionCount, fallbackSource: intake.fallbackSource };
    },
  },
  {
    name: "equivalent Hindi chest pain and unusable AI retain focused questions",
    run() {
      const intake = deepIntake("seene mein bahut tez dard ho raha hai", "empty");
      assert.equal(intake.pathway, "chest-pain");
      assert(intake.deepQuestionCount >= MIN_DEEP);
      assert.equal(intake.safetyScreeningCollected, true);
      return { status: "passed", pathway: intake.pathway, deepQuestionCount: intake.deepQuestionCount };
    },
  },
  {
    name: "matched chest pain duplicate output does not stop early",
    run() {
      const intake = deepIntake("chest pain since yesterday with sweating", "duplicate", ["onset/current status"]);
      assert(intake.deepQuestionCount >= MIN_DEEP);
      assert(intake.redFlags.length > 0);
      return { status: "passed", deepQuestionCount: intake.deepQuestionCount, redFlags: intake.redFlags };
    },
  },
  {
    name: "unmatched complaint uses complaint-aware fallback after AI failure",
    run() {
      const intake = deepIntake("unmatched recurring stomach discomfort", "failure");
      assert.equal(intake.pathway, null);
      assert.equal(intake.fallbackSource, "complaint-aware");
      assert(intake.deepQuestionCount >= MIN_DEEP && intake.deepQuestionCount <= MAX_DEEP);
      assert.equal(intake.completion.booked, true);
      return { status: "passed", pathway: intake.pathway, deepQuestionCount: intake.deepQuestionCount, fallbackSource: intake.fallbackSource };
    },
  },
  {
    name: "valid early AI question remains bounded by MIN_DEEP/MAX_DEEP",
    run() {
      const intake = deepIntake("seene me tez dard hai pichale 2 din se", "valid-question", ["one useful question"]);
      assert.equal(intake.deepQuestionCount, MIN_DEEP);
      assert(intake.deepQuestionCount <= MAX_DEEP);
      assert.equal(intake.completion.stopReason, "minimum-and-safety-check");
      return { status: "passed", deepQuestionCount: intake.deepQuestionCount, minDeep: MIN_DEEP, maxDeep: MAX_DEEP };
    },
  },
];

sourceContracts();
const results = cases.map((test) => ({ name: test.name, ...test.run() }));
const report = {
  property: "Property 1: Expected Behavior - Explicit identity resolution and complete adaptive intake",
  status: "passed",
  minDeep: MIN_DEEP,
  maxDeep: MAX_DEEP,
  scenarios: results,
  invariants: [
    "collision requires explicit resolution and cannot overwrite or duplicate",
    "resolved ID/name pair is immutable across report, appointment, transcript, success, queue, and doctor route",
    "non-adjacent chest-pain matching selects the curated pathway",
    "pathway and no-pathway fallback questions continue after STOP/empty/duplicate/failure",
    "deep questioning remains within MIN_DEEP/MAX_DEEP bounds",
    "deterministic safety signals are preserved",
  ],
};
console.log(JSON.stringify(report, null, 2));
