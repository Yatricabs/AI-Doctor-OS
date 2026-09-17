import { error, json, query, readObject, safeRoute, type InventoryItem } from "../../_lib/demo";

export const dynamic = "force-dynamic";

function toService(item: InventoryItem) {
  return { id: item.id, name: item.name, category: item.category === "scan" ? "Scan" : "Test", price: Number(item.price) || 0, status: item.isActive ? "Active" : "Inactive" };
}

export const GET = safeRoute(async () => {
  const items = await query<InventoryItem>("SELECT * FROM inventory_items WHERE is_active = 1 AND category IN ('test','scan') ORDER BY category ASC, name ASC");
  return json({ services: items.map(toService) });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const category = body.category === "Scan" ? "scan" : "test";
  const response = await fetch(new URL("/api/inventory", request.url), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: body.name, category, price: body.price, unit: "test" }),
  });
  const payload = await response.json() as { data?: { item?: InventoryItem }; error?: { message?: string } };
  if (!response.ok || !payload.data?.item) return error(payload.error?.message ?? "Could not add service.", response.status);
  return json({ service: toService(payload.data.item) }, response.status);
});

export const PATCH = safeRoute(async () => error("Service updates are not enabled by this adapter."));
export const DELETE = safeRoute(async () => error("Service deletion is not enabled by this adapter."));

