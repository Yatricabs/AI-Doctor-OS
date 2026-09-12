import { getMorningBrief, json, query, queryOne, safeRoute } from "../../../api/_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async () => {
  const brief = await getMorningBrief();
  const today = new Date().toISOString().slice(0, 10);

  // Enrich metrics into a dashboard-friendly format
  const metricMap: Record<string, number> = {};
  for (const m of brief.metrics) {
    metricMap[m.metricType] = m.metricValue;
  }

  const stats = [
    { label: "Patients today", value: String(brief.appointments.length), detail: `${brief.appointments.filter((a) => a.status === "completed").length} completed` },
    { label: "Pending inbox", value: String(brief.pendingInbox.length), detail: `${brief.pendingInbox.filter((i) => i.priority === "urgent").length} urgent` },
    { label: "Overdue follow-ups", value: String(brief.overdueFollowUps.length), detail: brief.overdueFollowUps.length > 0 ? "Needs attention" : "All on track" },
    { label: "Notes pending", value: String(brief.pendingNotes.length), detail: "Draft notes to approve" },
  ];

  const urgentItems = [
    ...brief.pendingInbox.filter((i) => i.priority === "urgent"),
    ...brief.overdueFollowUps.filter((f) => f.priority === "urgent"),
  ];

  const queueSummary = await query<Record<string, unknown>>(
    "SELECT COUNT(*) as n, status FROM queue_entries WHERE clinic_id = 'clinic-001' AND created_at::date = ?::date GROUP BY status",
    [today]
  );

  const nextAppointment = brief.appointments.find(
    (a) => a.status === "confirmed" || a.status === "checked_in"
  );

  const nextPatient = nextAppointment
    ? await queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [nextAppointment.patientId])
    : null;

  const summary = brief.overdueFollowUps.length > 0
    ? `${brief.overdueFollowUps.length} overdue follow-up${brief.overdueFollowUps.length > 1 ? "s" : ""} need attention. `
    : "";
  const urgentSummary = urgentItems.length > 0
    ? `${urgentItems.length} urgent item${urgentItems.length > 1 ? "s" : ""} in inbox. `
    : "";
  const notesSummary = brief.pendingNotes.length > 0
    ? `${brief.pendingNotes.length} draft note${brief.pendingNotes.length > 1 ? "s" : ""} awaiting approval.`
    : "All notes are approved.";

  return json({
    date: today,
    stats,
    appointments: brief.appointments,
    nextAppointment,
    nextPatient,
    urgentItems,
    pendingInbox: brief.pendingInbox,
    overdueFollowUps: brief.overdueFollowUps,
    pendingNotes: brief.pendingNotes,
    queueSummary,
    clinicalBrief: `${summary}${urgentSummary}${notesSummary}`,
    metrics: metricMap,
  });
});
