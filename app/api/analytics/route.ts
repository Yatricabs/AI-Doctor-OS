import { json, query, queryOne } from "../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const metrics = query<Record<string, unknown>>(`SELECT * FROM workflow_metrics WHERE ${dateFilter} ORDER BY metric_date DESC, metric_type ASC`, [dateParam]);

  // Patient stats
  const totalPatients = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM patients", [])?. n ?? 0;
  const newToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM patients WHERE DATE(created_at) = ?", [today])?.n ?? 0;
  const totalAppointments = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM appointments WHERE appointment_date = ?", [today])?.n ?? 0;
  const completedAppointments = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM appointments WHERE appointment_date = ? AND status = 'completed'", [today])?.n ?? 0;

  // Queue stats
  const queueStats = query<Record<string, unknown>>(
    "SELECT status, COUNT(*) as count FROM queue_entries WHERE DATE(created_at) = ? GROUP BY status",
    [today]
  );

  // Follow-up stats
  const pendingFollowUps = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'pending'", [])?.n ?? 0;
  const overdueFollowUps = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'pending' AND due_date < ?", [today])?.n ?? 0;
  const completedFollowUps = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'completed' AND DATE(completed_at) = ?", [today])?.n ?? 0;

  // Inbox stats
  const openInbox = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'open'", [])?.n ?? 0;
  const urgentInbox = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'open' AND priority = 'urgent'", [])?.n ?? 0;
  const resolvedToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM inbox_items WHERE status = 'resolved' AND DATE(resolved_at) = ?", [today])?.n ?? 0;

  // Prescription safety stats
  const prescriptionsToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM prescriptions WHERE DATE(created_at) = ?", [today])?.n ?? 0;
  const signedToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM prescriptions WHERE DATE(signed_at) = ?", [today])?.n ?? 0;
  const safetyAlertsToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM safety_checks WHERE DATE(created_at) = ?", [today])?.n ?? 0;
  const overriddenAlerts = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM safety_checks WHERE DATE(created_at) = ? AND is_overridden = 1", [today])?.n ?? 0;

  // Scribe / notes
  const draftNotes = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM scribe_notes WHERE status = 'draft'", [])?.n ?? 0;
  const approvedNotesToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM scribe_notes WHERE status = 'approved' AND DATE(updated_at) = ?", [today])?.n ?? 0;

  // Referrals
  const pendingReferrals = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM referrals WHERE status = 'pending'", [])?.n ?? 0;
  const referralsBySpecialty = query<Record<string, unknown>>(
    "SELECT referred_to_specialty as specialty, COUNT(*) as count FROM referrals GROUP BY referred_to_specialty ORDER BY count DESC LIMIT 5",
    []
  );

  // AI output stats
  const aiOutputStats = query<Record<string, unknown>>(
    "SELECT status, COUNT(*) as count FROM ai_outputs GROUP BY status",
    []
  );

  // Messages
  const messagesSentToday = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM messages WHERE direction = 'outbound' AND DATE(sent_at) = ?", [today])?.n ?? 0;
  const inboundMessages = queryOne<{ n: number }>("SELECT COUNT(*) as n FROM messages WHERE direction = 'inbound' AND DATE(created_at) = ?", [today])?.n ?? 0;

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
      timeSaved: avgMetric("time_saved_minutes") || 134, // 2h14m default
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
}
