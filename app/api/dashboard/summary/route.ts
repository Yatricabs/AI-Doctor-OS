import { error, json, query, queryOne, safeRoute, type InventoryItem } from "../../_lib/demo";
import { isLowStock } from "../../_lib/inventory";

export const dynamic = "force-dynamic";

// Compatibility contract for the ZIP operations dashboard. The source of truth
// remains the GitHub repo's Postgres schema; this route only adapts its shape.
export const GET = safeRoute(async (request: Request) => {
  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const [appointments, patients, revenue, inventory, alerts] = await Promise.all([
    query<{ visitType: string; durationMinutes: number; priority?: string; reason?: string }>(
      "SELECT visit_type, duration_minutes, reason FROM appointments WHERE appointment_date = ? AND status NOT IN ('cancelled','no_show')",
      [date],
    ),
    queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM patients"),
    query<{ itemType: string; amount: number }>(
      "SELECT item_type, COALESCE(SUM(amount),0)::float AS amount FROM bill_items bi JOIN bills b ON b.id = bi.bill_id WHERE b.created_at LIKE ? GROUP BY item_type",
      [`${date}%`],
    ),
    query<InventoryItem>("SELECT * FROM inventory_items WHERE is_active = 1 AND category = 'medicine' ORDER BY name ASC"),
    query<{ id: string; title: string; detail: string; patientName?: string }>(
      "SELECT id, title, detail FROM inbox_items WHERE status IN ('open','in_progress') ORDER BY created_at DESC LIMIT 10",
    ),
  ]);

  const lowStock = inventory
    .map((item) => ({ ...item, tracksStock: Boolean(item.tracksStock), isActive: Boolean(item.isActive) }))
    .filter((item) => isLowStock(item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit ?? "unit",
      purchasePrice: item.purchasePrice,
      salePrice: item.price,
      currentStock: item.stockQty,
      minStock: item.lowStockThreshold,
      status: item.stockQty <= 0 ? "Out of stock" : "Low stock",
    }));
  const byType = new Map(revenue.map((row) => [row.itemType, Number(row.amount) || 0]));
  const totalMinutes = appointments.reduce((sum, row) => sum + (Number(row.durationMinutes) || 15), 0);
  const urgent = appointments.filter((row) => /chest pain|shortness of breath|severe bleeding|unconscious|fainting|stroke|seizure/i.test(String(row.reason ?? ""))).length;

  return json({ summary: {
    date,
    appointments: {
      total: appointments.length,
      new: appointments.filter((row) => row.visitType === "new_complaint").length,
      followUp: appointments.filter((row) => row.visitType === "follow_up").length,
      urgent,
      estimatedMinutes: totalMinutes,
    },
    revenue: { today: Array.from(byType.values()).reduce((sum, value) => sum + value, 0), byType: Array.from(byType.entries()).map(([type, amount]) => ({ type, amount })) },
    patients: { total: patients?.n ?? 0 },
    inventory: { lowStockCount: lowStock.length, lowStock },
    alerts: { openCount: alerts.length, items: alerts },
  } });
});
