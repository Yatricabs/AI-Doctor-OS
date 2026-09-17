import { error, json, query, readObject, safeRoute, type InventoryItem, type StockTransaction } from "../../_lib/demo";
import { recordStockMovement } from "../../_lib/inventory";

export const dynamic = "force-dynamic";

function toMedicine(item: InventoryItem) {
  const stock = Number(item.stockQty) || 0;
  const minimum = Number(item.lowStockThreshold) || 0;
  return {
    id: item.id, name: item.name, unit: item.unit ?? "unit",
    purchasePrice: Number(item.purchasePrice) || 0, salePrice: Number(item.price) || 0,
    currentStock: stock, minStock: minimum,
    status: stock <= 0 ? "Out of stock" : stock <= minimum ? "Low stock" : "In stock",
  };
}

export const GET = safeRoute(async () => {
  const [items, transactions] = await Promise.all([
    query<InventoryItem>("SELECT * FROM inventory_items WHERE is_active = 1 AND category = 'medicine' ORDER BY name ASC"),
    query<StockTransaction>("SELECT * FROM stock_transactions ORDER BY created_at DESC LIMIT 200"),
  ]);
  return json({ medicines: items.map(toMedicine), transactions: transactions.map((tx) => ({
    id: tx.id, medicineId: tx.inventoryItemId, medicineName: "", type: tx.txnType,
    quantity: tx.quantity, note: tx.note, createdAt: tx.createdAt,
  })) });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const response = await fetch(new URL("/api/inventory", request.url), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: body.name, category: "medicine", unit: body.unit, price: body.salePrice ?? body.price, purchasePrice: body.purchasePrice, stockQty: body.currentStock ?? body.stockQty, lowStockThreshold: body.minStock ?? body.lowStockThreshold }),
  });
  const payload = await response.json() as { data?: { item?: InventoryItem }; error?: { message?: string } };
  if (!response.ok || !payload.data?.item) return error(payload.error?.message ?? "Could not add medicine.", response.status);
  return json({ medicine: toMedicine(payload.data.item) }, response.status);
});

export const PATCH = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body || typeof body.id !== "string") return error("id is required.");
  if (body.action === "stock") {
    const type = body.type === "out" ? "sale" : body.type;
    if (!["in", "sale", "return", "adjustment"].includes(String(type))) return error("Invalid stock movement.");
    const stock = await recordStockMovement(body.id, type as "in" | "sale" | "return" | "adjustment", Math.max(0, Math.trunc(Number(body.quantity) || 0)), { note: typeof body.note === "string" ? body.note : undefined });
    if (stock === null) return error("Medicine not found.", 404);
    return json({ id: body.id, currentStock: stock });
  }
  return error("Medicine updates are not supported by this adapter.");
});

export const DELETE = safeRoute(async () => error("Medicine deletion is not enabled by this adapter."));

