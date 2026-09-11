import { error, getInboxItems, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const patientId = searchParams.get("patientId");

  let sql = `SELECT i.*, p.name as patient_name, p.initials as patient_initials
             FROM inbox_items i LEFT JOIN patients p ON i.patient_id = p.id
             WHERE i.status = 'open'`;
  const params: unknown[] = [];

  if (category) { sql += " AND i.category = ?"; params.push(category); }
  if (priority) { sql += " AND i.priority = ?"; params.push(priority); }
  if (patientId) { sql += " AND i.patient_id = ?"; params.push(patientId); }
  sql += " ORDER BY CASE i.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.created_at DESC";

  const items = query<Record<string, unknown>>(sql, params);
  const urgentCount = items.filter((i) => i.priority === "urgent").length;
  const highCount = items.filter((i) => i.priority === "high").length;
  const categories = [...new Set(items.map((i) => i.category))];

  return json({ items, total: items.length, urgentCount, highCount, categories });
}

export async function POST(request: Request) {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "resolve";

  if (action === "resolve") {
    const itemId = requiredString(body.itemId, "itemId");
    if (!itemId) return error("itemId is required");
    update("inbox_items", itemId, {
      status: "resolved",
      resolvedBy: "user-doc-001",
      resolvedAt: nowIso(),
    });
    return json({ message: "Inbox item resolved." });
  }

  if (action === "in_progress") {
    const itemId = requiredString(body.itemId, "itemId");
    if (!itemId) return error("itemId is required");
    update("inbox_items", itemId, { status: "in_progress" });
    return json({ message: "Item marked in progress." });
  }

  if (action === "create") {
    const title = requiredString(body.title, "title");
    const detail = requiredString(body.detail, "detail");
    if (!title || !detail) return error("title and detail are required");
    const item = {
      id: generateId("inbox"),
      patientId: typeof body.patientId === "string" ? body.patientId : null,
      visitId: typeof body.visitId === "string" ? body.visitId : null,
      category: typeof body.category === "string" ? body.category : "task",
      title,
      detail,
      priority: typeof body.priority === "string" ? body.priority : "medium",
      status: "open",
      assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : null,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      source: typeof body.source === "string" ? body.source : "manual",
      actionRequired: typeof body.actionRequired === "string" ? body.actionRequired : null,
      createdAt: nowIso(),
    };
    insert("inbox_items", item);
    return json({ item }, 201);
  }

  return error("Unknown action. Use: resolve, in_progress, create");
}
