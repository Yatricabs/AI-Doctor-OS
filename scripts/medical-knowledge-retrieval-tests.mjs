import assert from "node:assert/strict";
import { clearEvidenceCacheForTests } from "../lib/medicalKnowledge/cache.ts";
import { fingerprintRetrievalContext } from "../lib/medicalKnowledge/context.ts";
import { assessKnowledgeNeed } from "../lib/medicalKnowledge/decision.ts";
import { enrichClinicalContext } from "../lib/medicalKnowledge/service.ts";
import { extractClinicalContext } from "../lib/appointmentContextConsistency.ts";

const results = [];
const check = async (name, fn) => { await fn(); results.push({ name, status: "passed" }); };
const fact = (kind, value, conceptKey) => ({ kind, value, conceptKey, normalizedConcept: conceptKey, polarity: "PRESENT", confidence: "HIGH", evidence: value, source: "PATIENT" });
const context = (text, overrides = {}) => {
  const representation = extractClinicalContext(text);
  return { representation, semanticFacts: representation.facts, patientContext: {}, safetyStatus: "CLEAR", coveredInformation: [], ...overrides };
};

const evidence = (request) => ({
  contextKey: request.contextKey, decision: request.decision.decision, provider: "mock-trusted-provider",
  relevantConcepts: ["context-only-concept"], potentiallyRelevantConsiderations: ["Consider asking about relevant warning signs."],
  missingInformationSuggestedByEvidence: ["relevant history"], sources: [{ id: "s1", title: "Trusted source", source: "who.int", url: "https://www.who.int/test", sourceType: "GUIDELINE", retrievedAt: new Date().toISOString(), relevance: "HIGH", summary: "Mock evidence." }],
  retrievedAt: new Date().toISOString(),
});

await check("simple symptom with duration does not require retrieval", () => {
  assert.equal(assessKnowledgeNeed(context("Mujhe 5 din se headache hai")).decision, "NO_RETRIEVAL_NEEDED");
});

await check("unknown medical term is preserved and retrievable", () => {
  const value = context("Mujhe ankylosing spondylitis hai");
  assert.ok(value.representation.problems[0].facts.some((item) => item.kind === "PROBLEM_REFERENCE"));
  assert.equal(assessKnowledgeNeed(value).decision, "RETRIEVAL_REQUIRED_FOR_CONTEXT");
});

await check("multiple problems create combined retrieval context", () => {
  const value = context("Mujhe diabetes hai aur pair me wound hai aur bukhar hai");
  assert.ok(value.representation.problems.length >= 3);
  assert.notEqual(assessKnowledgeNeed(value).decision, "NO_RETRIEVAL_NEEDED");
});

await check("patient-reported diagnosis remains unconfirmed", async () => {
  const value = context("Meri kidney me infection hai");
  assert.ok(value.semanticFacts.some((item) => item.conceptKey === "diagnosis:patient_reported"));
  const run = await enrichClinicalContext(value, { id: "mock", retrieve: async (request) => evidence(request) });
  assert.ok(run.evidence);
  assert.ok(!value.semanticFacts.some((item) => item.conceptKey === "diagnosis:confirmed"));
});

await check("medication adverse-effect context recommends retrieval", () => {
  const value = context("Medicine lene ke baad itching ho rahi hai");
  value.semanticFacts = [fact("MEDICATION_CLAIM", "medicine", "medication:reported"), fact("SYMPTOM", "itching", "symptom:itching"), fact("TRIGGER_REFERENCE", "after medicine", "trigger:after_medication")];
  assert.equal(assessKnowledgeNeed(value).decision, "RETRIEVAL_REQUIRED_FOR_CONTEXT");
});

await check("anatomy context is available to retrieval", () => {
  const value = context("Mere vagina se discharge ho raha hai", { patientContext: { sex: "Man" }, safetyStatus: "NEEDS_CLARIFICATION" });
  assert.ok(value.semanticFacts.some((item) => item.conceptKey === "anatomy:vaginal"));
  assert.notEqual(assessKnowledgeNeed(value).decision, "NO_RETRIEVAL_NEEDED");
});

await check("safety concern cannot be downgraded", async () => {
  const value = context("Chest pressure aur saans phool rahi hai", { safetyStatus: "SAFETY_CONCERN" });
  const run = await enrichClinicalContext(value, { id: "mock", retrieve: async (request) => evidence(request) });
  assert.equal(run.decision.decision, "SAFETY_CONTEXT_RETRIEVAL");
  assert.equal(value.safetyStatus, "SAFETY_CONCERN");
});

await check("no useful result never invents evidence", async () => {
  const value = context("Mujhe rare unknown syndrome hai");
  const run = await enrichClinicalContext(value, { id: "empty", retrieve: async (request) => ({ ...evidence(request), relevantConcepts: [], potentiallyRelevantConsiderations: [], missingInformationSuggestedByEvidence: [], sources: [], uncertainty: "No trustworthy evidence." }) });
  assert.equal(run.evidence.sources.length, 0);
  assert.match(run.evidence.uncertainty, /no trustworthy/i);
});

await check("duplicate query uses cache", async () => {
  clearEvidenceCacheForTests();
  let calls = 0;
  const provider = { id: "counting", retrieve: async (request) => { calls += 1; return evidence(request); } };
  const value = context("Mujhe ankylosing spondylitis hai");
  const first = await enrichClinicalContext(value, provider);
  const second = await enrichClinicalContext(value, provider);
  assert.equal(calls, 1); assert.equal(first.evidence.cacheHit, false); assert.equal(second.evidence.cacheHit, true);
});

await check("retrieved evidence never becomes patient fact", async () => {
  clearEvidenceCacheForTests();
  const value = context("Mujhe ankylosing spondylitis hai");
  const before = JSON.stringify(value.semanticFacts);
  await enrichClinicalContext(value, { id: "mock", retrieve: async (request) => evidence(request) });
  assert.equal(JSON.stringify(value.semanticFacts), before);
});

await check("edit or replay changes context fingerprint", () => {
  const before = context("Right side pain hai");
  const after = context("Left side pain hai");
  assert.notEqual(fingerprintRetrievalContext(before), fingerprintRetrievalContext(after));
});

await check("retrieval failure safely returns existing reasoning path", async () => {
  const run = await enrichClinicalContext(context("Mujhe unusual syndrome hai"), { id: "failure", retrieve: async () => { throw new Error("offline"); } });
  assert.equal(run.evidence, null); assert.equal(run.failed, true);
});

await check("Hindi Hinglish and English inputs remain usable", () => {
  for (const text of ["मुझे एक अनजान बीमारी बताई गई है", "Mujhe unusual syndrome hai", "I was told I have an unusual syndrome"]) {
    assert.ok(context(text).representation.problems.length >= 1);
  }
});

await check("Hindi clinical statement creates a problem context", () => {
  assert.ok(context("मुझे पांच दिन से सिरदर्द है").representation.problems.length >= 1);
});

await check("English clinical statement creates a problem context", () => {
  assert.ok(context("I have had a headache for five days").representation.problems.length >= 1);
});

console.log(JSON.stringify({ suite: "medical-knowledge-retrieval", status: "passed", total: results.length, results }, null, 2));
