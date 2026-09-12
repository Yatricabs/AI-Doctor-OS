import { error, getPatientContext, json, query, queryOne, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return error("patientId is required");

  const context = await getPatientContext(patientId);
  if (!context) return error("Patient not found", 404);

  const visits = await query<Record<string, unknown>>(
    "SELECT * FROM visits WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10",
    [patientId]
  );

  const queueEntry = await queryOne<Record<string, unknown>>(
    "SELECT * FROM queue_entries WHERE patient_id = ? AND status NOT IN ('completed','skipped') ORDER BY created_at DESC LIMIT 1",
    [patientId]
  );

  const upcomingAppointments = await query<Record<string, unknown>>(
    "SELECT * FROM appointments WHERE patient_id = ? AND status IN ('confirmed','checked_in') ORDER BY appointment_date ASC, appointment_time ASC LIMIT 3",
    [patientId]
  );

  const recentMessages = await query<Record<string, unknown>>(
    "SELECT * FROM messages WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5",
    [patientId]
  );

  const orders = await query<Record<string, unknown>>(
    "SELECT * FROM diagnostic_orders WHERE patient_id = ? ORDER BY ordered_at DESC LIMIT 5",
    [patientId]
  );

  const referrals = await query<Record<string, unknown>>(
    "SELECT * FROM referrals WHERE patient_id = ? ORDER BY created_at DESC LIMIT 3",
    [patientId]
  );

  const prescriptions = await query<Record<string, unknown>>(
    "SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5",
    [patientId]
  );

  const consents = await query<Record<string, unknown>>(
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
});
