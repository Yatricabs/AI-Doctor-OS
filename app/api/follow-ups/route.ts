import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const overdue = searchParams.get("overdue");
  const today = new Date().toISOString().slice(0, 10);

  let sql = `SELECT f.*, p.name as patient_name, p.initials as patient_initials
             FROM follow_ups f JOIN patients p ON f.patient_id = p.id WHERE 1=1`;
  const params: unknown[] = [];

  if (patientId) { sql += " AND f.patient_id = ?"; params.push(patientId); }
  if (status) { sql += " AND f.status = ?"; params.push(status); }
  if (overdue === "true") { sql += " AND f.status = 'pending' AND f.due_date < ?"; params.push(today); }
  sql += " ORDER BY CASE f.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, f.due_date ASC";

  const followUps = await query<Record<string, unknown>>(sql, params);
  const overdueRow = await queryOne<{ n: number }>("SELECT COUNT(*) as n FROM follow_ups WHERE status = 'pending' AND due_date < ?", [today]);
  return json({ followUps, total: followUps.length, overdueCount: overdueRow?.n ?? 0 });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "create";

  // ── Create follow-up ──
  if (action === "create") {
    const patientId = requiredString(body.patientId, "patientId");
    const title = requiredString(body.title, "title");
    const dueDate = requiredString(body.dueDate, "dueDate");
    if (!patientId || !title || !dueDate) return error("patientId, title, and dueDate are required");

    const patient = await queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return error("Patient not found", 404);

    const followUp = {
      id: generateId("fu"),
      patientId,
      visitId: typeof body.visitId === "string" ? body.visitId : null,
      doctorId: "user-doc-001",
      title,
      description: typeof body.description === "string" ? body.description : null,
      dueDate,
      status: "pending",
      priority: typeof body.priority === "string" ? body.priority : "routine",
      reminderSent: 0,
      completedAt: null,
      completedBy: null,
      createdAt: nowIso(),
    };
    await insert("follow_ups", followUp);

    // Auto-create inbox item for follow-up
    await insert("inbox_items", {
      id: generateId("inbox"),
      patientId,
      category: "follow_up",
      title: `Follow-up due: ${title}`,
      detail: `Follow-up for ${patient.name} due on ${dueDate}. ${body.description ?? ""}`,
      priority: followUp.priority === "urgent" ? "urgent" : followUp.priority === "high" ? "high" : "medium",
      status: "open",
      dueAt: `${dueDate}T09:00:00.000Z`,
      source: "follow_up_engine",
      actionRequired: "Review and complete follow-up",
      createdAt: nowIso(),
    });

    return json({ followUp }, 201);
  }

  // ── Complete follow-up ──
  if (action === "complete") {
    const followUpId = requiredString(body.followUpId, "followUpId");
    if (!followUpId) return error("followUpId is required");
    await update("follow_ups", followUpId, {
      status: "completed",
      completedAt: nowIso(),
      completedBy: "user-doc-001",
    });
    // Close related inbox item
    await query(
      "UPDATE inbox_items SET status = 'resolved', resolved_by = 'user-doc-001', resolved_at = ? WHERE patient_id = (SELECT patient_id FROM follow_ups WHERE id = ?) AND category = 'follow_up' AND status = 'open'",
      [nowIso(), followUpId]
    );
    const updated = await queryOne<Record<string, unknown>>("SELECT * FROM follow_ups WHERE id = ?", [followUpId]);
    return json({ followUp: updated, message: "Follow-up marked as completed." });
  }

  // ── Cancel follow-up ──
  if (action === "cancel") {
    const followUpId = requiredString(body.followUpId, "followUpId");
    if (!followUpId) return error("followUpId is required");
    await update("follow_ups", followUpId, { status: "cancelled" });
    return json({ message: "Follow-up cancelled." });
  }

  return error("Unknown action. Use: create, complete, cancel");
});
