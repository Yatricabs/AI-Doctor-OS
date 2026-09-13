// Billing: per-patient earnings + create bills that decrement inventory stock.
//   GET  ?patientId=  -> bills for one patient (+ items)
//   GET               -> all bills grouped by patient + overall totals + breakdown
//   GET  ?summary=1   -> revenue summary (today + all-time) for the dashboard
//   POST {patientId, appointmentId?, items:[{inventoryItemId?, itemType, description, quantity, unitPrice}]}
//        -> creates a bill, computes amounts, decrements medicine stock. INR.
import { error, generateId, json, nowIso, patientById, query, queryOne, readObject, requiredString, safeRoute, type Bill, type BillItem } from "../_lib/demo";
import { transaction } from "../_lib/database";
import { getInventoryItem } from "../_lib/inventory";

export const dynamic = "force-dynamic";

const ITEM_TYPES = ["appointment", "medicine", "test", "scan"] as const;
function isItemType(v: unknown): v is (typeof ITEM_TYPES)[number] {
  return typeof v === "string" && (ITEM_TYPES as readonly string[]).includes(v);
}

async function itemsFor(billId: string): Promise<BillItem[]> {
  return query<BillItem>("SELECT * FROM bill_items WHERE bill_id = ? ORDER BY created_at ASC", [billId]);
}

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  // Dashboard revenue summary.
  if (searchParams.get("summary") === "1") {
    const today = new Date().toISOString().slice(0, 10);
    const allTime = await queryOne<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(total),0)::float AS total, COUNT(*)::int AS count FROM bills"
    );
    const todayRow = await queryOne<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(total),0)::float AS total, COUNT(*)::int AS count FROM bills WHERE created_at LIKE ?",
      [`${today}%`]
    );
    const byType = await query<{ itemType: string; amount: number }>(
      "SELECT item_type, COALESCE(SUM(amount),0)::float AS amount FROM bill_items GROUP BY item_type"
    );
    return json({
      today: { total: todayRow?.total ?? 0, bills: todayRow?.count ?? 0 },
      allTime: { total: allTime?.total ?? 0, bills: allTime?.count ?? 0 },
      breakdown: Object.fromEntries(byType.map((r) => [r.itemType, r.amount])),
    });
  }

  const patientId = searchParams.get("patientId");

  // One patient's bills.
  if (patientId) {
    const bills = await query<Bill>("SELECT * FROM bills WHERE patient_id = ? ORDER BY created_at DESC", [patientId]);
    const withItems = await Promise.all(bills.map(async (b) => ({ ...b, items: await itemsFor(b.id) })));
    const total = withItems.reduce((s, b) => s + b.total, 0);
    return json({ patientId, bills: withItems, total });
  }

  // All bills, grouped per patient, with overall totals + breakdown.
  const bills = await query<Bill & { patientName?: string }>(
    `SELECT b.*, p.name AS patient_name FROM bills b
     LEFT JOIN patients p ON b.patient_id = p.id
     ORDER BY b.created_at DESC`
  );
  const withItems = await Promise.all(bills.map(async (b) => ({ ...b, items: await itemsFor(b.id) })));

  const perPatient = new Map<string, { patientId: string; patientName: string; total: number; bills: number }>();
  for (const b of withItems) {
    const key = b.patientId;
    const cur = perPatient.get(key) ?? { patientId: key, patientName: b.patientName ?? key, total: 0, bills: 0 };
    cur.total += b.total;
    cur.bills += 1;
    perPatient.set(key, cur);
  }

  const breakdown: Record<string, number> = { appointment: 0, medicine: 0, test: 0, scan: 0 };
  for (const b of withItems) for (const it of b.items) breakdown[it.itemType] = (breakdown[it.itemType] ?? 0) + it.amount;

  const grandTotal = withItems.reduce((s, b) => s + b.total, 0);

  return json({
    bills: withItems,
    perPatient: Array.from(perPatient.values()).sort((a, b) => b.total - a.total),
    breakdown,
    grandTotal,
    currency: "INR",
  });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");

  const patientId = requiredString(body.patientId, "patientId", 120);
  if (!patientId) return error("patientId is required.");
  if (!(await patientById(patientId))) return error("Patient not found.", 404);

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) return error("At least one bill item is required.");

  // Validate + resolve items (price from inventory when an id is given).
  type Line = { inventoryItemId: string | null; itemType: string; description: string; quantity: number; unitPrice: number; amount: number };
  const lines: Line[] = [];
  for (const raw of rawItems) {
    const r = raw as Record<string, unknown>;
    const itemType = r.itemType;
    if (!isItemType(itemType)) return error("Each item needs a valid itemType (appointment/medicine/test/scan).");
    const quantity = Math.max(1, Math.trunc(Number(r.quantity) || 1));

    let unitPrice = Number(r.unitPrice);
    let description = typeof r.description === "string" ? r.description.trim() : "";
    let inventoryItemId: string | null = typeof r.inventoryItemId === "string" ? r.inventoryItemId : null;

    if (inventoryItemId) {
      const inv = await getInventoryItem(inventoryItemId);
      if (!inv) return error(`Inventory item not found: ${inventoryItemId}`);
      if (!Number.isFinite(unitPrice)) unitPrice = inv.price;
      if (!description) description = inv.name;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return error("Each item needs a non-negative unitPrice.");
    if (!description) description = itemType === "appointment" ? "Consultation fee" : "Item";
    if (itemType === "appointment") inventoryItemId = null;

    lines.push({ inventoryItemId, itemType, description, quantity, unitPrice, amount: quantity * unitPrice });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const billId = generateId("bill");
  const now = nowIso();
  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : null;

  // Atomic: create bill + items + decrement medicine stock together.
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO bills (id,patient_id,appointment_id,doctor_id,clinic_id,status,subtotal,total,currency,notes,created_at,updated_at)
       VALUES ($1,$2,$3,'user-doc-001','clinic-001','paid',$4,$4,'INR',$5,$6,$6)`,
      [billId, patientId, appointmentId, total, typeof body.notes === "string" ? body.notes.slice(0, 500) : null, now]
    );
    let n = 0;
    for (const l of lines) {
      n++;
      await client.query(
        `INSERT INTO bill_items (id,bill_id,inventory_item_id,item_type,description,quantity,unit_price,amount,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [`${billId}-i${n}`, billId, l.inventoryItemId, l.itemType, l.description, l.quantity, l.unitPrice, l.amount, now]
      );
      // Decrement stock only for medicines that track it (guarded to avoid overselling).
      // Actual dispensing/sale reduces stock AND records a ledger entry (spec §22/§23).
      if (l.inventoryItemId && l.itemType === "medicine") {
        const res = await client.query(
          "UPDATE inventory_items SET stock_qty = stock_qty - $1, updated_at = $2 WHERE id = $3 AND tracks_stock = 1 AND stock_qty >= $1 RETURNING stock_qty",
          [l.quantity, now, l.inventoryItemId]
        );
        if (res.rowCount === 0) {
          // Roll back the whole bill: not enough stock.
          throw new Error(`Insufficient stock for "${l.description}".`);
        }
        const stockAfter = (res.rows[0] as { stock_qty: number }).stock_qty;
        await client.query(
          `INSERT INTO stock_transactions (id,inventory_item_id,txn_type,quantity,stock_after,unit_price,reference,note,created_at)
           VALUES ($1,$2,'sale',$3,$4,$5,$6,$7,$8)`,
          [`${billId}-s${n}`, l.inventoryItemId, l.quantity, stockAfter, l.unitPrice, billId, `Dispensed on bill ${billId}`, now]
        );
      }
    }
  });

  return json({ bill: { id: billId, patientId, appointmentId, total, currency: "INR", items: lines } }, 201);
});
