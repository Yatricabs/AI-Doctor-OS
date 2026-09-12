import { error, generateId, insert, json, nowIso, query, queryOne, readObject, requiredString, safeRoute, update } from "../_lib/demo";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const channel = searchParams.get("channel");
  const direction = searchParams.get("direction");

  let sql = "SELECT * FROM messages WHERE 1=1";
  const params: unknown[] = [];
  if (patientId) { sql += " AND patient_id = ?"; params.push(patientId); }
  if (channel) { sql += " AND channel = ?"; params.push(channel); }
  if (direction) { sql += " AND direction = ?"; params.push(direction); }
  sql += " ORDER BY created_at DESC LIMIT 50";

  const messages = await query<Record<string, unknown>>(sql, params);
  return json({ messages, total: messages.length });
});

export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  if (!body) return error("Invalid request body");

  const action = requiredString(body.action, "action") ?? "draft";

  // ── Draft a message for approval ──
  if (action === "draft") {
    const patientId = requiredString(body.patientId, "patientId");
    const content = requiredString(body.content, "content");
    const messageType = requiredString(body.messageType, "messageType") ?? "general";
    if (!patientId || !content) return error("patientId and content are required");

    const patient = await queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return error("Patient not found", 404);

    // Get preferred channel
    const prefs = await queryOne<Record<string, unknown>>("SELECT * FROM communication_preferences WHERE patient_id = ?", [patientId]);
    const channel = (prefs?.preferredChannel as string) ?? (typeof body.channel === "string" ? body.channel : "sms");

    const message = {
      id: generateId("msg"),
      patientId,
      visitId: typeof body.visitId === "string" ? body.visitId : null,
      channel,
      direction: "outbound",
      messageType,
      content,
      status: "pending_approval",
      createdAt: nowIso(),
    };
    await insert("messages", message);
    return json({ message, note: "Message drafted. Awaiting doctor approval before sending." }, 201);
  }

  // ── Approve and send ──
  if (action === "approve_send") {
    const messageId = requiredString(body.messageId, "messageId");
    if (!messageId) return error("messageId is required");
    const msg = await queryOne<Record<string, unknown>>("SELECT * FROM messages WHERE id = ?", [messageId]);
    if (!msg) return error("Message not found", 404);
    if (msg.status !== "pending_approval" && msg.status !== "draft") {
      return error("Only draft or pending messages can be approved");
    }

    await update("messages", messageId, {
      status: "sent",
      approvedBy: "user-doc-001",
      approvedAt: nowIso(),
      sentAt: nowIso(),
      deliveryStatus: "delivered",
    });
    return json({ message: "Message approved and sent.", messageId, channel: msg.channel });
  }

  // ── Send appointment reminder ──
  if (action === "appointment_reminder") {
    const patientId = requiredString(body.patientId, "patientId");
    const appointmentId = requiredString(body.appointmentId, "appointmentId");
    if (!patientId || !appointmentId) return error("patientId and appointmentId are required");

    const patient = await queryOne<Record<string, unknown>>("SELECT * FROM patients WHERE id = ?", [patientId]);
    const appt = await queryOne<Record<string, unknown>>("SELECT * FROM appointments WHERE id = ?", [appointmentId]);
    if (!patient || !appt) return error("Patient or appointment not found", 404);

    const content = `Dear ${patient.name}, your appointment is scheduled for ${appt.appointmentDate} at ${appt.appointmentTime}. Please arrive 10 minutes early. For questions, call your clinic.`;
    const msg = {
      id: generateId("msg"),
      patientId,
      visitId: null,
      channel: "sms",
      direction: "outbound",
      messageType: "appointment_reminder",
      content,
      status: "sent",
      approvedBy: "system",
      approvedAt: nowIso(),
      sentAt: nowIso(),
      deliveryStatus: "delivered",
      createdAt: nowIso(),
    };
    await insert("messages", msg);
    return json({ message: msg, note: "Appointment reminder sent." }, 201);
  }

  // ── Send prescription instructions ──
  if (action === "prescription_instructions") {
    const patientId = requiredString(body.patientId, "patientId");
    const prescriptionId = requiredString(body.prescriptionId, "prescriptionId");
    if (!patientId || !prescriptionId) return error("patientId and prescriptionId are required");

    const items = await query<Record<string, unknown>>("SELECT * FROM prescription_items WHERE prescription_id = ?", [prescriptionId]);
    const instructions = items.map((i) => `${i.medicationName} ${i.dose} — ${i.frequency}. ${i.instructions ?? ""}`).join("\n");
    const content = `Your prescription from Dr. Ananya Arya:\n\n${instructions}\n\nPlease take as prescribed. Contact the clinic if you experience any side effects.`;

    const msg = {
      id: generateId("msg"),
      patientId,
      visitId: null,
      channel: "whatsapp",
      direction: "outbound",
      messageType: "instructions",
      content,
      status: "sent",
      approvedBy: "user-doc-001",
      approvedAt: nowIso(),
      sentAt: nowIso(),
      createdAt: nowIso(),
    };
    await insert("messages", msg);
    return json({ message: msg, note: "Prescription instructions sent to patient." }, 201);
  }

  return error("Unknown action. Use: draft, approve_send, appointment_reminder, prescription_instructions");
});
