import { error, getPatientContext, json, query, queryOne } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return error("patientId is required");

  const context = getPatientContext(patientId);
  if (!context) return error("Patient not found", 404);

  // Enrich with visit history
  const visits = query<Record<string, unknown>>(
    "SELECT * FROM visits WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10",
    [patientId]
  );

  // Queue status
  const queueEntry = queryOne<Record<string, unknown>>(
    "SELECT * FROM queue_entries WHERE patient_id = ? AND status NOT IN ('completed','skipped') ORDER BY created_at DESC LIMIT 1",
    [patientId]
  );

  // Active appointments
  const upcomingAppointments = query<Record<string, unknown>>(
    "SELECT * FROM appointments WHERE patient_id = ? AND status IN ('confirmed','checked_in') ORDER BY appointment_date ASC, appointment_time ASC LIMIT 3",
    [patientId]
  );

  // Messages / communication
  const recentMessages = query<Record<string, unknown>>(
    "SELECT * FROM messages WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5",
    [patientId]
  );

  // Diagnostic orders
  const orders = query<Record<string, unknown>>(
    "SELECT * FROM diagnostic_orders WHERE patient_id = ? ORDER BY ordered_at DESC LIMIT 5",
    [patientId]
  );

  // Referrals
  const referrals = query<Record<string, unknown>>(
    "SELECT * FROM referrals WHERE patient_id = ? ORDER BY created_at DESC LIMIT 3",
    [patientId]
  );

  // Prescriptions
  const prescriptions = query<Record<string, unknown>>(
    "SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5",
    [patientId]
  );

  // Consent
  const consents = query<Record<string, unknown>>(
    "SELECT * FROM consents WHERE patient_id = ? ORDER BY created_at DESC",
    [patientId]
  );

  return json({
    ...context,
    visits,
    queueEntry,
    upcomingAppointments,
    recentMessages,
    orders,
    referrals,
    prescriptions,
    consents,
  });
}
