// Inventory of medicines / tests / scans / procedures (INR).
//   GET    ?category=&lowStock=1  -> list active items (+ low-stock flag)
//   POST   {name,category,unit?,price,stockQty?,lowStockThreshold?} -> add item
//   PATCH  {id, ...fields}        -> update price/stock/details
//   DELETE ?id=                   -> soft delete (is_active = 0)
import { error, generateId, insert, json, nowIso, query, readObject, requiredString, safeRoute, update, type InventoryItem, type StockTransaction, type StockTxnType } from "../_lib/demo";
import { isInventoryCategory, isLowStock, recordStockMovement } from "../_lib/inventory";
import { seedCatalogue } from "../_lib/seedCatalogue";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  // Stock movement ledger for one item (spec §22 Stock Transactions).
  const txnItem = searchParams.get("transactions");
  if (txnItem) {
    const txns = await query<StockTransaction>(
      "SELECT * FROM stock_transactions WHERE inventory_item_id = ? ORDER BY created_at DESC LIMIT 200",
      [txnItem]
    );
    return json({ transactions: txns, total: txns.length });
  }

  const category = searchParams.get("category");
  const lowStockOnly = searchParams.get("lowStock") === "1";

  const params: unknown[] = [];
  let sql = "SELECT * FROM inventory_items WHERE is_active = 1";
  if (category && isInventoryCategory(category)) {
    sql += " AND category = ?";
    params.push(category);
  }
  sql += " ORDER BY category ASC, name ASC";

  const rows = await query<InventoryItem>(sql, params);
  const items = rows
    .map((it) => ({ ...it, tracksStock: Boolean(it.tracksStock), isActive: Boolean(it.isActive), lowStock: isLowStock({ ...it, tracksStock: Boolean(it.tracksStock) }) }))
    .filter((it) => (lowStockOnly ? it.lowStock : true));

  return json({ items, total: items.length });
});

const STOCK_TXN_TYPES = ["in", "return", "adjustment"] as const;
function isStockAction(v: unknown): v is (typeof STOCK_TXN_TYPES)[number] {
  return typeof v === "string" && (STOCK_TXN_TYPES as readonly string[]).includes(v);
}

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");

  // Action: seed the demo catalogue (spec §20/§21). Idempotent.
  if (body.action === "seed") {
    const res = await seedCatalogue();
    return json({ seeded: true, ...res });
  }

  // Action: record a stock movement (in / return / adjustment) — spec §22.
  if (isStockAction(body.action)) {
    const id = requiredString(body.id, "id", 120);
    if (!id) return error("id is required.");
    const qty = Math.trunc(Number(body.quantity));
    if (!Number.isFinite(qty) || qty < 0) return error("quantity must be a non-negative integer.");
    try {
      const stockAfter = await recordStockMovement(id, body.action as StockTxnType, qty, {
        note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
      });
      if (stockAfter === null) return error("Inventory item not found.", 404);
      return json({ ok: true, id, stockAfter, txnType: body.action });
    } catch (e) {
      return error(e instanceof Error ? e.message : "Stock movement failed.");
    }
  }

  const name = requiredString(body.name, "name", 160);
  const category = body.category;
  if (!name) return error("name is required.");
  if (!isInventoryCategory(category)) return error("category must be medicine, test, scan or procedure.");

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return error("price must be a non-negative number.");
  const purchasePriceRaw = Number(body.purchasePrice);
  const purchasePrice = Number.isFinite(purchasePriceRaw) && purchasePriceRaw >= 0 ? purchasePriceRaw : 0;

  const tracksStock = category === "medicine";
  const stockQty = tracksStock ? Math.max(0, Math.trunc(Number(body.stockQty) || 0)) : 0;
  const lowStockThreshold = tracksStock ? Math.max(0, Math.trunc(Number(body.lowStockThreshold) || 10)) : 0;
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 40) : category === "medicine" ? "unit" : "test";

  const id = generateId("inv");
  const now = nowIso();
  await insert("inventory_items", {
    id, name, category, unit, price, purchasePrice, stockQty, lowStockThreshold,
    tracksStock: tracksStock ? 1 : 0, isActive: 1, createdAt: now, updatedAt: now,
  });
  // An opening stock creates an initial ledger entry so the ledger reconciles.
  if (tracksStock && stockQty > 0) {
    await recordStockMovement(id, "in", stockQty, { unitPrice: purchasePrice, note: "Opening stock" });
  }

  return json({ item: { id, name, category, unit, price, purchasePrice, stockQty, lowStockThreshold, tracksStock, isActive: true } }, 201);
});

export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const id = requiredString(body.id, "id", 120);
  if (!id) return error("id is required.");

  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 160);
  if (typeof body.unit === "string" && body.unit.trim()) patch.unit = body.unit.trim().slice(0, 40);
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return error("price must be a non-negative number.");
    patch.price = price;
  }
  if (body.purchasePrice !== undefined) {
    const pp = Number(body.purchasePrice);
    if (!Number.isFinite(pp) || pp < 0) return error("purchasePrice must be a non-negative number.");
    patch.purchasePrice = pp;
  }
  if (body.stockQty !== undefined) {
    const stockQty = Math.trunc(Number(body.stockQty));
    if (!Number.isFinite(stockQty) || stockQty < 0) return error("stockQty must be a non-negative integer.");
    patch.stockQty = stockQty;
  }
  if (body.lowStockThreshold !== undefined) {
    const t = Math.trunc(Number(body.lowStockThreshold));
    if (!Number.isFinite(t) || t < 0) return error("lowStockThreshold must be a non-negative integer.");
    patch.lowStockThreshold = t;
  }

  await update("inventory_items", id, patch);
  return json({ ok: true, id });
});

export const DELETE = safeRoute(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("id is required.");
  // Soft delete so historical bill_items keep referring to a real name.
  await update("inventory_items", id, { isActive: 0, updatedAt: nowIso() });
  return json({ ok: true, id });
});
