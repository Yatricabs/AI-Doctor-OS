import { addPatient, error, generateId, insert, json, listPatients, nowIso, pastDateError, queryOne, readObject, requiredString } from "../_lib/demo";

export const dynamic = "force-dynamic";

function phoneKey(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");

  const phone = requiredString(body.phone, "phone", 20);
  const preferredDate = requiredString(body.preferredDate, "preferredDate", 20);
  const preferredTime = requiredString(body.preferredTime, "preferredTime", 20);
  const chiefComplaint = requiredString(body.chiefComplaint, "chiefComplaint", 2000);
  if (!phone || phoneKey(phone).length !== 10 || !preferredDate || !preferredTime || !chiefComplaint) {
    return error("phone, appointment date/time, and chief complaint are required.");
  }
  const dateErr = pastDateError(preferredDate);
  if (dateErr) return error(dateErr);

  const allPatients = await listPatients();
  const matchingPatient = allPatients.find((patient) => patient.phone && phoneKey(patient.phone) === phoneKey(phone));
  const followUp = body.useExisting === true && Boolean(matchingPatient);

  let patient = matchingPatient;
  if (!followUp) {
    const name = requiredString(body.name, "name", 100);
    const age = requiredString(body.age, "age", 10);
    const sex = requiredString(body.sex, "sex", 40);
    const location = requiredString(body.location, "location", 200);
    if (!name || !age || !sex || !location) return error("name, age, SEX, and location are required for a new patient.");

    patient = {
      id: generateId("patient"),
      name,
      initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PT",
      appointment: `${preferredDate} ${preferredTime}`,
      status: "Waiting" as const,
      phone: phoneKey(phone),
      gender: sex,
      address: location,
      patientType: "new" as const,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await addPatient(patient);
  }
  if (!patient) return error("Existing patient record was not found.", 404);

  const doctorId = "user-doc-001";
  const clash = await queryOne<Record<string, unknown>>(
    "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status NOT IN ('cancelled','no_show')",
    [doctorId, preferredDate, preferredTime],
  );
  if (clash) return error("This appointment slot is already booked. Please choose another time.", 409);

  const qaLog = Array.isArray(body.qaLog) ? body.qaLog.slice(0, 15) : [];
  const semanticFacts = Array.isArray(body.semanticFacts) ? body.semanticFacts.slice(0, 80) : [];
  const documents = Array.isArray(body.documents) ? body.documents.slice(0, 20) : [];
  const previousPatientContext = body.previousPatientContext && typeof body.previousPatientContext === "object" ? body.previousPatientContext : null;
  const report = body.preVisitReport && typeof body.preVisitReport === "object" ? body.preVisitReport as Record<string, unknown> : null;
  const urgent = /chest pain|shortness of breath|breathless|severe bleeding|unconscious|fainting|stroke|seizure/i.test([chiefComplaint, ...qaLog.map((item) => JSON.stringify(item))].join(" "));
  const appointment = {
    id: generateId("appt"),
    patientId: patient.id,
    doctorId,
    clinicId: "clinic-001",
    visitType: followUp ? "follow_up" : "new_complaint",
    appointmentDate: preferredDate,
    appointmentTime: preferredTime,
    durationMinutes: 15,
    status: "confirmed",
    reason: chiefComplaint,
    channel: "web",
    notes: JSON.stringify({
      duration: body.duration ?? "",
      priorConsultation: body.priorConsultation ?? "",
      priorReports: body.priorReports ?? "",
      qaLog,
      semanticFacts,
      documents,
      previousPatientContext,
      aiLabel: "AI_GENERATED_CONSIDERATIONS_ONLY",
    }),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await insert("appointments", appointment);

  if (report) {
    await insert("pre_visit_briefs", {
      id: generateId("brief"), visitId: appointment.id, patientId: patient.id, visitReason: chiefComplaint,
      patientType: followUp ? "returning" : "new", historySummary: String(report.fullHistory ?? chiefComplaint),
      medicationSummary: "", whatChanged: String(report.problemSummary ?? chiefComplaint), missingInfo: "[]", attentionSignals: "[]",
      patientQuestions: JSON.stringify(qaLog), aiConsiderations: "[]", queueStatus: "Appointment confirmed", aiLabel: "AI_GENERATED",
      confidence: "moderate", sourceIds: JSON.stringify(["appointment_intake"]), reviewStatus: "generated",
      aiReport: JSON.stringify(report), createdAt: nowIso(),
    });
  }

  return json({ patient, appointment, urgent, preVisitReport: report }, 201);
}
