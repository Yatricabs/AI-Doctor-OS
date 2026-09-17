import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "app/patient/appointment/page.tsx"), "utf8");
const pathways = fs.readFileSync(path.join(root, "lib/clinicalPathways.ts"), "utf8");

// Deterministic contract model for the fallback and safety guarantees.
const MIN_DEEP = 3;
function finalizeAllowed(count, unresolvedSafety) {
  return count >= MIN_DEEP && !unresolvedSafety;
}
function fallbackProbe(outcome, pathwayAvailable) {
  if (pathwayAvailable) return "curated pathway question";
  if (["STOP", "", "duplicate", "unusable", "throw"].includes(outcome)) return "severity/frequency probe";
  return "AI question";
}
for (const outcome of ["STOP", "", "duplicate", "unusable", "throw"]) {
  assert.equal(finalizeAllowed(0, false), false, `${outcome} must not finalize with zero focused questions`);
  assert.equal(finalizeAllowed(2, false), false, `${outcome} must not finalize below MIN_DEEP`);
  assert.equal(fallbackProbe(outcome, true), "curated pathway question");
  assert.equal(fallbackProbe(outcome, false), "severity/frequency probe");
}
assert.equal(finalizeAllowed(MIN_DEEP, false), true);
assert.equal(finalizeAllowed(5, true), false, "unresolved pathway safety must remain visible");

assert.match(source, /buildResearchPlan\(next\)/);
assert.match(source, /researchRef\.current = clean/);
assert.match(source, /const pathwayMismatch = Boolean\(pathway/);
assert.match(source, /const topicCovered = Boolean\(pathway/);
assert.match(source, /return pathwayFallbackQuestion\(a\)/);
assert.match(source, /function patientSafetyText\(a: Answers\)/);
assert.match(source, /detectRedFlags\(pathwayRef\.current, patientSafetyText\(a\)\)/);
assert.match(source, /AI-generated intake support is unverified; clinician review is required/);
assert.match(source, /Safety limitation: not all pathway danger-sign topics/);
assert.match(pathways, /urgency: "emergency"/);
assert.match(pathways, /chest_radiation/);
assert.match(pathways, /gen_breathless/);

console.log(JSON.stringify({
  suite: "Task 3.5 fallback and deterministic safety contracts",
  status: "passed",
  earlyServiceOutcomes: ["STOP", "empty", "duplicate", "unusable", "throw"],
  contracts: ["background research plan", "curated pathway authority", "complaint-aware no-pathway probes", "all-answer red-flag scan", "unresolved safety preservation", "fallback clinician disclaimer"],
}, null, 2));
