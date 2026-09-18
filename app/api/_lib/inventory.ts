// Inventory helpers shared by the inventory and billing routes.
// Stock movements go through recordStockMovement so the ledger (stock_transactions)
// and the item's stock_qty stay consistent (spec §22).
import { generateId, insert, nowIso, query, queryOne, type InventoryItem, type StockTxnType } from "./demo";

export const INVENTORY_CATEGORIES = ["medicine", "test", "scan", "procedure"] as const;

export function isInventoryCategory(v: unknown): v is (typeof INVENTORY_CATEGORIES)[number] {
  return typeof v === "string" && (INVENTORY_CATEGORIES as readonly string[]).includes(v);
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  return queryOne<InventoryItem>("SELECT * FROM inventory_items WHERE id = ?", [id]);
}

/** Append a row to the stock ledger. */
async function logStockTxn(itemId: string, txnType: StockTxnType, qty: number, stockAfter: number, unitPrice: number, reference?: string, note?: string): Promise<void> {
  await insert("stock_transactions", {
    id: generateId("stx"), inventoryItemId: itemId, txnType, quantity: qty,
    stockAfter, unitPrice, reference: reference ?? null, note: note ?? null, createdAt: nowIso(),
  });
}

/**
 * Records a stock movement and updates the item's stock level atomically-ish.
 * Stock logic (spec §22):
 *   in         → stock + qty
 *   return     → stock + qty
 *   sale       → stock − qty   (guarded so it cannot oversell)
 *   adjustment → stock set to `qty` (absolute correction), ledger records the delta
 * Only medicines (tracksStock) move stock; for services this is a no-op.
 * Returns the new stock level (or null if the item does not exist).
 */
export async function recordStockMovement(
  itemId: string,
  txnType: StockTxnType,
  qty: number,
  opts: { unitPrice?: number; reference?: string; note?: string } = {}
): Promise<number | null> {
  const item = await getInventoryItem(itemId);
  if (!item) return null;
  if (!item.tracksStock) return item.stockQty; // services don't hold stock

  const now = nowIso();
  const unitPrice = opts.unitPrice ?? item.price;

  if (txnType === "sale") {
    const rows = await query<{ stockQty: number }>(
      "UPDATE inventory_items SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND stock_qty >= ? RETURNING stock_qty",
      [qty, now, itemId, qty]
    );
    if (!rows.length) throw new Error(`Insufficient stock for "${item.name}" (have ${item.stockQty}, need ${qty}).`);
    const after = rows[0].stockQty;
    await logStockTxn(itemId, "sale", qty, after, unitPrice, opts.reference, opts.note);
    return after;
  }

  if (txnType === "adjustment") {
    // qty is the corrected absolute stock level.
    const target = Math.max(0, Math.trunc(qty));
    await query("UPDATE inventory_items SET stock_qty = ?, updated_at = ? WHERE id = ?", [target, now, itemId]);
    await logStockTxn(itemId, "adjustment", Math.abs(target - item.stockQty), target, unitPrice, opts.reference, opts.note || `Adjusted from ${item.stockQty} to ${target}`);
    return target;
  }

  // in / return: add to stock.
  const rows = await query<{ stockQty: number }>(
    "UPDATE inventory_items SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? RETURNING stock_qty",
    [qty, now, itemId]
  );
  const after = rows.length ? rows[0].stockQty : item.stockQty + qty;
  await logStockTxn(itemId, txnType, qty, after, unitPrice, opts.reference, opts.note);
  return after;
}

/**
 * Decrements stock for a sold item by `qty` (records a "sale" ledger entry).
 * Kept for the billing route's existing call sites.
 */
export async function decrementStock(itemId: string, qty: number, reference?: string): Promise<number | null> {
  return recordStockMovement(itemId, "sale", qty, { reference });
}

export function isLowStock(item: InventoryItem): boolean {
  return item.tracksStock && item.stockQty <= item.lowStockThreshold;
}
