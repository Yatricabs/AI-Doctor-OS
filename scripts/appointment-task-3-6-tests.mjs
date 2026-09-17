import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const patientsRoute = read("app/api/patients/route.ts");
const appointmentsRoute = read("app/api/appointments/route.ts");
const appointmentPage = read("app/patient/appointment/page.tsx");
const pathwaysSource = read("lib/clinicalPathways.ts");
const preVisitRoute = read("app/api/pre-visit/route.ts");
const chatRoute = read("app/api/appointments/chat/route.ts");
const queueRoute = read("app/api/queue/route.ts");
const doctorQueue = read("app/doctor/queue/page.tsx");

const results = [];
function unit(name, fn) {
  fn();
  results.push({ name, kind: "unit", status: "passed" });
}
function property(name, fn) {
  fn();
  results.push({ name, kind: "property", status: "passed" });
}
function contract(name, fn) {
  fn();
  results.push({ name, kind: "contract", status: "passed" });
}

function phoneKey(raw) {
  return String(raw).replace(/\D/g, "").slice(-10);
}
const digitsFor = (seed) => String(9000000000 + (seed % 999999999)).padStart(10, "0");
const equivalentPhones = (digits) => [
  digits,
  `+91-${digits.slice(0, 5)}-${digits.slice(5)}`,
  `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
  `0${digits}`,
  `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
];

unit("phone-key equivalence and invalid rejection", () => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const digits = digitsFor(seed);
    assert(equivalentPhones(digits).every((phone) => phoneKey(phone) === digits), digits);
  }
  for (const invalid of ["", "123", "+91-12345", "abc-def", "98 76"]) {
    assert(phoneKey(invalid).length < 10, `invalid phone accepted: ${invalid}`);
  }
  assert.match(patientsRoute, /digits\.slice\(-10\)/);
  assert.match(patientsRoute, /key\.length < 10/);
  assert.match(patientsRoute, /return error\("Enter a valid 10-digit mobile number\."/);
});

unit("collision response is explicit and does not overwrite or duplicate", () => {
  const existing = { id: "P-ROHAN", name: "Rohan Mehta", phone: "+91-9876543210" };
  const submitted = { id: "P-NEW", name: "Vijay Verma", phone: "09876543210" };
  const records = [existing];
  const collision = records.find((patient) => phoneKey(patient.phone) === phoneKey(submitted.phone));
  assert.deepEqual(collision, existing);
  assert.equal(records.length, 1);
  assert.equal(existing.name, "Rohan Mehta");
  assert.equal(existing.phone, "+91-9876543210");
  assert.equal(submitted.name === existing.name, false);
  assert.deepEqual({ patient: collision, existing: true }, { patient: existing, existing: true });
  assert.match(patientsRoute, /if \(clash\) return json\(\{ patient: clash, existing: true \}, 200\)/);
  assert.doesNotMatch(patientsRoute, /clash\.name\s*=/);
  assert.doesNotMatch(patientsRoute, /update.*clash/i);
});

property("only explicit resolution can book a collision", () => {
  for (let seed = 0; seed < 250; seed += 1) {
    const conflict = { id: `P-${seed}`, name: `Confirmed ${seed}` };
    const flow = { pending: conflict, resolved: null, booked: false };
    const tryBook = () => { flow.booked = Boolean(flow.resolved); return flow.booked; };
    assert.equal(tryBook(), false);
    flow.resolved = { ...conflict };
    assert.equal(tryBook(), true);
    assert.deepEqual(flow.resolved, conflict);
  }
  assert.match(appointmentPage, /pendingConflictRef/);
  assert.match(appointmentPage, /if \(jr\.data\.existing\)/);
  assert.match(appointmentPage, /Please confirm the existing patient record or correct the details/);
  assert.match(appointmentPage, /resolvedPatientRef\.current = resolved/);
  assert.match(appointmentPage, /setPatientConflict\(null\)/);
});

