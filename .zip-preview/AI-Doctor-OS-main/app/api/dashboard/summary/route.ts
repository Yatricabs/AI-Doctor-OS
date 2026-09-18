import { Appointment, BillingTransaction, Medicine, appointments, billingTransactions, inboxItems, json, medicines, patients } from "../../_lib/demo";

export const dynamic = "force-dynamic";

const TIME_ESTIMATE_MIN: Record<Appointment["visitType"], number> = { New: 20, "Follow-up": 10 };

export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const todays = (appointments as unknown as Appointment[]).filter((appt) => appt.date === date);
  const newCount = todays.filter((a) => a.visitType === "New").length;
  const followUpCount = todays.filter((a) => a.visitType === "Follow-up").length;
  const urgentCount = todays.filter((a) => a.priority === "Urgent").length;
  const estimatedMinutes = todays.reduce((sum, a) => sum + (TIME_ESTIMATE_MIN[a.visitType] ?? 15), 0);

  const revenueToday = (billingTransactions as unknown as BillingTransaction[]).filter((tx) => tx.date === date).reduce((sum, tx) => sum + tx.amount, 0);
  const revenueByType = (["Consultation fee", "Medicine", "Test", "Scan", "Procedure"] as const).map((type) => ({
    type,
    amount: (billingTransactions as unknown as BillingTransaction[]).filter((tx) => tx.date === date && tx.type === type).reduce((sum, tx) => sum + tx.amount, 0),
  }));

  const lowStock = (medicines as unknown as Medicine[]).filter((m) => m.status !== "In stock");
  const openAlerts = inboxItems.filter((item) => item.status === "open");

  return json({
    summary: {
      date,
      appointments: { total: todays.length, new: newCount, followUp: followUpCount, urgent: urgentCount, estimatedMinutes },
      revenue: { today: revenueToday, byType: revenueByType },
      patients: { total: patients.length },
      inventory: { lowStockCount: lowStock.length, lowStock: lowStock.slice(0, 5) },
      alerts: { openCount: openAlerts.length, items: openAlerts.slice(0, 5) },
    },
  });
}
