// Per-appointment chat transcript: save the AI conversation for an appointment,
// and fetch a patient's full visit history (appointments + chat + brief + Rx).
//   POST {patientId, appointmentId?, briefId?, transcript:[{role,content}]} -> save
//   GET  ?patientId= -> visit history: each appointment with its chat + brief + prescription
import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body.");
  const patientId = requiredString(body.patientId, "patientId", 120);
  if (!patientId) return error("patientId is required.");

  const turns = Array.isArray(body.transcript) ? body.transcript : [];
  const clean = turns
    .filter((t): t is { role: string; content: string } => Boolean(t) && typeof t === "object")
    .map((t) => ({ role: (t as { role?: string }).role === "user" ? "user" : "assistant", content: String((t as { content?: string }).content ?? "").slice(0, 4000) }))
    .filter((t) => t.content);

  const id = generateId("chat");
  await insert("appointment_chats", {
    id,
    appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
    patientId,
    briefId: typeof body.briefId === "string" ? body.briefId : null,
    transcript: JSON.stringify(clean).slice(0, 60000),
    createdAt: nowIso(),
  });
  return json({ id }, 201);
});

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return error("patientId is required.");

  // ── Compact PAST-VISIT summary for the AI (returning patients) ──
  // Used by the new-appointment flow so the AI knows the patient's history.
  if (searchParams.get("context") === "1") {
    const briefs = await query<Record<string, unknown>>(
      "SELECT * FROM pre_visit_briefs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 3",
      [patientId]
    );
    const followUps = await query<Record<string, unknown>>(
      "SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY due_date DESC LIMIT 3",
      [patientId]
    );
    const meds = await query<Record<string, unknown>>(
      "SELECT * FROM medications WHERE patient_id = ? AND status = 'active' LIMIT 8",
      [patientId]
    );
    const lines: string[] = [];
    briefs.forEach((b) => {
      const when = String(b.createdAt ?? "").slice(0, 10);
      const reason = String(b.visitReason ?? "").trim();
      const changed = String(b.whatChanged ?? "").trim();
      if (reason || changed) lines.push(`Visit ${when}: ${reason}${changed ? ` — ${changed}` : ""}`.slice(0, 300));
    });
    if (meds.length) lines.push(`Current medicines: ${meds.map((m) => `${m.name} ${m.dose ?? ""}`.trim()).join(", ")}`);
    if (followUps.length) {
      const fu = followUps[0];
      lines.push(`Last follow-up advised: ${String(fu.title ?? "")}${fu.dueDate ? ` (due ${fu.dueDate})` : ""}`);
    }
    return json({ patientId, pastSummary: lines.join("\n"), hasHistory: lines.length > 0 });
  }

  // All appointments for the patient (most recent first).
  const appts = await query<Record<string, unknown>>(
    "SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC, appointment_time DESC",
    [patientId]
  );

  // Chats + prescriptions for the patient, joined in memory by appointmentId.
  const chats = await query<Record<string, unknown>>(
    "SELECT * FROM appointment_chats WHERE patient_id = ? ORDER BY created_at DESC",
    [patientId]
  );
  const prescriptions = await query<Record<string, unknown>>(
    "SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC",
    [patientId]
  );

  const parseTurns = (v: unknown) => { try { const p = JSON.parse(String(v ?? "[]")); return Array.isArray(p) ? p : []; } catch { return []; } };

  const visits = await Promise.all(appts.map(async (a) => {
    const apptId = String(a.id);
    const chat = chats.find((c) => c.appointmentId === apptId) ?? null;
    const rx = prescriptions.find((p) => p.visitId === apptId || p.appointmentId === apptId) ?? null;
    let rxItems: Record<string, unknown>[] = [];
    if (rx) rxItems = await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [rx.id]);
    return {
      appointment: a,
      chat: chat ? { id: chat.id, transcript: parseTurns(chat.transcript), createdAt: chat.createdAt } : null,
      prescription: rx ? { ...rx, items: rxItems } : null,
    };
  }));

  // Chats that aren't linked to a known appointment (defensive).
  const linkedChatIds = new Set(visits.map((v) => v.chat?.id).filter(Boolean));
  const orphanChats = chats
    .filter((c) => !linkedChatIds.has(c.id as string))
    .map((c) => ({ appointment: null, chat: { id: c.id, transcript: parseTurns(c.transcript), createdAt: c.createdAt }, prescription: null }));

  return json({ patientId, visits: [...visits, ...orphanChats], total: visits.length });
});
