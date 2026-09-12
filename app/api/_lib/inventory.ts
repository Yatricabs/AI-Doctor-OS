// Inventory helpers shared by the inventory and billing routes.
// Stock decrement on sale lives here so billing and inventory stay consistent.
import { query, queryOne, type InventoryItem } from "./demo";

export const INVENTORY_CATEGORIES = ["medicine", "test", "scan"] as const;

export function isInventoryCategory(v: unknown): v is (typeof INVENTORY_CATEGORIES)[number] {
  return typeof v === "string" && (INVENTORY_CATEGORIES as readonly string[]).includes(v);
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  return queryOne<InventoryItem>("SELECT * FROM inventory_items WHERE id = ?", [id]);
}

/**
 * Decrements stock for a sold item by `qty`. Only applies when the item tracks
 * stock (medicines). Returns the new stock, or throws if it would go negative.
 * Uses a guarded UPDATE so concurrent sales cannot oversell.
 */
export async function decrementStock(itemId: string, qty: number): Promise<number | null> {
  const item = await getInventoryItem(itemId);
  if (!item) return null;
  if (!item.tracksStock) return item.stockQty; // tests/scans: nothing to deduct
  const rows = await query<{ stockQty: number }>(
    "UPDATE inventory_items SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND stock_qty >= ? RETURNING stock_qty",
    [qty, new Date().toISOString(), itemId, qty]
  );
  if (!rows.length) {
    throw new Error(`Insufficient stock for "${item.name}" (have ${item.stockQty}, need ${qty}).`);
  }
  return rows[0].stockQty;
}

export function isLowStock(item: InventoryItem): boolean {
  return item.tracksStock && item.stockQty <= item.lowStockThreshold;
}
