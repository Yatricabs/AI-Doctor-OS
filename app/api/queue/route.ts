import { error, generateId, getQueueStatus, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId") ?? "clinic-001";
  const patientId = searchParams.get("patientId");

  if (patientId) {
    const entry = await queryOne<Record<string, unknown>>(
      "SELECT q.*, p.name as patient_name FROM queue_entries q JOIN patients p ON q.patient_id = p.id WHERE q.patient_id = ? AND q.status NOT IN ('completed','skipped') ORDER BY q.created_at DESC LIMIT 1",
      [patientId]
    );
    const position = entry ? entry.position : null;
    const estimatedWait = entry ? entry.estimatedWaitMinutes : null;
    const etaWindow = position && typeof position === "number"
      ? `Your estimated wait is approximately ${estimatedWait ?? position * 12} minutes.`
      : "You are not currently in the queue.";
    return json({ entry, position, estimatedWaitMinutes: estimatedWait, etaWindow });
  }

  const status = await getQueueStatus(clinicId);
  return json({ queue: status });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action");
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Check-in patient ──
  if (action === "checkin") {
    const patientId = requiredString(body.patientId, "patientId");
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : undefined;
    if (!patientId) return error("patientId is required");

    const existing = await queryOne<Record<string, unknown>>(
      "SELECT * FROM queue_entries WHERE patient_id = ? AND status IN ('waiting','called','in_consultation')",
      [patientId]
    );
    if (existing) return json({ entry: existing, message: "Patient already in queue." });

    // Determine priority from appointment
    let priority = "routine";
    if (appointmentId) {
      const appt = await queryOne<Record<string, unknown>>("SELECT * FROM appointments WHERE id = ?", [appointmentId]);
      if (appt && appt.visitType === "new_complaint") priority = "high";
    }

    // Determine position
    const positionRow = await queryOne<{ n: number }>("SELECT COUNT(*) as n FROM queue_entries WHERE clinic_id = 'clinic-001' AND status IN ('waiting','called')");
    const position = (positionRow?.n ?? 0) + 1;
    const estimated = position * 12;

    // Generate token
    const tokenRow = await queryOne<{ counter: number }>("SELECT counter FROM queue_tokens WHERE clinic_id = 'clinic-001' AND date = ?", [todayStr]);
    const tokenNum = (tokenRow?.counter ?? 0) + 1;
    const tokenNumber = `T${String(tokenNum).padStart(3, "0")}`;
    if (tokenRow) {
      await query("UPDATE queue_tokens SET counter = ? WHERE clinic_id = 'clinic-001' AND date = ?", [tokenNum, todayStr]);
    } else {
      await insert("queue_tokens", { id: generateId("qt"), clinicId: "clinic-001", department: null, date: todayStr, counter: tokenNum, prefix: "T" });
    }

    const entry = {
      id: generateId("q"),
      patientId,
      appointmentId: appointmentId ?? null,
      clinicId: "clinic-001",
      doctorId: "user-doc-001",
      tokenNumber,
      priority,
      status: "waiting",
      checkedInAt: nowIso(),
      estimatedWaitMinutes: estimated,
      position,
      isWalkIn: body.isWalkIn === true ? 1 : 0,
      createdAt: nowIso(),
    };
    await insert("queue_entries", entry);
    // Update appointment status
    if (appointmentId) await update("appointments", appointmentId, { status: "checked_in", updatedAt: nowIso() });
    return json({ entry, tokenNumber, position, estimatedWaitMinutes: estimated, message: `Token ${tokenNumber} issued. Position ${position} in queue.` }, 201);
  }

  // ── Call next patient ──
  if (action === "call_next") {
    const next = await queryOne<Record<string, unknown>>(
      "SELECT * FROM queue_entries WHERE status = 'waiting' ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'routine' THEN 3 ELSE 4 END, position ASC LIMIT 1"
    );
    if (!next) return json({ message: "Queue is empty." });
    await update("queue_entries", String(next.id), { status: "called", calledAt: nowIso() });
    return json({ entry: { ...next, status: "called", calledAt: nowIso() }, message: `Calling token ${next.tokenNumber}` });
  }

  // ── Start consultation ──
  if (action === "start_consultation") {
    const entryId = requiredString(body.entryId, "entryId");
    if (!entryId) return error("entryId is required");
    await update("queue_entries", entryId, { status: "in_consultation", startedAt: nowIso() });
    const entry = await queryOne<Record<string, unknown>>("SELECT * FROM queue_entries WHERE id = ?", [entryId]);
    return json({ entry });
  }

  // ── Complete consultation ──
  if (action === "complete") {
    const entryId = requiredString(body.entryId, "entryId");
    if (!entryId) return error("entryId is required");
    await update("queue_entries", entryId, { status: "completed", completedAt: nowIso() });
    const entry = await queryOne<Record<string, unknown>>("SELECT * FROM queue_entries WHERE id = ?", [entryId]);
    return json({ entry });
  }

  // ── Override priority ──
  if (action === "override_priority") {
    const entryId = requiredString(body.entryId, "entryId");
    const newPriority = requiredString(body.priority, "priority");
    const reason = requiredString(body.reason, "reason");
    if (!entryId || !newPriority || !reason) return error("entryId, priority, and reason are required");
    await update("queue_entries", entryId, { priority: newPriority, priorityReason: reason });
    const entry = await queryOne<Record<string, unknown>>("SELECT * FROM queue_entries WHERE id = ?", [entryId]);
    return json({ entry });
  }

  return error("Unknown action");
});
