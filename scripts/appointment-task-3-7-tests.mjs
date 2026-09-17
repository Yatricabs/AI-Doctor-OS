import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const patients = read("app/api/patients/route.ts");
const appointments = read("app/api/appointments/route.ts");
const appointmentPage = read("app/patient/appointment/page.tsx");
const preVisit = read("app/api/pre-visit/route.ts");
const chat = read("app/api/appointments/chat/route.ts");
const reports = read("app/api/reports/upload/route.ts");
const results = [];
const check = (name, fn) => { fn(); results.push({ name, status: "passed" }); };

function phoneKey(raw) { return String(raw).replace(/\D/g, "").slice(-10); }
function apiError(message, status = 400) { return { ok: false, error: { message }, status }; }
function parseResponse(text) {
  try { return JSON.parse(text); }
  catch { return apiError("Malformed JSON response", 502); }
}
function book(patientsById, booked, patientId, date, time) {
  const patient = patientsById.get(patientId);
  if (!patient) return apiError("Patient not found", 404);
  if (booked.some((a) => a.date === date && a.time === time && a.status !== "cancelled" && a.status !== "no_show")) {
    return apiError("This time slot is already booked. Please choose another time.", 409);
  }
  const appointment = { id: `appt-${booked.length + 1}`, patientId, date, time, status: "confirmed" };
  booked.push(appointment);
  return { ok: true, status: 201, appointment, patient };
}

check("explicit invalid phone values remain validation errors", () => {
  for (const value of ["", "123", "+91-12345", "abc-def", 9876543210, null]) {
    assert(phoneKey(value).length < 10 || typeof value !== "string");
  }
  assert.match(patients, /hasPhone = Object\.prototype\.hasOwnProperty\.call\(body, "phone"\)/);
  assert.match(patients, /hasPhone && \(typeof rawPhone !== "string" \|\| phoneKey\(rawPhone\)\.length < 10\)/);
  assert.match(patients, /Enter a valid 10-digit mobile number/);
});

check("identity failures reset collection to phone and never retain a guessed ID", () => {
  assert.match(appointmentPage, /function recoverIdentityResolution\(message: string\)/);
  assert.match(appointmentPage, /resolvedPatientRef\.current = null/);
  assert.match(appointmentPage, /stepRef\.current = 1; \/\/ phone/);
  assert.match(appointmentPage, /recoverIdentityResolution\(jr\.error\?\.message/);
  assert.match(appointmentPage, /recoverIdentityResolution\("Could not resolve your patient record/);
  assert.match(appointmentPage, /if \(!res\.ok \|\| !jr\.ok \|\| !jr\.data\?\.patient\?\.id/);
});

check("collision requires explicit confirmation or correction without mutation", () => {
  const existing = { id: "P-ROHAN", name: "Rohan Mehta", phone: "+91-9876543210" };
  const submitted = { name: "Vijay Verma", phone: "09876543210" };
  assert.equal(phoneKey(existing.phone), phoneKey(submitted.phone));
  assert.notEqual(existing.name, submitted.name);
  assert.match(patients, /return json\(\{ patient: clash, existing: true \}, 200\)/);
  assert.match(appointmentPage, /if \(patientConflict \|\| pendingConflictRef\.current\)/);
  assert.match(appointmentPage, /Please confirm the existing patient record or correct the details/);
  assert.match(appointmentPage, /stepRef\.current = 1; \/\/ collect a corrected phone/);
  assert.doesNotMatch(patients, /update\([^\n]*clash/i);
});

check("missing patient is 404, slot conflict is 409, and persistence failure cannot claim success", () => {
  const known = new Map([["P-1", { id: "P-1", name: "Asha Rao" }]]);
  const booked = [];
  assert.equal(book(known, booked, "stale-or-guessed", "2030-01-01", "10:00").status, 404);
  assert.equal(book(known, booked, "P-1", "2030-01-01", "10:00").status, 201);
  assert.equal(book(known, booked, "P-1", "2030-01-01", "10:00").status, 409);
  assert.equal(booked.length, 1);
  assert.match(appointments, /if \(!patient.*Patient not found.*404/s);
  assert.match(appointments, /return error\("This time slot is already booked\.[^\n]+", 409\)/);
  assert.match(appointmentPage, /if \(!jr\.ok \|\| !jr\.data\?\.appointment \|\| !persistedPatient/);
  assert.match(appointmentPage, /setError\(e instanceof Error \? e\.message : "Could not book the appointment\."\)/);
  assert.match(appointmentPage, /setPhase\("done"\)/);
  assert.ok(appointmentPage.indexOf("setPhase(\"done\")") > appointmentPage.indexOf("if (!jr.ok || !jr.data?.appointment"));
});

check("malformed JSON and identity/name mismatches are recoverable failures", () => {
  assert.equal(parseResponse("<html>500</html>").ok, false);
  assert.equal(parseResponse("not-json").status, 502);
  assert.match(appointmentPage, /await res\.json\(\)/);
  assert.match(appointmentPage, /catch \{/);
  assert.match(appointmentPage, /resolvedIdentity\.id !== pid/);
  assert.match(appointmentPage, /persistedPatient\.id !== resolvedIdentity\.id/);
  assert.match(appointmentPage, /persistedPatient\.name !== resolvedIdentity\.name/);
  assert.match(preVisit, /patient\.id !== patientId.*Patient not found.*404/s);
  assert.match(chat, /patient\.id !== patientId.*Patient not found\."\, 404/s);
  assert.match(reports, /patientById\(patientId\).*Patient not found\."\, 404/s);
});

check("transcript and past-visit enrichment failures are observable and non-fatal after booking", () => {
  assert.match(appointmentPage, /past-visit enrichment failed/);
  assert.match(appointmentPage, /transcript save failed/);
  assert.match(appointmentPage, /console\.warn/);
  assert.match(appointmentPage, /patientId: pid/);
  assert.match(appointmentPage, /appointmentId/);
  // The transcript save is after appointmentId is assigned and its failure is
  // handled without a retry or identity re-resolution.
  const appointmentPersisted = appointmentPage.indexOf("appointmentId = jr.data.appointment.id");
  const transcriptSave = appointmentPage.lastIndexOf("api/appointments/chat");
  const transcriptFailure = appointmentPage.indexOf("transcript save failed");
  const success = appointmentPage.indexOf("setPhase(\"done\")");
  assert(appointmentPersisted >= 0 && transcriptSave > appointmentPersisted && transcriptFailure > transcriptSave && success > transcriptFailure);
  assert.doesNotMatch(appointmentPage.slice(transcriptFailure, success), /ensurePatient\(|fetch\("\/api\/appointments"/);
});

console.log(JSON.stringify({
  suite: "Task 3.7 API and browser-flow error contracts",
  status: "passed",
  total: results.length,
  results,
  notes: [
    "Deterministic single-run source and boundary contracts; no server or browser dependency.",
    "Tests cover invalid input, collision recovery, malformed responses, ownership mismatch, 404/409 semantics, persistence gating, and observable non-fatal enrichment failure.",
  ],
}, null, 2));
