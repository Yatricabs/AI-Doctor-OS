import { InboxItem, error, inboxItems, json, persistInboxItem, readObject, requiredString } from "../_lib/demo";

export const dynamic = "force-dynamic";

const typeWeight: Record<InboxItem["type"], number> = { red_flag: 0, duplicate_identity: 1, conflict: 2, reschedule: 3, report_pending: 4 };

export function GET() {
  const data = [...(inboxItems as unknown as InboxItem[])]
    .filter((item) => item.status === "open")
    .sort((a, b) => typeWeight[a.type] - typeWeight[b.type] || a.createdAt.localeCompare(b.createdAt));
  return json({ items: data, total: data.length });
}

export async function PATCH(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Request body must be a JSON object.");
  const id = requiredString(body.id, "id", 60);
  if (!id) return error("id is required.");
  const existing = (inboxItems as unknown as InboxItem[]).find((item) => item.id === id);
  if (!existing) return error("Inbox item not found.", 404);
  persistInboxItem(id, { status: "resolved" });
  return json({ item: { ...existing, status: "resolved" } });
}
