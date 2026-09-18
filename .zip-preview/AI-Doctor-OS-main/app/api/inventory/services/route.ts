import { Service, error, json, persistService, readObject, removeService, requiredNumber, requiredString, services } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export function GET() {
  const data = [...(services as unknown as Service[])].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return json({ services: data });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const name = requiredString(body.name, "name", 120);
  const category = requiredString(body.category, "category", 20) as Service["category"] | null;
  const price = requiredNumber(body.price, 0);
  if (!name || !category || !["Test", "Scan", "Procedure"].includes(category) || price === null) {
    return error("name, category (Test, Scan, or Procedure), and price (0 or more) are required.");
  }
  const service: Service = { id: `svc-${Date.now()}`, name, category, price, status: "Active" };
  services.push(service);
  return json({ service }, 201);
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const id = requiredString(body.id, "id", 60);
  if (!id) return error("id is required.");
  const existing = (services as unknown as Service[]).find((item) => item.id === id);
  if (!existing) return error("Service not found.", 404);
  const patch: Partial<Service> = {};
  if (body.name !== undefined) { const v = requiredString(body.name, "name", 120); if (!v) return error("name must be a non-empty string."); patch.name = v; }
  if (body.price !== undefined) { const v = requiredNumber(body.price, 0); if (v === null) return error("price must be 0 or more."); patch.price = v; }
  if (body.status !== undefined) { const v = requiredString(body.status, "status", 20); if (!v || !["Active", "Inactive"].includes(v)) return error("status must be Active or Inactive."); patch.status = v as Service["status"]; }
  persistService(id, patch);
  return json({ service: { ...existing, ...patch } });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("id query parameter is required.");
  removeService(id);
  return json({ deleted: id });
}
