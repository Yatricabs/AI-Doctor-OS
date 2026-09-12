import { json, query, queryOne, safeRoute } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "today";
  const today = new Date().toISOString().slice(0, 10);

  // Date range
  let dateFilter = "metric_date = ?";
  let dateParam: string = today;
  if (range === "week") {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    dateFilter = "metric_date >= ?";
    dateParam = weekAgo;
  } else if (range === "month") {
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    dateFilter = "metric_date >= ?";
    dateParam = monthAgo;
  }

  const metrics = await query<Record<string, unknown>>(
    `SELECT * FROM workflow_metrics WHERE ${dateFilter} ORDER BY metric_date DESC, metric_type ASC`,
    [dateParam]
  );

  // Small helper: run a COUNT query and return the number. Postgres returns COUNT()
  // as a string, so coerce with Number() to keep the response numeric.
  const countOf = async (sql: string, params: unknown[] = []) =>
    Number((await queryOne<{ n: number | string }>(sql, params))?.n ?? 0);

  // Patient stats
  const totalPatients = await countOf("SELECT COUNT(*) as n FROM patients");
  const newToday = await countOf("SELECT COUNT(*) as n FROM patients WHERE created_at::date = ?::date", [today]);
  const totalAppointments = await countOf("SELECT COUNT(*) as n FROM appointments WHERE appointment_date = ?", [today]);
  const completedAppointments = await countOf("SELECT COUNT(*) as n FROM appointments WHERE appointment_date = ? AND status = 'completed'", [today]);

  // Queue stats
  const queueStats = await query<Record<string, unknown>>(
    "SELECT status, COUNT(*) as count FROM queue_entries WHERE created_at::date = ?::date GROUP BY status",
    [today]
  );

  // Follow-up stats
  const pendingFollowUps = await countOf("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'pending'");
  const overdueFollowUps = await countOf("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'pending' AND due_date < ?", [today]);
  const completedFollowUps = await countOf("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'completed' AND completed_at::date = ?::date", [today]);

  // Inbox stats
  const openInbox = await countOf("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'open'");
  const urgentInbox = await countOf("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'open' AND priority = 'urgent'");
  const resolvedToday = await countOf("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'resolved' AND resolved_at::date = ?::date", [today]);

  // Prescription safety stats
  const prescriptionsToday = await countOf("SELECT COUNT(*) as n FROM prescriptions WHERE created_at::date = ?::date", [today]);
  const signedToday = await countOf("SELECT COUNT(*) as n FROM prescriptions WHERE signed_at::date = ?::date", [today]);
  const safetyAlertsToday = await countOf("SELECT COUNT(*) as n FROM safety_checks WHERE created_at::date = ?::date", [today]);
  const overriddenAlerts = await countOf("SELECT COUNT(*) as n FROM safety_checks WHERE created_at::date = ?::date AND is_overridden = 1", [today]);

  // Scribe / notes
  const draftNotes = await countOf("SELECT COUNT(*) as n FROM scribe_notes WHERE status = 'draft'");
  const approvedNotesToday = await countOf("SELECT COUNT(*) as n FROM scribe_notes WHERE status = 'approved' AND updated_at::date = ?::date", [today]);

  // Referrals
  const pendingReferrals = await countOf("SELECT COUNT(*) as n FROM referrals WHERE status = 'pending'");
  const referralsBySpecialty = await query<Record<string, unknown>>(
    "SELECT referred_to_specialty as specialty, COUNT(*) as count FROM referrals GROUP BY referred_to_specialty ORDER BY count DESC LIMIT 5"
  );

  // AI output stats
  const aiOutputStats = await query<Record<string, unknown>>(
    "SELECT status, COUNT(*) as count FROM ai_outputs GROUP BY status"
  );

  // Messages
  const messagesSentToday = await countOf("SELECT COUNT(*) as n FROM messages WHERE direction = 'outbound' AND sent_at::date = ?::date", [today]);
  const inboundMessages = await countOf("SELECT COUNT(*) as n FROM messages WHERE direction = 'inbound' AND created_at::date = ?::date", [today]);

  // Metric map for charts
  const metricMap: Record<string, number[]> = {};
  for (const m of metrics) {
    const key = String(m.metricType);
    if (!metricMap[key]) metricMap[key] = [];
    metricMap[key].push(Number(m.metricValue));
  }

  const avgMetric = (key: string) => {
    const vals = metricMap[key];
    if (!vals || vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  return json({
    range,
    date: today,
    summary: {
      totalPatients,
      newToday,
      totalAppointments,
      completedAppointments,
      appointmentCompletionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
    },
    queue: {
      stats: queueStats,
      avgWaitMinutes: avgMetric("avg_wait_minutes"),
    },
    followUps: {
      pending: pendingFollowUps,
      overdue: overdueFollowUps,
      completedToday: completedFollowUps,
      completionRate: pendingFollowUps + completedFollowUps > 0
        ? Math.round((completedFollowUps / (pendingFollowUps + completedFollowUps)) * 100)
        : 0,
    },
    inbox: {
      open: openInbox,
      urgent: urgentInbox,
      resolvedToday,
    },
    prescriptions: {
      today: prescriptionsToday,
      signed: signedToday,
      safetyAlerts: safetyAlertsToday,
      overridden: overriddenAlerts,
      alertReviewRate: safetyAlertsToday > 0
        ? Math.round(((safetyAlertsToday - overriddenAlerts) / safetyAlertsToday) * 100)
        : 100,
    },
    notes: {
      draft: draftNotes,
      approvedToday: approvedNotesToday,
      aiAcceptanceRate: avgMetric("ai_acceptance_rate"),
      timeSaved: avgMetric("time_saved_minutes") || 134,
    },
    referrals: {
      pending: pendingReferrals,
      bySpecialty: referralsBySpecialty,
    },
    aiQuality: {
      outputs: aiOutputStats,
    },
    communications: {
      sentToday: messagesSentToday,
      receivedToday: inboundMessages,
    },
    rawMetrics: metrics,
  });
});
