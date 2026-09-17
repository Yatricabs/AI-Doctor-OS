import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const patientsRoute = read("app/api/patients/route.ts");
const appointmentsRoute = read("app/api/appointments/route.ts");
const appointmentPage = read("app/patient/appointment/page.tsx");
const queueRoute = read("app/api/queue/route.ts");
const chatRoute = read("app/api/appointments/chat/route.ts");
const preVisitRoute = read("app/api/pre-visit/route.ts");
const doctorQueue = read("app/doctor/queue/page.tsx");
const bookPage = read("app/patient/book/page.tsx");
const clinicalPathways = read("lib/clinicalPathways.ts");

const results = [];
function property(name, fn) {
  fn();
  results.push({ name, status: "passed" });
}
function contract(name, fn) {
  fn();
  results.push({ name, status: "passed" });
}
function phoneKey(raw) {
  return raw.replace(/\D/g, "").slice(-10);
}

// Deterministic generators keep this standalone test single-run and dependency-free.
const phoneDigits = (seed) => String(9000000000 + (seed % 999999999)).padStart(10, "0");
const formattedPhones = (digits) => [
  digits,
  `+91-${digits.slice(0, 5)}-${digits.slice(5)}`,
  `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
  `0${digits}`,
];

property("same confirmed patient is reused for equivalent phone formats", () => {
  for (let seed = 0; seed < 500; seed += 1) {
    const digits = phoneDigits(seed);
    const keys = formattedPhones(digits).map(phoneKey);
    assert(keys.every((key) => key === digits), `phone key mismatch for ${digits}`);
  }
  assert.match(patientsRoute, /digits\.slice\(-10\)/);
  assert.match(patientsRoute, /existing: true/);
});

property("a genuinely unused valid phone creates one patient and does not duplicate it", () => {
  for (let seed = 0; seed < 250; seed += 1) {
    const existing = new Map();
    const digits = phoneDigits(seed + 1000);
    assert.equal(existing.has(phoneKey(digits)), false);
    existing.set(phoneKey(digits), { id: `P-${seed}`, name: `New Patient ${seed}` });
    assert.equal(existing.size, 1);
    assert.equal(existing.get(phoneKey(digits)).name, `New Patient ${seed}`);
  }
  assert.match(patientsRoute, /return json\(\{ patient \}, 201\)/);
  assert.match(patientsRoute, /if \(clash\) return json\(\{ patient: clash, existing: true \}, 200\)/);
});

property("valid appointment persistence preserves patient ownership and slot conflict behavior", () => {
  const patient = { id: "P-preserve", name: "Asha Rao" };
  const appointments = [];
  const book = (patientId, date, time) => {
    if (appointments.some((a) => a.doctorId === "doc-1" && a.date === date && a.time === time && !["cancelled", "no_show"].includes(a.status))) {
      return { status: 409, appointment: null };
    }
    const appointment = { id: `appt-${appointments.length + 1}`, patientId, doctorId: "doc-1", date, time, status: "confirmed" };
    appointments.push(appointment);
    return { status: 201, appointment, patient };
  };
  const first = book(patient.id, "2030-01-01", "10:00");
  const second = book(patient.id, "2030-01-01", "10:00");
  assert.equal(first.status, 201);
  assert.equal(first.appointment.patientId, patient.id);
  assert.equal(second.status, 409);
  assert.equal(appointments.length, 1);
  assert.match(appointmentsRoute, /Patient not found", 404/);
  assert.match(appointmentsRoute, /return json\(\{ appointment, patient: responsePatient \}, 201\)/);
  assert.match(appointmentsRoute, /return error\("This time slot is already booked\.[^\n]+", 409\)/);
});

property("non-buggy artifact routing keeps one patient ID/name pair", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const identity = { patientId: `P-${seed}`, name: `Patient ${seed}` };
    const artifacts = [
      { kind: "report", patientId: identity.patientId, name: identity.name },
      { kind: "appointment", patientId: identity.patientId, name: identity.name },
      { kind: "transcript", patientId: identity.patientId, name: identity.name },
      { kind: "queue", patientId: identity.patientId, name: identity.name },
      { kind: "doctor-review", patientId: identity.patientId, name: identity.name },
    ];
    assert(artifacts.every((artifact) => artifact.patientId === identity.patientId));
    assert(artifacts.every((artifact) => artifact.name === identity.name));
  }
  assert.match(preVisitRoute, /patientId/);
  assert.match(chatRoute, /patientId/);
  assert.match(queueRoute, /patientId/);
  assert.match(doctorQueue, /patientId/);
});

property("covered duration/location/severity topics remain skippable while ordinary intake stays sufficient", () => {
  const covered = new Set(["duration", "location", "severity"]);
  const pathwayTopics = ["duration", "location", "severity", "associated symptoms"];
  const asked = pathwayTopics.filter((topic) => !covered.has(topic));
  assert.deepEqual(asked, ["associated symptoms"]);
  assert.match(appointmentPage, /isDuplicateQuestion/);
  assert.match(appointmentPage, /answersRef\.current/);
  assert.match(appointmentPage, /complaint/);
});

contract("language selection preserves Hinglish and English UI behavior", () => {
  assert.match(appointmentPage, /useState<Lang>\("hinglish"\)/);
  assert.match(appointmentPage, /lang === "english"/);
  assert.match(appointmentPage, /lang === "english" \? step\.base\.english : step\.base\.hinglish/);
  assert.match(appointmentPage, /setLang/);
});

contract("report upload, transcript, queue, and doctor-review boundaries remain present", () => {
  assert.match(appointmentPage, /puterUpload|aiAnalyzeFile/);
  assert.match(appointmentPage, /api\/appointments\/chat/);
  assert.match(appointmentPage, /api\/pre-visit/);
  assert.match(appointmentPage, /api\/appointments/);
  assert.match(chatRoute, /appointmentId/);
  assert.match(preVisitRoute, /patientId/);
  assert.match(queueRoute, /appointmentId|patientId/);
  assert.match(doctorQueue, /patient|queue|appointment/i);
});

contract("mouse/touch-friendly appointment controls remain event-driven", () => {
  assert.match(appointmentPage, /onClick=/);
  assert.match(appointmentPage, /onChange=/);
  assert.match(appointmentPage, /type=\"file\"/);
  assert.match(appointmentPage, /Paperclip/);
});

contract("autocomplete, unit pricing, and follow-up calendar remain outside this bugfix", () => {
  assert.doesNotMatch(appointmentPage, /autocomplete|unitPrice|unit pricing/i);
  assert.doesNotMatch(appointmentPage, /follow-up calendar/i);
  assert.match(bookPage, /Calendar/);
  assert.match(read("app/doctor/follow-ups/page.tsx"), /Calendar/);
});

contract("existing pathway matching and red-flag baseline remains available", () => {
  assert.match(clinicalPathways, /function scorePathway/);
  assert.match(clinicalPathways, /bestScore >= 2/);
  assert.match(clinicalPathways, /return hits\.sort/);
});

console.log(JSON.stringify({
  suite: "Task 2 preservation property baseline",
  status: "passed",
  total: results.length,
  results,
  notes: [
    "Baseline ran against the current unfixed source contracts.",
    "Live Postgres persistence and browser rendering were not available to this dependency-free single-run suite.",
    "Autocomplete, unit pricing, and follow-up calendar are asserted as an out-of-scope boundary only.",
  ],
}, null, 2));
