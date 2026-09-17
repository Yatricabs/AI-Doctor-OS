import { error, json, patientById, query, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return error("patientId is required.");
  const patient = await patientById(patientId);
  if (!patient) return error("Patient not found.", 404);
  const [appointments, reports, prescriptions, bills, followUps] = await Promise.all([
    query<Record<string, unknown>>("SELECT a.*, p.name AS patient_name FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM reports WHERE patient_id = ? ORDER BY date DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM bills WHERE patient_id = ? ORDER BY created_at DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM follow_ups WHERE patient_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 1", [patientId]),
  ]);
  return json({
    patient,
    appointments: appointments.map((a) => ({ ...a, date: a.appointmentDate, time: a.appointmentTime, visitType: a.visitType === "follow_up" ? "Follow-up" : "New", reason: a.reason ?? "", patientName: a.patientName ?? patient.name, channel: "Web", priority: "Routine", consultationFee: 0, queuePosition: 0, briefReady: false, briefSummary: "" })),
    reports,
    prescriptions: prescriptions.map((rx) => ({ ...rx, patientId, patientName: patient.name, medication: "", dosage: "", safetyFlags: [] })),
    billing: { transactions: bills.map((bill) => ({ id: bill.id, patientId, patientName: patient.name, type: "Consultation fee", description: "Appointment billing", amount: Number(bill.total) || 0, date: bill.createdAt ?? "", createdAt: bill.createdAt ?? "" })), total: bills.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0) },
    aiSummary: null,
    nextFollowUp: followUps[0] ? { date: String(followUps[0].dueDate ?? ""), time: String(followUps[0].dueTime ?? "") } : null,
  });
});

