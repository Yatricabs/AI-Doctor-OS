import { Medicine, applyStockTransaction, error, json, medicines, persistMedicine, readObject, removeMedicine, requiredNumber, requiredString, stockTransactions } from "../../_lib/demo";

export const dynamic = "force-dynamic";

function statusFor(stock: number, min: number): Medicine["status"] {
  return stock <= 0 ? "Out of stock" : stock <= min ? "Low stock" : "In stock";
}

export function GET() {
  const data = [...(medicines as unknown as Medicine[])].sort((a, b) => a.name.localeCompare(b.name));
  return json({ medicines: data, transactions: stockTransactions as unknown as unknown[] });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const name = requiredString(body.name, "name", 120);
  const unit = requiredString(body.unit, "unit", 30);
  const purchasePrice = requiredNumber(body.purchasePrice, 0);
  const salePrice = requiredNumber(body.salePrice, 0);
  const currentStock = requiredNumber(body.currentStock, 0);
  const minStock = requiredNumber(body.minStock, 0);
  if (!name || !unit || purchasePrice === null || salePrice === null || currentStock === null || minStock === null) {
    return error("name, unit, purchasePrice, salePrice, currentStock, and minStock are all required (prices/stock must be 0 or more).");
  }
  const medicine: Medicine = { id: `med-${Date.now()}`, name, unit, purchasePrice, salePrice, currentStock, minStock, status: statusFor(currentStock, minStock) };
  medicines.push(medicine);
  return json({ medicine }, 201);
}

// action: "edit" | "stock" — kept on one route since both mutate a medicine by id.
export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const id = requiredString(body.id, "id", 60);
  if (!id) return error("id is required.");
  const existing = (medicines as unknown as Medicine[]).find((item) => item.id === id);
  if (!existing) return error("Medicine not found.", 404);

  if (body.action === "stock") {
    const type = requiredString(body.type, "type", 20) as "in" | "out" | "return" | "adjustment" | null;
    if (!type || !["in", "out", "return", "adjustment"].includes(type)) return error("type must be one of in, out, return, adjustment.");
    const quantity = requiredNumber(body.quantity, 1);
    if (quantity === null) return error("quantity must be a number of 1 or more.");
    const note = optionalNote(body.note);
    const updated = applyStockTransaction(id, type, quantity, note);
    if (!updated) return error(`Stock movement would take ${existing.name} below zero.`, 409);
    return json({ medicine: updated });
  }

  // Plain field edit (name/unit/prices/minStock — not currentStock, which only moves via stock transactions).
  const patch: Partial<Medicine> = {};
  if (body.name !== undefined) { const v = requiredString(body.name, "name", 120); if (!v) return error("name must be a non-empty string."); patch.name = v; }
  if (body.unit !== undefined) { const v = requiredString(body.unit, "unit", 30); if (!v) return error("unit must be a non-empty string."); patch.unit = v; }
  if (body.purchasePrice !== undefined) { const v = requiredNumber(body.purchasePrice, 0); if (v === null) return error("purchasePrice must be 0 or more."); patch.purchasePrice = v; }
  if (body.salePrice !== undefined) { const v = requiredNumber(body.salePrice, 0); if (v === null) return error("salePrice must be 0 or more."); patch.salePrice = v; }
  if (body.minStock !== undefined) { const v = requiredNumber(body.minStock, 0); if (v === null) return error("minStock must be 0 or more."); patch.minStock = v; patch.status = statusFor(existing.currentStock, v); }
  persistMedicine(id, patch);
  return json({ medicine: { ...existing, ...patch } });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("id query parameter is required.");
  removeMedicine(id);
  return json({ deleted: id });
}

function optionalNote(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined;
}
