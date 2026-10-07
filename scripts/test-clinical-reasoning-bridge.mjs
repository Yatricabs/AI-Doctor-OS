/**
 * Verification test suite for AI UPCHAR Clinical Reasoning Bridge.
 * Tests contract conformity, emergency triage floor, non-diagnostic restraint,
 * and zero-downtime offline fallback resilience.
 */

import assert from "node:assert/strict";

// Dynamic import of TypeScript client using Node's type-stripping / tsx
let clinicalClient;
try {
  clinicalClient = await import("../lib/clinicalReasoningClient.ts");
} catch {
  // If native ts loading requires explicit strip
  console.log("Loading clinicalReasoningClient...");
}

const { deterministicClinicalFloor, evaluateClinicalReasoning, validateClinicalReasoningResponse } = clinicalClient;

console.log("==================================================================");
console.log("RUNNING AI UPCHAR CLINICAL REASONING BRIDGE TESTS");
console.log("==================================================================");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

// ── Test 1: Emergency acute symptoms trigger SAFETY_REVIEW ────────────────────
runTest("Emergency symptoms trigger immediate SAFETY_REVIEW", () => {
  const req = {
    patient_context: { age: "54", sex: "M" },
    current_answer: "Severe chest pressure and saans lene me dikkat ho rahi hai.",
    semantic_context: {},
    safety_state: { status: "CLEAR" },
    retrieved_evidence: [],
  };

  const result = deterministicClinicalFloor(req);
  assert.equal(result.recommended_action, "SAFETY_REVIEW");
  assert.equal(result.semantic_interpretation.confirmed_diagnoses, null);
  assert.ok(result.next_best_question && result.next_best_question.length > 0);
  assert.ok(result.clinical_considerations.length > 0);
  assert.equal(result.source, "CLINICAL_SAFETY_FLOOR");
  assert.ok(result.disclaimer.includes("AI assists. Doctors decide."));
});

// ── Test 2: Explicit SAFETY_CONCERN status triggers SAFETY_REVIEW ─────────────
runTest("Safety concern status in request triggers SAFETY_REVIEW", () => {
  const req = {
    patient_context: {},
    current_answer: "Normal headache",
    semantic_context: {},
    safety_state: { status: "SAFETY_CONCERN" },
    retrieved_evidence: [],
  };

  const result = deterministicClinicalFloor(req);
  assert.equal(result.recommended_action, "SAFETY_REVIEW");
});

// ── Test 3: Routine symptom yields ASK_QUESTION with temporal extraction ───────
runTest("Routine dysuria extracts temporal facts and asks for missing severity", () => {
  const req = {
    patient_context: {},
    current_answer: "Peshab me jalan aur dard hai 2 din se.",
    semantic_context: {},
    safety_state: { status: "CLEAR" },
    retrieved_evidence: [],
  };

  const result = deterministicClinicalFloor(req);
  assert.equal(result.recommended_action, "ASK_QUESTION");
  assert.equal(result.semantic_interpretation.confirmed_diagnoses, null);
  assert.ok(result.semantic_interpretation.problems.includes("dysuria/urinary symptom"));
  assert.ok(result.semantic_interpretation.temporal_facts.some((f) => f.includes("2 din")));
  assert.ok(result.missing_information.includes("severity"));
  assert.ok(result.next_best_question.includes("1 se 10"));
});

// ── Test 4: Missing duration is prioritized when timeline is absent ───────────
runTest("Missing duration asks timeline question first", () => {
  const req = {
    patient_context: {},
    current_answer: "Mujhe bukhar aur khansi hai.",
    semantic_context: {},
    safety_state: { status: "CLEAR" },
    retrieved_evidence: [],
  };

  const result = deterministicClinicalFloor(req);
  assert.equal(result.recommended_action, "ASK_QUESTION");
  assert.ok(result.missing_information.includes("duration"));
  assert.ok(result.next_best_question.includes("kab se"));
});

// ── Test 5: All 6 Phase 4A contract keys are present in all responses ─────────
runTest("All 6 contract keys are strictly present in output", () => {
  const req = {
    patient_context: {},
    current_answer: "Pet me dard hai.",
    semantic_context: {},
    safety_state: { status: "CLEAR" },
    retrieved_evidence: [],
  };

  const result = deterministicClinicalFloor(req);
  const keys = Object.keys(result);
  for (const requiredKey of [
    "semantic_interpretation",
    "recommended_action",
    "next_best_question",
    "missing_information",
    "clinical_considerations",
    "confidence",
  ]) {
    assert.ok(keys.includes(requiredKey), `Missing required key: ${requiredKey}`);
  }
});

// ── Test 6: Strict gateway response validation rejects malformed contracts ────
runTest("Gateway response validator fails closed on incomplete output", () => {
  assert.throws(
    () => validateClinicalReasoningResponse({ recommended_action: "CLARIFY" }),
    /missing keys/i,
  );

  assert.throws(
    () => validateClinicalReasoningResponse({
      semantic_interpretation: {},
      recommended_action: "CLARIFY",
      next_best_question: null,
      missing_information: ["duration", 3],
      clinical_considerations: [],
      confidence: "MEDIUM",
    }),
    /missing_information/i,
  );

  assert.throws(
    () => validateClinicalReasoningResponse({
      semantic_interpretation: { confirmed_diagnoses: ["pneumonia"] },
      recommended_action: "CLARIFY",
      next_best_question: null,
      missing_information: [],
      clinical_considerations: [],
      confidence: "MEDIUM",
    }),
    /confirm/i,
  );
});

// ── Test 7: Semantically invalid but syntactically valid JSON falls back ─────
await runAsyncTest("Malformed gateway contract uses deterministic safety floor", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        semantic_interpretation: {},
        recommended_action: "CLARIFY",
        next_best_question: null,
        missing_information: ["duration", 42],
        clinical_considerations: [],
        confidence: "MEDIUM",
      };
    },
  });

  try {
    const result = await evaluateClinicalReasoning(
      {
        patient_context: {},
        current_answer: "Severe chest pressure",
        semantic_context: {},
        safety_state: { status: "CLEAR" },
        retrieved_evidence: [],
      },
      { gatewayUrl: "http://mock-gateway", timeoutMs: 500 },
    );
    assert.equal(result.source, "CLINICAL_SAFETY_FLOOR");
    assert.equal(result.recommended_action, "SAFETY_REVIEW");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 8: Zero-downtime offline fallback resilience ─────────────────────────
await runAsyncTest("Offline gateway automatically falls back to clinical safety floor", async () => {
  const req = {
    patient_context: {},
    current_answer: "Chakkar aa rahe hain kal se.",
    semantic_context: {},
    safety_state: { status: "CLEAR" },
    retrieved_evidence: [],
  };

  // Point to an intentionally unreachable port
  const result = await evaluateClinicalReasoning(req, {
    gatewayUrl: "http://127.0.0.1:59999",
    timeoutMs: 500,
  });

  assert.ok(result);
  assert.equal(result.source, "CLINICAL_SAFETY_FLOOR");
  assert.equal(result.recommended_action, "ASK_QUESTION");
  assert.equal(result.semantic_interpretation.confirmed_diagnoses, null);
});

console.log("==================================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
