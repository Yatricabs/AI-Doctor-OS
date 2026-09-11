import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId") ?? "user-doc-001";
  const status = searchParams.get("status");

  let sql = "SELECT a.*, p.name as patient_name, p.initials as patient_initials, p.phone as patient_phone FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE 1=1";
  const params: unknown[] = [];

  if (patientId) { sql += " AND a.patient_id = ?"; params.push(patientId); }
  if (date) { sql += " AND a.appointment_date = ?"; params.push(date); }
  if (doctorId) { sql += " AND a.doctor_id = ?"; params.push(doctorId); }
  if (status) { sql += " AND a.status = ?"; params.push(status); }
  sql += " ORDER BY a.appointment_date ASC, a.appointment_time ASC";

  const appointments = query<Record<string, unknown>>(sql, params);
  return json({ appointments, total: appointments.length });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const patientId = requiredString(body.patientId, "patientId");
  const appointmentDate = requiredString(body.appointmentDate, "appointmentDate");
  const appointmentTime = requiredString(body.appointmentTime, "appointmentTime");
  const visitType = requiredString(body.visitType, "visitType") ?? "new_complaint";

  if (!patientId) return error("patientId is required");
  if (!appointmentDate) return error("appointmentDate is required");
  if (!appointmentTime) return error("appointmentTime is required");

  // Check patient exists
  const patient = queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
  if (!patient) return error("Patient not found", 404);

  // Check slot availability (simple check — no overlap)
  const clash = queryOne<Record<string, unknown>>(
    "SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status NOT IN ('cancelled','no_show')",
    [body.doctorId ?? "user-doc-001", appointmentDate, appointmentTime]
  );
  if (clash) return error("This time slot is already booked. Please choose another time.", 409);

  const appointment = {
    id: generateId("appt"),
    patientId,
    doctorId: typeof body.doctorId === "string" ? body.doctorId : "user-doc-001",
    clinicId: typeof body.clinicId === "string" ? body.clinicId : "clinic-001",
    department: typeof body.department === "string" ? body.department : null,
    visitType,
    appointmentDate,
    appointmentTime,
    durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : 15,
    status: "confirmed",
    reason: typeof body.reason === "string" ? body.reason : null,
    channel: typeof body.channel === "string" ? body.channel : "web",
    notes: typeof body.notes === "string" ? body.notes : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  insert("appointments", appointment);
  return json({ appointment, patient }, 201);
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const appointmentId = requiredString(body.appointmentId, "appointmentId");
  if (!appointmentId) return error("appointmentId is required");

  const existing = queryOne<Record<string, unknown>>("SELECT * FROM appointments WHERE id = ?", [appointmentId]);
  if (!existing) return error("Appointment not found", 404);

  const updates: Record<string, unknown> = { updatedAt: nowIso() };
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.appointmentDate === "string") updates.appointmentDate = body.appointmentDate;
  if (typeof body.appointmentTime === "string") updates.appointmentTime = body.appointmentTime;
  if (typeof body.reason === "string") updates.reason = body.reason;
  if (typeof body.notes === "string") updates.notes = body.notes;

  update("appointments", appointmentId, updates);
  const updated = queryOne<Record<string, unknown>>("SELECT * FROM appointments WHERE id = ?", [appointmentId]);
  return json({ appointment: updated });
}
