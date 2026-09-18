import { error, generateId, insert, json, nowIso, readObject, safeRoute } from "../../_lib/demo";

export const dynamic = "force-dynamic";

/** Stores concise decision metadata only; raw patient text and model reasoning are not logged here. */
export const POST = safeRoute(async (request: Request) => {
  const body = await readObject(request);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 120) : "";
  const event = typeof body?.event === "string" ? body.event.slice(0, 80) : "";
  if (!sessionId || !event) return error("sessionId and event are required.");
  const details = body?.details && typeof body.details === "object" ? body.details : {};
  await insert("audit_logs", {
    id: generateId("intake-log"),
    userId: "patient-intake",
    action: event,
    entityType: "patient_intake",
    entityId: sessionId,
    details: JSON.stringify(details).slice(0, 8000),
    createdAt: nowIso(),
  });
  return json({ stored: true }, 201);
});