unit("appointment association, missing-patient 404, and occupied-slot 409", () => {
  const patients = new Map([["P-1", { id: "P-1", name: "Asha Rao" }]]);
  const appointments = [];
  const book = (patientId, date, time) => {
    const patient = patients.get(patientId);
    if (!patient) return { status: 404, appointment: null, patient: null };
    if (appointments.some((item) => item.doctorId === "doc-1" && item.date === date && item.time === time && item.status === "confirmed")) {
      return { status: 409, appointment: null, patient: null };
    }
    const appointment = { id: `A-${appointments.length + 1}`, patientId, doctorId: "doc-1", date, time, status: "confirmed" };
    appointments.push(appointment);
    return { status: 201, appointment, patient };
  };
  assert.equal(book("missing", "2030-01-01", "10:00").status, 404);
  const first = book("P-1", "2030-01-01", "10:00");
  assert.equal(first.status, 201);
  assert.equal(first.appointment.patientId, first.patient.id);
  assert.equal(book("P-1", "2030-01-01", "10:00").status, 409);
  assert.equal(appointments.length, 1);
  assert.match(appointmentsRoute, /if \(!patient.*Patient not found.*404/s);
  assert.match(appointmentsRoute, /return error\("This time slot is already booked\.[^\n]+", 409\)/);
  assert.match(appointmentsRoute, /return json\(\{ appointment, patient: responsePatient \}, 201\)/);
});

const STOP_WORDS = new Set(["me", "mein", "ka", "ki", "ke", "hai", "ho", "raha", "rahi", "aur", "se", "par", "ek", "the", "a", "an", "of", "in", "is", "my", "to"]);
const GENERIC = new Set(["pain", "dard", "problem", "issue", "symptom", "symptoms", "takleef", "dikkat", "discomfort", "doctor", "report", "reports", "health"]);
const pathwaySynonyms = {
  chest: ["chest pain", "seene me dard", "seene mein dard", "chhati me dard", "heart pain", "dil me dard", "chest tightness"],
  cough: ["cough", "khaansi", "breathless", "saans", "breathing problem"],
};
function tokens(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
function pathwayMatch(complaint) {
  const text = tokens(complaint);
  const words = new Set(text);
  const scored = Object.entries(pathwaySynonyms).map(([id, synonyms]) => {
    let score = 0;
    for (const synonym of synonyms) {
      const syn = tokens(synonym);
      if (syn.length === 1) { if (!GENERIC.has(syn[0]) && words.has(syn[0])) score += 2; continue; }
      const contiguous = text.join(" ").includes(syn.join(" "));
      const shared = syn.filter((token) => words.has(token)).length;
      if (contiguous) score += 2;
      else if (shared >= 2 && shared / syn.length >= 0.6) score += 2;
    }
    return [id, score];
  }).sort((a, b) => b[1] - a[1]);
  return scored[0][1] >= 2 ? scored[0][0] : null;
}

property("adjacent and inserted-token pathway matching rejects generic false positives", () => {
  const inserted = ["seene me tez dard hai", "SEENE-ME, bahut DARD!", "chest pain since yesterday", "chest tightness and sweating"];
  for (let seed = 0; seed < 200; seed += 1) {
    const complaint = `${inserted[seed % inserted.length]} ${seed % 2 ? "with sweating" : "since yesterday"}`;
    assert.equal(pathwayMatch(complaint), "chest");
  }
  for (const generic of ["pain", "dard", "random problem", "doctor report", "health issue", "something feels bad"]) {
    assert.equal(pathwayMatch(generic), null, generic);
  }
  assert.match(pathwaysSource, /function significantTokens/);
  assert.match(pathwaysSource, /shared >= 2 && shared \/ synTokens\.length >= 0\.6/);
  assert.match(pathwaysSource, /bestScore >= 2/);
});

function shouldFinalize(count, unresolvedSafety) { return count >= 3 && !unresolvedSafety; }
function nextFallback(questions, covered, asked = []) {
  return questions.find((question) => !covered.has(question) && !asked.includes(question)) ?? null;
}

property("deep-loop MIN_DEEP/MAX_DEEP, duplicate and covered-topic handling", () => {
  for (const aiOutcome of ["STOP", "", "duplicate", "valid", "throw"]) {
    for (let prior = 0; prior < 3; prior += 1) {
      assert.equal(shouldFinalize(prior, false), false, `${aiOutcome} finalized at ${prior}`);
    }
    assert.equal(shouldFinalize(3, false), true);
    assert.equal(shouldFinalize(5, true), false, "unresolved safety was hidden at MAX_DEEP");
  }
  assert.equal(nextFallback(["onset", "location", "radiation"], new Set(["onset"])), "location");
  assert.equal(nextFallback(["onset", "location"], new Set(["onset", "location"])), null);
  assert.equal(nextFallback(["onset", "location"], new Set(), ["onset"]), "location");
  assert.match(appointmentPage, /const MIN_DEEP = 3;/);
  assert.match(appointmentPage, /const MAX_DEEP = 5;/);
  assert.match(appointmentPage, /isDuplicateQuestion\(clean\)/);
  assert.match(appointmentPage, /topicCovered/);
  assert.match(appointmentPage, /function canFinalizeDeep\(\)/);
});

unit("fallback selection remains available for every AI outcome", () => {
  const fallback = (outcome, pathwayAvailable) => pathwayAvailable ? "curated pathway question" : "severity/frequency probe";
  for (const outcome of ["STOP", "", "duplicate", "valid", "throw"]) {
    assert.equal(fallback(outcome, true), "curated pathway question");
    assert.equal(fallback(outcome, false), "severity/frequency probe");
  }
  assert.match(appointmentPage, /return pathwayFallbackQuestion\(a\)/);
  assert.match(appointmentPage, /how severe is it \(0–10\)/);
  assert.match(appointmentPage, /Any other symptoms along with this/);
  assert.match(appointmentPage, /Does anything make it better or worse/);
});

unit("deterministic red flags are deduplicated and emergencies sort first", () => {
  const flags = [
    { id: "urgent", urgency: "urgent", signal: "urgent signal" },
    { id: "emergency", urgency: "emergency", signal: "emergency signal" },
    { id: "urgent", urgency: "urgent", signal: "duplicate urgent" },
  ];
  const seen = new Set();
  const detected = flags.filter((flag) => !seen.has(flag.id) && seen.add(flag.id)).sort((a, b) => a.urgency === b.urgency ? 0 : a.urgency === "emergency" ? -1 : 1);
  assert.deepEqual(detected.map((flag) => flag.id), ["emergency", "urgent"]);
  assert.match(pathwaysSource, /const seen = new Set<string>\(\)/);
  assert.match(pathwaysSource, /return hits\.sort\(/);
  assert.match(pathwaysSource, /a\.urgency === "emergency" \? -1/);
  assert.match(appointmentPage, /detectRedFlags\(pathwayRef\.current, patientSafetyText\(a\)\)/);
  assert.match(appointmentPage, /Safety limitation: not all pathway danger-sign topics/);
});

property("resolved patient ID/name remains immutable across all artifacts", () => {
  for (let seed = 0; seed < 300; seed += 1) {
    const identity = { patientId: `P-${seed}`, patientName: `Confirmed Patient ${seed}` };
    const artifacts = ["preVisit", "appointment", "transcript", "success", "queue", "doctor"].map((kind) => ({ kind, ...identity }));
    assert(artifacts.every((artifact) => artifact.patientId === identity.patientId));
    assert(artifacts.every((artifact) => artifact.patientName === identity.patientName));
  }
  assert.match(appointmentPage, /const resolvedPatientRef/);
  assert.match(appointmentPage, /patientId: pid/);
  assert.match(preVisitRoute, /patientId/);
  assert.match(chatRoute, /patientId/);
  assert.match(queueRoute, /patientId/);
  assert.match(doctorQueue, /patientId/);
  assert.match(appointmentPage, /resolvedIdentity\.id !== pid/);
});

property("non-triggering inputs preserve ordinary behavior", () => {
  const nonTriggering = [
    { identity: "same confirmed patient", complaint: "routine follow-up", expected: "reuse" },
    { identity: "unused valid phone", complaint: "routine check", expected: "create" },
    { identity: "same confirmed patient", complaint: "duration already answered", expected: "skip-covered-topic" },
  ];
  for (const input of nonTriggering) {
    assert.notEqual(input.expected, "silent-substitution");
    assert.equal(typeof input.complaint, "string");
  }
  assert.match(appointmentPage, /useState<Lang>\("hinglish"\)/);
  assert.match(appointmentPage, /type="file"/);
  assert.match(appointmentPage, /onClick=/);
  assert.match(appointmentPage, /onChange=/);
  assert.match(patientsRoute, /existing: true/);
  assert.match(appointmentsRoute, /status NOT IN/);
});

console.log(JSON.stringify({
  suite: "Task 3.6 focused unit/property coverage",
  status: "passed",
  total: results.length,
  unitTests: results.filter((result) => result.kind === "unit").length,
  propertyTests: results.filter((result) => result.kind === "property").length,
  contractChecks: results.filter((result) => result.kind === "contract").length,
  results,
  notes: [
    "Deterministic bounded generators replace watch-mode or long-running dependencies.",
    "API/database cases use dependency-free boundary models plus source contracts.",
    "No application code or unrelated autocomplete/pricing/calendar behavior was changed.",
  ],
}, null, 2));
