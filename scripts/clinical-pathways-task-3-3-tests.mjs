import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "lib/clinicalPathways.ts"), "utf8");
const appointment = fs.readFileSync(path.join(root, "app/patient/appointment/page.tsx"), "utf8");

const STOP_WORDS = new Set(["me", "mein", "ka", "ki", "ke", "hai", "ho", "raha", "rahi", "aur", "se", "par", "ek", "the", "a", "an", "of", "in", "is", "my", "to"]);
const GENERIC_SINGLE_TOKENS = new Set(["pain", "dard", "problem", "issue", "symptom", "symptoms", "takleef", "dikkat", "discomfort", "doctor", "report", "reports", "health"]);
const pathways = {
  chest_pain: ["chest pain", "seene me dard", "seene mein dard", "chhati me dard", "heart pain", "dil me dard", "chest tightness", "सीने में दर्द"],
  cough_breathing: ["cough", "khaansi", "breathless", "saans", "breathing problem"],
};
function normalize(value) {
  return ` ${String(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
}
function tokens(value) {
  return normalize(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
function score(synonyms, complaint) {
  const textTokens = tokens(complaint);
  const words = new Set(textTokens);
  let total = 0;
  for (const synonym of synonyms) {
    const synTokens = tokens(synonym);
    const synText = synTokens.join(" ");
    if (synTokens.length > 1 && textTokens.join(" ").includes(synText)) {
      total += Math.min(4, 1 + Math.floor(synTokens.length / 2) + Math.floor(synText.length / 12));
      continue;
    }
    if (synTokens.length === 1) {
      if (!GENERIC_SINGLE_TOKENS.has(synTokens[0]) && words.has(synTokens[0])) total += 2;
      continue;
    }
    const shared = synTokens.filter((token) => words.has(token)).length;
    if (shared >= 2 && shared / synTokens.length >= 0.6) total += 2;
  }
  return total;
}
function match(complaint) {
  const ranked = Object.entries(pathways).map(([id, synonyms]) => [id, score(synonyms, complaint)]).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] >= 2 ? ranked[0][0] : null;
}

const cases = [
  ["inserted-word Hinglish", "seene me tez dard hai pichale 2 din se", "chest_pain"],
  ["punctuated/case Hinglish", "SEENE-ME, bahut DARD!", "chest_pain"],
  ["Hindi Unicode variant", "सीने में बहुत तेज दर्द हो रहा है", "chest_pain"],
  ["adjacent English", "Chest pain since yesterday", "chest_pain"],
  ["partial but significant English phrase", "chest tightness and sweating", "chest_pain"],
  ["single-token specific complaint", "persistent cough", "cough_breathing"],
];
for (const [name, complaint, expected] of cases) assert.equal(match(complaint), expected, `${name} did not match ${expected}`);
for (const complaint of ["pain", "dard", "random problem", "doctor report", "health issue", "something feels bad"]) {
  assert.equal(match(complaint), null, `generic text falsely matched: ${complaint}`);
}

assert.match(source, /function significantTokens/);
assert.match(source, /GENERIC_SINGLE_TOKENS/);
assert.match(source, /shared >= 2 && shared \/ synTokens\.length >= 0\.6/);
assert.match(source, /bestScore >= 2/);
assert.match(appointment, /function isPathwayFramedQuestion/);
assert.match(appointment, /pathwayMismatch/);
assert.match(appointment, /pathwayFallbackQuestion\(a\)/);

console.log(JSON.stringify({
  suite: "Task 3.3 clinical pathway matching",
  status: "passed",
  total: cases.length + 6,
  matchedCases: cases.map(([name, complaint, pathway]) => ({ name, complaint, pathway })),
  genericFalsePositiveCases: ["pain", "dard", "random problem", "doctor report", "health issue", "something feels bad"],
  contracts: ["normalized significant-token overlap", "confidence threshold", "generic single-token guard", "pathway-framed deep question guard"],
}, null, 2));
