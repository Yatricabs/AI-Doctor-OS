import assert from "node:assert/strict";
import {
  assessAppointmentContext,
  explicitSexCorrection,
  extractSemanticFacts,
} from "../lib/appointmentContextConsistency.ts";

const results = [];
const check = (name, fn) => { fn(); results.push({ name, status: "passed" }); };

check("Man plus vaginal discharge is clarified before routine questioning", () => {
  const result = assessAppointmentContext({ sex: "Man", latestAnswer: "Mere vagina se white discharge ho raha hai", previousAnswers: [] });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.ok(result.contradictions.some((item) => item.code === "DEMOGRAPHIC_ANATOMY_MISMATCH"));
  assert.match(result.question, /sex|symptom/i);
  assert.ok(result.facts.some((item) => item.conceptKey === "anatomy:vaginal"));
});

check("Woman plus vaginal discharge is not falsely contradicted", () => {
  const result = assessAppointmentContext({ sex: "Woman", latestAnswer: "Mere vagina se white discharge ho raha hai", previousAnswers: [] });
  assert.equal(result.status, "CONSISTENT");
  assert.equal(result.contradictions.length, 0);
});

check("Man plus penile discharge is a different anatomy context", () => {
  const result = assessAppointmentContext({ sex: "Man", latestAnswer: "Mere penis se white discharge ho raha hai", previousAnswers: [] });
  assert.equal(result.status, "CONSISTENT");
  assert.ok(result.facts.some((item) => item.conceptKey === "anatomy:penile"));
  assert.ok(!result.facts.some((item) => item.conceptKey === "anatomy:vaginal"));
});

check("Opposite medication claims are held for clarification", () => {
  const result = assessAppointmentContext({ latestAnswer: "Main roz do medicines leta hoon", previousAnswers: ["Meri koi current medicine nahi hai"] });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.ok(result.contradictions.some((item) => item.code === "OPPOSING_CLAIMS"));
});

check("Prior treatment contradicts an earlier denial", () => {
  const result = assessAppointmentContext({ latestAnswer: "Maine antibiotics liye the", previousAnswers: ["Koi previous treatment nahi liya"] });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.ok(result.contradictions.some((item) => item.code === "OPPOSING_CLAIMS"));
});

check("New-patient label does not erase prior-record evidence", () => {
  const result = assessAppointmentContext({ patientType: "New patient", latestAnswer: "Mere paas purani prescription hai", previousAnswers: [] });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.ok(result.contradictions.some((item) => item.code === "HISTORY_MISMATCH"));
});

check("Changed side/location is not silently overwritten", () => {
  const result = assessAppointmentContext({ latestAnswer: "Ab right side mein dard hai", previousAnswers: ["Left side mein dard hai"] });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.ok(result.contradictions.some((item) => item.code === "CHANGED_BODY_SITE"));
});

check("Safety is evaluated before routine consistency", () => {
  const result = assessAppointmentContext({ sex: "Man", latestAnswer: "Seene mein pressure aur saans ki dikkat hai", previousAnswers: [] });
  assert.equal(result.status, "SAFETY_CONCERN");
  assert.ok(result.safetyFlags.length > 0);
});

check("Explicit structured correction is separated from AI inference", () => {
  assert.equal(explicitSexCorrection("Galti se Man select ho gaya tha, main female hoon"), "Woman");
  assert.equal(explicitSexCorrection("shayad kuch aur problem hai"), null);
});

check("Fact extraction keeps provenance and does not diagnose", () => {
  const facts = extractSemanticFacts("Maine antibiotics liye aur left side mein pain hai");
  assert.ok(facts.some((item) => item.kind === "MEDICATION_CLAIM" && item.source === "PATIENT"));
  assert.ok(facts.some((item) => item.conceptKey === "site:left"));
  assert.ok(!facts.some((item) => item.kind === "DIAGNOSIS_CLAIM" && /diagnosis/i.test(item.value)));
});

console.log(JSON.stringify({ suite: "appointment-intake-context", status: "passed", total: results.length, results }, null, 2));
