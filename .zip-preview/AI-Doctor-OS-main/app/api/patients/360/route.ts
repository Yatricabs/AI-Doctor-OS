import { Appointment, BillingTransaction, Prescription, Report, appointments, billingTransactions, error, json, patientById, prescriptions, reports } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return error("patientId query parameter is required.");
  const patient = patientById(patientId);
  if (!patient) return error("Patient not found.", 404);

  const patientAppointments = (appointments as unknown as Appointment[]).filter((a) => a.patientId === patientId).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const patientReports = (reports as unknown as Report[]).filter((r) => r.patientId === patientId);
  const patientPrescriptions = (prescriptions as unknown as Prescription[]).filter((p) => p.patientId === patientId);
  const patientBilling = (billingTransactions as unknown as BillingTransaction[]).filter((b) => b.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalBilled = patientBilling.reduce((sum, tx) => sum + tx.amount, 0);
  const lastAppointment = patientAppointments[0];
  const nextFollowUp = patientAppointments.find((a) => a.status === "Scheduled" && a.visitType === "Follow-up");

  return json({
    patient,
    appointments: patientAppointments,
    reports: patientReports,
    prescriptions: patientPrescriptions,
    billing: { transactions: patientBilling, total: totalBilled },
    aiSummary: lastAppointment?.preVisitReport ?? null,
    nextFollowUp: nextFollowUp ? { date: nextFollowUp.date, time: nextFollowUp.time } : null,
  });
}
