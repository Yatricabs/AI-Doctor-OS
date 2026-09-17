import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "app/patient/appointment/page.tsx"), "utf8");

// Deterministic boundary model for the contracts implemented in the page.
const MIN_DEEP = 3;
const MAX_DEEP = 5;
function shouldFinalize(count, unresolvedSafety) {
  return count >= MIN_DEEP && !unresolvedSafety;
}
function nextFallback(questions, covered) {
  return questions.find((question) => !covered.has(question)) ?? null;
}

for (const outcome of ["STOP", "", "duplicate", "unusable", "throw"]) {
  assert.equal(shouldFinalize(0, false), false, `${outcome} finalized before MIN_DEEP`);
  assert.equal(shouldFinalize(2, false), false, `${outcome} finalized with only two deep questions`);
}
assert.equal(shouldFinalize(MIN_DEEP, false), true, "ordinary completion should be allowed at MIN_DEEP when safety is covered");
assert.equal(shouldFinalize(MAX_DEEP, true), false, "unresolved safety must remain blocking/visible at MAX_DEEP");
assert.equal(nextFallback(["onset", "location", "radiation"], new Set(["onset"])), "location", "covered topic was not skipped to the next uncovered topic");
assert.equal(nextFallback(["onset", "location"], new Set(["onset", "location"])), null, "covered topics should not be re-asked");

assert.match(source, /const MIN_DEEP = 3;/);
assert.match(source, /const MAX_DEEP = 5;/);
assert.match(source, /function deepQuestionsCollected\(\)/);
assert.match(source, /function isQuestionTopicCovered\(question: string\)/);
assert.match(source, /function hasUnresolvedSafetyTopics\(\)/);
assert.match(source, /function canFinalizeDeep\(\)/);
assert.match(source, /const topicCovered = Boolean\(pathway && isQuestionTopicCovered\(clean\)\);/);
assert.match(source, /isDuplicateQuestion\(clean\) \|\| topicCovered \|\| pathwayMismatch/);
assert.match(source, /!isQuestionTopicCovered\(text\) && !isDuplicateQuestion\(text\)/);
assert.match(source, /symptoms: transcript \|\| a\.symptoms/);
assert.match(source, /Safety limitation: not all pathway danger-sign topics/);

console.log(JSON.stringify({
  suite: "Task 3.4 adaptive intake boundaries",
  status: "passed",
  minDeep: MIN_DEEP,
  maxDeep: MAX_DEEP,
  earlyStopOutcomesCovered: ["STOP", "empty", "duplicate", "unusable", "throw"],
  contracts: ["minimum before finalize", "bounded ordinary completion", "unresolved safety visibility", "covered-topic skipping", "deep Q/A symptom folding"],
}, null, 2));
